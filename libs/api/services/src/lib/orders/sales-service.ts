import Stripe from 'stripe';
import {
  type ArtistOrder,
  DatabaseRepository,
  type Fulfillment,
  type OrderItemDetail,
  type SaleListItem,
  type SalesTotals,
} from '@ime/db';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { Logger } from '@ime/utils';
import { AccessService } from '../access/access-service';
import { EmailService, orderEmails } from '../email';

const TRACKING_MAX_LENGTH = 100;
const CARRIER_MAX_LENGTH = 50;

/**
 * One sale with everything needed to pack and ship it.
 */
export interface SaleDetail {
  sale: ArtistOrder;
  items: OrderItemDetail[];
  fulfillment: Fulfillment | null;
  buyerName: string | null;
  shippingAddress: unknown;
}

export interface ShipmentInput {
  trackingNumber?: string | null;
  carrier?: string | null;
}

/**
 * Selling, for an artist's managers: their sales, shipping physical orders,
 * refunds, and settled totals. A manager only ever sees their own artist's
 * portion of an order.
 */
export class SalesService {
  private readonly log = new Logger('api').child('sales');

  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY),
    private readonly access: AccessService = new AccessService(db),
    private readonly email: EmailService = new EmailService(),
    private readonly webAppUrl: string = env.WEB_APP_URL,
  ) {}

  /**
   * An artist's sales, newest first.
   */
  public async listSales(
    userId: string,
    artistId: string,
    limit?: number,
    offset?: number,
  ): Promise<SaleListItem[]> {
    await this.access.requireManager(userId, artistId);
    return this.db.orders.listSalesByArtist(artistId, limit, offset);
  }

  /**
   * Paid sales still waiting to ship, oldest first so the longest wait is
   * packed next.
   */
  public async listToShip(
    userId: string,
    artistId: string,
  ): Promise<SaleListItem[]> {
    await this.access.requireManager(userId, artistId);
    return this.db.orders.listUnfulfilledSales(artistId);
  }

  /**
   * Settled sales totals, one per currency.
   */
  public async getTotals(
    userId: string,
    artistId: string,
  ): Promise<SalesTotals[]> {
    await this.access.requireManager(userId, artistId);
    return this.db.orders.listSalesTotals(artistId);
  }

  /**
   * One sale, with its lines, buyer, address, and shipping progress.
   *
   * @throws ApiError 404 when the sale does not exist, 403 when the user does
   * not manage its artist.
   */
  public async getSale(
    userId: string,
    artistOrderId: string,
  ): Promise<SaleDetail> {
    const sale = await this.requireSale(userId, artistOrderId);
    const [order, items, fulfillment] = await Promise.all([
      this.db.orders.getOrderById(sale.orderId),
      this.db.orders.listOrderItemDetails(sale.id),
      this.db.orders.getFulfillment(sale.id),
    ]);
    const buyer = order?.userId
      ? await this.db.users.getById(order.userId)
      : null;

    return {
      sale,
      items,
      fulfillment,
      buyerName: buyer?.name ?? buyer?.username ?? null,
      shippingAddress: order?.shippingAddress ?? null,
    };
  }

  /**
   * Mark a sale shipped, with how to track it, and email the buyer.
   * Correcting the tracking of a shipped sale keeps its ship date.
   *
   * @throws ApiError 400 for tracking details that are too long, 409 when the
   * sale has nothing to ship, is not settled, or was delivered.
   */
  public async markShipped(
    userId: string,
    artistOrderId: string,
    input: ShipmentInput,
  ): Promise<void> {
    const sale = await this.requireSale(userId, artistOrderId);
    const fulfillment = await this.requireShippable(sale);
    if (fulfillment.status === 'delivered') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'This order was already delivered.',
      );
    }
    const trackingNumber = input.trackingNumber?.trim() || null;
    const carrier = input.carrier?.trim() || null;
    if (
      (trackingNumber?.length ?? 0) > TRACKING_MAX_LENGTH ||
      (carrier?.length ?? 0) > CARRIER_MAX_LENGTH
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Tracking numbers are up to ${TRACKING_MAX_LENGTH} characters and carriers up to ${CARRIER_MAX_LENGTH}.`,
      );
    }

    await this.db.orders.markShipped(sale.id, { trackingNumber, carrier });
    if (fulfillment.status === 'shipped') return;

    try {
      const [buyer, artist] = await Promise.all([
        this.buyerEmail(sale),
        this.db.artists.getById(sale.artistId),
      ]);
      if (buyer) {
        await this.email.send(
          orderEmails.shipped(
            buyer,
            artist?.name ?? 'The artist',
            { trackingNumber, carrier },
            `${this.webAppUrl}/purchases`,
          ),
        );
      }
    } catch (error) {
      this.log.error(`could not email about shipping ${sale.id}`, error);
    }
  }

  /**
   * Mark a shipped sale delivered.
   *
   * @throws ApiError 409 when it has not shipped.
   */
  public async markDelivered(
    userId: string,
    artistOrderId: string,
  ): Promise<void> {
    const sale = await this.requireSale(userId, artistOrderId);
    await this.requireShippable(sale);
    if (!(await this.db.orders.markDelivered(sale.id))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Only a shipped order can be marked delivered.',
      );
    }
  }

  /**
   * Refund a sale in full from the artist's Stripe account. The buyer loses
   * what it granted, and its merch goes back into stock.
   *
   * @throws ApiError 409 when the sale is not settled or already refunded.
   */
  public async refund(userId: string, artistOrderId: string): Promise<void> {
    const sale = await this.requireSale(userId, artistOrderId);
    await this.refundSale(sale);
  }

  /**
   * Refund a sale in full from the artist's Stripe account, as when an admin
   * takes down what it sold. Callers check permission.
   *
   * @throws ApiError 409 when the sale is not settled or already refunded.
   */
  public async refundSale(sale: ArtistOrder): Promise<void> {
    if (sale.status !== 'completed') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Only a settled sale can be refunded.',
      );
    }
    const payout = await this.db.payments.getAccountByArtistId(sale.artistId);
    if (!payout) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'The artist has no payment account to refund from.',
      );
    }

    await this.stripe.refunds.create(
      { payment_intent: sale.stripePaymentIntentId },
      {
        stripeAccount: payout.stripeAccountId,
        idempotencyKey: `refund-${sale.id}`,
      },
    );
    await this.recordRefund(sale.stripePaymentIntentId);
  }

  /**
   * Apply a full refund: the sale is marked refunded, the buyer loses what it
   * granted, and its merch goes back into stock. Works the same for refunds
   * from IME, from the artist's Stripe dashboard, and disputes the artist
   * lost. Safe to repeat.
   *
   * @returns True when this call applied it, false when the payment is not a
   * sale or was already refunded.
   */
  public async recordRefund(paymentIntentId: string): Promise<boolean> {
    const sale =
      await this.db.orders.getArtistOrderByPaymentIntentId(paymentIntentId);
    if (!sale) return false;

    const applied = await this.db.transaction(async (repos) => {
      if (!(await repos.orders.markRefunded(sale.id))) return false;
      await repos.entitlements.revokeByArtistOrderId(sale.id);
      await repos.products.restockArtistOrder(sale.id);
      return true;
    });
    if (!applied) return false;

    try {
      const [buyer, artist] = await Promise.all([
        this.buyerEmail(sale),
        this.db.artists.getById(sale.artistId),
      ]);
      if (buyer) {
        await this.email.send(
          orderEmails.refunded(
            buyer,
            artist?.name ?? 'The artist',
            sale,
            `${this.webAppUrl}/purchases`,
          ),
        );
      }
    } catch (error) {
      this.log.error(`could not email about refund ${sale.id}`, error);
    }
    return true;
  }

  private async requireSale(
    userId: string,
    artistOrderId: string,
  ): Promise<ArtistOrder> {
    const sale = await this.db.orders.getArtistOrderById(artistOrderId);
    if (!sale) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Sale not found.',
      );
    }
    await this.access.requireManager(userId, sale.artistId);
    return sale;
  }

  private async requireShippable(sale: ArtistOrder): Promise<Fulfillment> {
    const fulfillment = await this.db.orders.getFulfillment(sale.id);
    if (!fulfillment || sale.status !== 'completed') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        fulfillment
          ? 'Only a settled order can be shipped.'
          : 'This order has nothing to ship.',
      );
    }
    return fulfillment;
  }

  private async buyerEmail(sale: ArtistOrder): Promise<string | null> {
    const order = await this.db.orders.getOrderById(sale.orderId);
    return order?.userId ? this.db.users.getEmail(order.userId) : null;
  }
}
