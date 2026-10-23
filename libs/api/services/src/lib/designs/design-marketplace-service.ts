import Stripe from 'stripe';
import {
  type Currency,
  DatabaseRepository,
  type Design,
  type DesignLicense,
  type DesignSlot,
  type DesignSurface,
} from '@ime/db';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { AccessService } from '../access/access-service';
import { formatMoney } from '@ime/utils';
import { SellingGateService } from '../selling';

/** Marks a Checkout Session as a design purchase, for the webhook. */
export const DESIGN_LICENSE_PURPOSE = 'design_license';

/**
 * A design as the marketplace shows it.
 */
export interface MarketplaceDesign {
  design: Pick<
    Design,
    | 'id'
    | 'name'
    | 'description'
    | 'surface'
    | 'pricingMode'
    | 'currency'
    | 'minimumPrice'
    | 'suggestedPrice'
    | 'styles'
    | 'publishedAt'
  >;
  /** The slots its latest version gives artists to fill in. */
  slots: DesignSlot[];
  latestVersion: number;
}

/**
 * How getting a design went: licensed at once, or a payment to make on
 * Stripe's checkout page, after which the webhook records the license.
 */
export type DesignAcquisition =
  { status: 'licensed' } | { status: 'payment'; url: string };

/**
 * The artist's side of the design marketplace: browsing and searching public
 * designs, the designs an artist may use, and getting one. A paid design is
 * bought straight from the designer, as a direct charge on their own Stripe
 * account, never through the listener cart.
 */
export class DesignMarketplaceService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY),
    private readonly access: AccessService = new AccessService(db),
    private readonly gate: SellingGateService = new SellingGateService(db),
    private readonly webAppUrl: string = env.WEB_APP_URL,
  ) {}

  /**
   * Public designs for a surface, newest first.
   */
  public browse(
    surface: DesignSurface = 'release',
    limit?: number,
    offset?: number,
  ): Promise<Design[]> {
    return this.db.designs.listMarketplace(surface, limit, offset);
  }

  /**
   * Search public designs by name.
   */
  public search(query: string, surface?: DesignSurface): Promise<Design[]> {
    return this.db.designs.searchMarketplace(query, surface);
  }

  /**
   * A public design's marketplace page.
   *
   * @throws ApiError 404 unless the design is listed.
   */
  public async getDesign(designId: string): Promise<MarketplaceDesign> {
    const design = await this.db.designs.getById(designId);
    const latest = design && (await this.db.designs.getLatestVersion(designId));
    if (!design || !latest || !this.isListed(design)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Design not found.',
      );
    }

    return {
      design: {
        id: design.id,
        name: design.name,
        description: design.description,
        surface: design.surface,
        pricingMode: design.pricingMode,
        currency: design.currency,
        minimumPrice: design.minimumPrice,
        suggestedPrice: design.suggestedPrice,
        styles: design.styles,
        publishedAt: design.publishedAt,
      },
      slots: latest.slots,
      latestVersion: latest.version,
    };
  }

  /**
   * The designs an artist may use: bought, claimed, or granted privately.
   */
  public async listLicensed(
    userId: string,
    artistId: string,
  ): Promise<Design[]> {
    await this.access.requireManager(userId, artistId);
    return this.db.designs.listLicensedDesigns(artistId);
  }

  /**
   * Get a design for an artist: claimed at once when it is free or the
   * manager names a price of zero, otherwise paid for on the designer's own
   * Stripe checkout page.
   *
   * @param amount - What to pay for a name-your-price design, or above a
   * fixed price. Defaults to the suggested or fixed price.
   * @throws ApiError 400 for an amount below the price, 404 unless the design
   * is listed, 409 when its designer cannot take payments right now.
   */
  public async acquire(
    userId: string,
    artistId: string,
    designId: string,
    amount?: number,
  ): Promise<DesignAcquisition> {
    await this.access.requireActiveUser(userId);
    await this.access.requireManager(userId, artistId);
    const design = await this.db.designs.getById(designId);
    if (await this.db.designs.hasLicense(designId, artistId)) {
      return { status: 'licensed' };
    }
    // private designs reach artists only through the designer's grant
    if (!design || !this.isListed(design) || !design.designerUserId) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Design not found.',
      );
    }

    const price =
      design.pricingMode === 'free'
        ? 0
        : (amount ?? design.suggestedPrice ?? design.minimumPrice);
    if (!Number.isInteger(price) || price < design.minimumPrice) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `${design.name} costs at least ${formatMoney(design.minimumPrice, design.currency ?? 'usd')}.`,
      );
    }
    if (price === 0) {
      await this.db.designs.grantLicense({
        designId,
        artistId,
        source: 'free',
        acquiredByUserId: userId,
      });
      return { status: 'licensed' };
    }

    const designerUserId = design.designerUserId;
    const currency = design.currency as Currency;
    const payout =
      await this.db.payments.getAccountByDesignerUserId(designerUserId);
    if (!payout || !(await this.gate.canSell({ designerUserId }, currency))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        "This design's designer cannot take payments right now.",
      );
    }

    const metadata = {
      purpose: DESIGN_LICENSE_PURPOSE,
      designId,
      artistId,
      userId,
    };
    const returnUrl = `${this.webAppUrl}/studio/artists/${artistId}/designs`;
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer_email: (await this.db.users.getEmail(userId)) ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency,
              unit_amount: price,
              product_data: { name: `${design.name} (page design license)` },
            },
          },
        ],
        payment_intent_data: {
          description: `IME page design: ${design.name}`,
          metadata,
        },
        metadata,
        success_url: `${returnUrl}?acquired=${designId}`,
        cancel_url: `${this.webAppUrl}/studio/marketplace/${designId}`,
      },
      { stripeAccount: payout.stripeAccountId },
    );
    return { status: 'payment', url: session.url as string };
  }

  /**
   * Record a design purchase once it settles, as when Stripe's Connect
   * webhook reports a completed Checkout Session. Safe to repeat.
   */
  public async recordPaidSession(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const { purpose, designId, artistId, userId } = session.metadata ?? {};
    if (
      purpose !== DESIGN_LICENSE_PURPOSE ||
      session.payment_status !== 'paid' ||
      typeof session.payment_intent !== 'string'
    ) {
      return;
    }

    await this.db.designs.recordPurchase({
      designId,
      artistId,
      acquiredByUserId: userId,
      amount: session.amount_total ?? 0,
      currency: session.currency as Currency,
      stripePaymentIntentId: session.payment_intent,
    });
  }

  /**
   * Refund a design purchase in full from the designer's Stripe account, as
   * when an admin takes the design down. Callers check permission.
   */
  public async refundPurchase(license: DesignLicense): Promise<void> {
    const design = await this.db.designs.getById(license.designId);
    const payout =
      design?.designerUserId &&
      (await this.db.payments.getAccountByDesignerUserId(
        design.designerUserId,
      ));
    if (!payout || !license.stripePaymentIntentId) return;

    await this.stripe.refunds.create(
      { payment_intent: license.stripePaymentIntentId },
      {
        stripeAccount: payout.stripeAccountId,
        idempotencyKey: `design-refund-${license.stripePaymentIntentId}`,
      },
    );
    await this.recordRefund(license.stripePaymentIntentId);
  }

  /**
   * Apply a full refund of a design purchase: the license ends and the
   * artist's releases using the design return to the default layout. Works
   * the same for refunds from the designer's Stripe dashboard and disputes
   * they lost. Safe to repeat.
   *
   * @returns True when this call applied it.
   */
  public async recordRefund(paymentIntentId: string): Promise<boolean> {
    return this.db.transaction(async (repos) => {
      const license = await repos.designs.markRefunded(paymentIntentId);
      if (!license) return false;
      await repos.designs.clearDesignFromArtist(
        license.designId,
        license.artistId,
      );
      return true;
    });
  }

  /**
   * Listed on the marketplace: published, public, and not off sale.
   */
  private isListed(design: Design): boolean {
    return (
      design.status === 'published' &&
      design.visibility === 'public' &&
      !design.offSaleAt
    );
  }
}
