import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import {
  type CheckoutItemParams,
  type CheckoutVariant,
  type Currency,
  DatabaseRepository,
  InsufficientStockError,
  type ShippingAddress,
  type ShippingZone,
} from '@ime/db';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { Logger } from '@ime/utils';
import { EmailService, orderEmails } from '../email';
import { formatMoney } from '@ime/utils';
import { SellingGateService } from '../selling';
import { toEmailLines } from './order-lines';

/** Marks a Checkout Session as a cart, for the webhook that records it. */
export const ORDER_PURPOSE = 'order';

/** Enough for any real cart, small enough to catch a mistyped quantity. */
const MAX_QUANTITY = 99;
/** Stripe Checkout takes at most this many line items. */
const MAX_LINES_PER_ARTIST = 100;

/**
 * One thing in a cart: a digital release, or units of a merch variant.
 */
export type CartItem =
  | {
      releaseId: string;
      /**
       * What the buyer chose to pay for a name-your-price release, or to pay
       * above a fixed price. Defaults to the suggested or fixed price.
       */
      amount?: number;
    }
  | { variantId: string; quantity: number };

export type { ShippingAddress };

export interface CheckoutInput {
  items: CartItem[];
  /** Required when the cart has anything physical. */
  shippingAddress?: ShippingAddress | null;
}

/**
 * One artist's portion of a cart, paid on Stripe's checkout page.
 */
export interface ArtistPayment {
  artistId: string;
  artistName: string;
  currency: Currency;
  /** Items, before shipping and tax. */
  subtotal: number;
  shipping: number;
  /** Stripe's checkout page, where the buyer pays this artist. */
  url: string;
}

/**
 * A started checkout. Free releases are already in the buyer's library; each
 * artist with something to pay for gets one payment, made in turn.
 */
export interface StartedCheckout {
  orderId: string;
  claimedReleaseIds: string[];
  payments: ArtistPayment[];
}

/** A line as checkout prices it, before it is grouped by artist. */
interface PricedLine {
  artistId: string;
  currency: Currency | null;
  name: string;
  unitPrice: number;
  quantity: number;
  releaseId?: string;
  variant?: CheckoutVariant;
}

/**
 * Buying: a buyer's cart becomes one payment per artist, each a direct charge
 * on that artist's own Stripe account, so IME never holds the money. Taxes
 * follow each artist's own Stripe Tax settings.
 *
 * An order is recorded only once its payment settles, from Stripe's webhook.
 * Stock is claimed at that moment, so the last unit is never sold twice; a
 * payment for something that sold out meanwhile is refunded in full.
 */
export class CheckoutService {
  private readonly log = new Logger('api').child('checkout');

  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY),
    private readonly gate: SellingGateService = new SellingGateService(db),
    private readonly email: EmailService = new EmailService(),
    private readonly webAppUrl: string = env.WEB_APP_URL,
  ) {}

  /**
   * Check a cart out: grant whatever is free and start one payment per
   * artist.
   *
   * @throws ApiError 400 for an invalid cart or a missing address, 409 when
   * something is no longer for sale, is already owned, is out of stock, or
   * does not ship to the address.
   */
  public async start(
    userId: string,
    input: CheckoutInput,
  ): Promise<StartedCheckout> {
    if (!(await this.db.users.getById(userId))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'User not found.',
      );
    }
    if (input.items.length === 0) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'The cart is empty.',
      );
    }

    const lines = [
      ...(await this.priceReleases(userId, input.items)),
      ...(await this.priceVariants(input.items)),
    ];
    const physical = lines.some((line) => line.variant);
    if (physical && !input.shippingAddress) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Add a shipping address for the merch in your cart.',
      );
    }

    const orderId = randomUUID();
    const claimedReleaseIds = lines
      .filter((line) => line.releaseId && line.unitPrice === 0)
      .map((line) => line.releaseId as string);
    const paid = lines.filter((line) => line.variant || line.unitPrice > 0);

    const payments: ArtistPayment[] = [];
    for (const [artistId, artistLines] of this.byArtist(paid)) {
      payments.push(
        await this.startPayment(
          orderId,
          userId,
          artistId,
          artistLines,
          input.shippingAddress ?? null,
        ),
      );
    }

    // granted last, so a cart that fails above grants nothing
    await this.db.entitlements.grantMany(
      claimedReleaseIds.map((releaseId) => ({
        userId,
        releaseId,
        source: 'free' as const,
      })),
    );

    return { orderId, claimedReleaseIds, payments };
  }

  /**
   * Record a cart payment once it settles, as when Stripe's Connect webhook
   * reports a completed Checkout Session. Grants what was bought, emails the
   * buyer and the artist's managers, and refunds the payment in full when
   * something sold out meanwhile. Safe to repeat for the same session.
   *
   * @param stripeAccountId - The artist's account the session was paid on.
   */
  public async recordPaidSession(
    session: Stripe.Checkout.Session,
    stripeAccountId: string,
  ): Promise<void> {
    const { purpose, orderId, userId, artistId } = session.metadata ?? {};
    if (
      purpose !== ORDER_PURPOSE ||
      session.payment_status !== 'paid' ||
      typeof session.payment_intent !== 'string'
    ) {
      return;
    }
    const paymentIntentId = session.payment_intent;
    if (await this.db.orders.getArtistOrderByPaymentIntentId(paymentIntentId)) {
      return;
    }

    const options = { stripeAccount: stripeAccountId };
    const [intent, lineItems] = await Promise.all([
      this.stripe.paymentIntents.retrieve(
        paymentIntentId,
        { expand: ['latest_charge'] },
        options,
      ),
      this.stripe.checkout.sessions.listLineItems(
        session.id,
        { limit: MAX_LINES_PER_ARTIST, expand: ['data.price.product'] },
        options,
      ),
    ]);

    // a payment refunded because it sold out stays unrecorded, even if this
    // event arrives again after the stock came back
    if ((intent.latest_charge as Stripe.Charge | null)?.refunded) return;

    const items: CheckoutItemParams[] = lineItems.data.map((line) => {
      const { releaseId, variantId } = (line.price?.product as Stripe.Product)
        .metadata;
      return {
        releaseId: releaseId || null,
        productVariantId: variantId || null,
        quantity: line.quantity ?? 1,
        unitPrice: line.price?.unit_amount ?? 0,
      };
    });

    try {
      await this.db.transaction(async (repos) => {
        const recorded = await repos.orders.createCheckout({
          orderId,
          userId,
          shippingAddress:
            intent.shipping && toShippingAddress(intent.shipping),
          artistOrders: [
            {
              artistId,
              currency: session.currency as Currency,
              amount: session.amount_total ?? 0,
              shippingAmount: session.total_details?.amount_shipping ?? 0,
              taxAmount: session.total_details?.amount_tax ?? 0,
              stripePaymentIntentId: paymentIntentId,
              items,
            },
          ],
        });
        if (recorded.alreadyRecorded) return;

        const [artistOrderId] = recorded.artistOrderIds;
        await repos.orders.setArtistOrderStatus(artistOrderId, 'completed');
        const grants = await repos.orders.listGrantableReleases(artistOrderId);
        await repos.entitlements.grantMany(
          grants.map((grant) => ({
            userId,
            releaseId: grant.releaseId,
            source: 'purchase' as const,
            orderItemId: grant.orderItemId,
          })),
        );
      });
    } catch (error) {
      if (!(error instanceof InsufficientStockError)) throw error;
      await this.refundSoldOut(
        paymentIntentId,
        stripeAccountId,
        userId,
        artistId,
      );
      return;
    }

    await this.notify(paymentIntentId, userId, artistId);
  }

  /**
   * Price the releases in a cart: free ones cost nothing, paid ones at least
   * their minimum.
   */
  private async priceReleases(
    userId: string,
    items: CartItem[],
  ): Promise<PricedLine[]> {
    const releaseItems = items.filter((item) => 'releaseId' in item);
    const ids = releaseItems.map((item) => item.releaseId);
    if (new Set(ids).size < ids.length) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'A release can only be in the cart once.',
      );
    }
    const owned = new Set(await this.db.entitlements.filterOwned(userId, ids));

    const lines: PricedLine[] = [];
    for (const item of releaseItems) {
      const release = await this.db.releases.getById(item.releaseId);
      const artist =
        release && (await this.db.artists.getById(release.artistId));
      const pricing =
        release && (await this.db.releases.getPricing(release.id));
      if (
        !release ||
        release.status !== 'published' ||
        !artist ||
        artist.suspendedAt ||
        artist.offSaleAt ||
        !pricing
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'A release in your cart is no longer available.',
        );
      }
      if (owned.has(release.id)) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          `You already own ${release.title}.`,
        );
      }

      const amount =
        pricing.mode === 'free'
          ? 0
          : (item.amount ?? pricing.suggestedPrice ?? pricing.minimumPrice);
      if (
        !Number.isInteger(amount) ||
        amount < pricing.minimumPrice ||
        (pricing.mode === 'free' && item.amount)
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.BadRequest,
          pricing.mode === 'free'
            ? `${release.title} is free.`
            : `${release.title} costs at least ${formatMoney(pricing.minimumPrice, pricing.currency ?? 'usd')}.`,
        );
      }

      lines.push({
        artistId: release.artistId,
        currency: pricing.currency,
        name: `${release.title} (digital)`,
        unitPrice: amount,
        quantity: 1,
        releaseId: release.id,
      });
    }
    return lines;
  }

  /**
   * Price the merch in a cart from the variants' true prices, checking stock.
   */
  private async priceVariants(items: CartItem[]): Promise<PricedLine[]> {
    const variantItems = items.filter((item) => 'variantId' in item);
    const ids = variantItems.map((item) => item.variantId);
    if (new Set(ids).size < ids.length) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Combine units of the same item into one quantity.',
      );
    }
    const variants = new Map(
      (await this.db.products.listVariantsForCheckout(ids)).map((variant) => [
        variant.variantId,
        variant,
      ]),
    );

    const lines: PricedLine[] = [];
    for (const item of variantItems) {
      const variant = variants.get(item.variantId);
      const artist =
        variant && (await this.db.artists.getById(variant.artistId));
      if (
        !variant ||
        variant.productStatus !== 'published' ||
        !artist ||
        artist.suspendedAt ||
        artist.offSaleAt
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'An item in your cart is no longer available.',
        );
      }
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > MAX_QUANTITY
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.BadRequest,
          `Quantities are 1 to ${MAX_QUANTITY}.`,
        );
      }
      if (variant.stock < item.quantity) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          variant.stock === 0
            ? `${variant.productName} is sold out.`
            : `Only ${variant.stock} of ${variant.productName} left.`,
        );
      }

      const options = [
        variant.option1Value,
        variant.option2Value,
        variant.option3Value,
      ].filter(Boolean);
      lines.push({
        artistId: variant.artistId,
        currency: variant.currency,
        name: options.length
          ? `${variant.productName} (${options.join(', ')})`
          : variant.productName,
        unitPrice: variant.price,
        quantity: item.quantity,
        variant,
      });
    }
    return lines;
  }

  /**
   * Start one artist's Checkout Session on their own Stripe account.
   */
  private async startPayment(
    orderId: string,
    userId: string,
    artistId: string,
    lines: PricedLine[],
    address: ShippingAddress | null,
  ): Promise<ArtistPayment> {
    const [artist, payout] = await Promise.all([
      this.db.artists.getById(artistId),
      this.db.payments.getAccountByArtistId(artistId),
    ]);
    const currency = payout?.defaultCurrency;
    const artistName = artist?.name ?? 'This artist';
    if (
      !payout ||
      !currency ||
      lines.some((line) => line.currency !== currency) ||
      !(await this.gate.canSell({ artistId }, currency))
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        `${artistName} cannot take payments right now.`,
      );
    }
    if (lines.length > MAX_LINES_PER_ARTIST) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Split your order from ${artistName} into smaller carts.`,
      );
    }

    const options = { stripeAccount: payout.stripeAccountId };
    // the account itself, so a payout account Stripe just restricted cannot
    // start a charge
    const account = await this.stripe.accounts.retrieve(payout.stripeAccountId);
    if (!account.charges_enabled) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        `${artistName} cannot take payments right now.`,
      );
    }

    const shipping = address
      ? await this.shippingFor(
          lines,
          address.country === account.country ? 'domestic' : 'international',
        )
      : 0;
    const shippingDetails = address && {
      name: address.name,
      address: {
        line1: address.line1,
        line2: address.line2 ?? undefined,
        city: address.city,
        state: address.state ?? undefined,
        postal_code: address.postalCode,
        country: address.country,
      },
    };

    const user = await this.db.users.getById(userId);
    const customer = await this.stripe.customers.create(
      {
        email: (await this.db.users.getEmail(userId)) ?? undefined,
        name: shippingDetails?.name ?? user?.name ?? undefined,
        ...(shippingDetails && {
          address: shippingDetails.address,
          shipping: shippingDetails,
        }),
        metadata: { userId },
      },
      options,
    );
    const tax = await this.stripe.tax.settings.retrieve({}, options);
    const metadata = { purpose: ORDER_PURPOSE, orderId, userId, artistId };

    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer: customer.id,
        customer_update: { address: 'auto', shipping: 'auto' },
        automatic_tax: { enabled: tax.status === 'active' },
        line_items: lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency,
            unit_amount: line.unitPrice,
            product_data: {
              name: line.name,
              // what the webhook records the line as
              metadata: lineKey(line),
            },
          },
        })),
        ...(shippingDetails && {
          shipping_options: [
            {
              shipping_rate_data: {
                type: 'fixed_amount',
                display_name: 'Shipping',
                fixed_amount: { amount: shipping, currency },
              },
            },
          ],
        }),
        payment_intent_data: {
          description: `IME order from ${artistName}`,
          metadata,
          ...(shippingDetails && { shipping: shippingDetails }),
        },
        metadata,
        success_url: `${this.webAppUrl}/checkout/${orderId}?paid=${artistId}`,
        cancel_url: `${this.webAppUrl}/checkout/${orderId}?cancelled=${artistId}`,
      },
      options,
    );

    return {
      artistId,
      artistName,
      currency,
      subtotal: lines.reduce(
        (total, line) => total + line.unitPrice * line.quantity,
        0,
      ),
      shipping,
      url: session.url as string,
    };
  }

  /**
   * What an artist's merch costs to ship to one zone: per product, the first
   * unit's rate plus the additional rate for each unit after.
   *
   * @throws ApiError 409 when a product does not ship there.
   */
  private async shippingFor(
    lines: PricedLine[],
    zone: ShippingZone,
  ): Promise<number> {
    const units = new Map<string, { name: string; quantity: number }>();
    for (const line of lines) {
      if (!line.variant) continue;
      const product = units.get(line.variant.productId);
      units.set(line.variant.productId, {
        name: line.variant.productName,
        quantity: (product?.quantity ?? 0) + line.quantity,
      });
    }
    if (units.size === 0) return 0;

    const rates = new Map(
      (
        await this.db.products.listShippingRatesForProducts(
          [...units.keys()],
          zone,
        )
      ).map((rate) => [rate.productId, rate]),
    );

    let total = 0;
    for (const [productId, { name, quantity }] of units) {
      const rate = rates.get(productId);
      if (!rate) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          `${name} does not ship to addresses ${zone === 'domestic' ? "in the artist's own country" : "outside the artist's country"}.`,
        );
      }
      total +=
        rate.firstItemAmount + rate.additionalItemAmount * (quantity - 1);
    }
    return total;
  }

  private byArtist(lines: PricedLine[]): Map<string, PricedLine[]> {
    const groups = new Map<string, PricedLine[]>();
    for (const line of lines) {
      groups.set(line.artistId, [...(groups.get(line.artistId) ?? []), line]);
    }
    return groups;
  }

  /**
   * Refund a payment whose merch sold out before it settled, and tell the
   * buyer.
   */
  private async refundSoldOut(
    paymentIntentId: string,
    stripeAccountId: string,
    userId: string,
    artistId: string,
  ): Promise<void> {
    await this.stripe.refunds.create(
      { payment_intent: paymentIntentId, reason: 'requested_by_customer' },
      {
        stripeAccount: stripeAccountId,
        // a redelivered webhook refunds once
        idempotencyKey: `sold-out-${paymentIntentId}`,
      },
    );

    try {
      const [address, artist] = await Promise.all([
        this.db.users.getEmail(userId),
        this.db.artists.getById(artistId),
      ]);
      if (address) {
        await this.email.send(
          orderEmails.soldOut(
            address,
            artist?.name ?? 'the artist',
            `${this.webAppUrl}/cart`,
          ),
        );
      }
    } catch (error) {
      this.log.error(`could not email about refund ${paymentIntentId}`, error);
    }
  }

  /**
   * Email the buyer a receipt and the artist's managers a sale notice. A
   * failure is logged, since the order is already recorded.
   */
  private async notify(
    paymentIntentId: string,
    userId: string,
    artistId: string,
  ): Promise<void> {
    try {
      const order =
        await this.db.orders.getArtistOrderByPaymentIntentId(paymentIntentId);
      if (!order) return;
      const [artist, items, buyer, managers] = await Promise.all([
        this.db.artists.getById(artistId),
        this.db.orders.listOrderItemDetails(order.id),
        this.db.users.getEmail(userId),
        this.db.artists.listManagers(artistId),
      ]);
      const artistName = artist?.name ?? 'The artist';
      const lines = toEmailLines(items);

      if (buyer) {
        await this.email.send(
          orderEmails.receipt(
            buyer,
            artistName,
            lines,
            order,
            `${this.webAppUrl}/purchases`,
          ),
        );
      }
      for (const manager of managers) {
        const address = await this.db.users.getEmail(manager.userId);
        if (!address) continue;
        await this.email.send(
          orderEmails.sale(
            address,
            artistName,
            lines,
            order,
            items.some((item) => item.productVariantId),
            `${this.webAppUrl}/manage/artists/${artistId}/sales`,
          ),
        );
      }
    } catch (error) {
      this.log.error(`could not email about payment ${paymentIntentId}`, error);
    }
  }
}

function toShippingAddress(
  shipping: Stripe.PaymentIntent.Shipping,
): ShippingAddress {
  return {
    name: shipping.name ?? '',
    line1: shipping.address?.line1 ?? '',
    line2: shipping.address?.line2 ?? null,
    city: shipping.address?.city ?? '',
    state: shipping.address?.state ?? null,
    postalCode: shipping.address?.postal_code ?? '',
    country: shipping.address?.country ?? '',
  };
}

function lineKey(line: PricedLine): Record<string, string> {
  return line.variant
    ? { variantId: line.variant.variantId }
    : { releaseId: line.releaseId as string };
}
