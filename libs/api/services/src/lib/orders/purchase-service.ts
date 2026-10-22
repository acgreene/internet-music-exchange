import {
  type ArtistOrder,
  DatabaseRepository,
  type Fulfillment,
  type OrderItemDetail,
  type PurchaseListItem,
} from '@ime/db';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { EmailService, orderEmails } from '../email';
import { toEmailLines } from './order-lines';

const MESSAGE_MAX_LENGTH = 2000;

/**
 * One purchase as its buyer sees it.
 */
export interface PurchaseDetail {
  purchase: ArtistOrder;
  artist: { id: string; name: string; handle: string } | null;
  items: OrderItemDetail[];
  fulfillment: Fulfillment | null;
}

/**
 * A buyer's side of what they bought: their purchase history, shipping
 * progress, and refund requests. Whether to refund is always the artist's
 * call, so a request emails the artist's managers.
 */
export class PurchaseService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly email: EmailService = new EmailService(),
    private readonly webAppUrl: string = env.WEB_APP_URL,
  ) {}

  /**
   * A buyer's purchases, newest first, one per artist they paid.
   */
  public listPurchases(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<PurchaseListItem[]> {
    return this.db.orders.listPurchases(userId, limit, offset);
  }

  /**
   * One of a buyer's purchases, with its lines and shipping progress.
   *
   * @throws ApiError 404 unless the purchase is the buyer's own.
   */
  public async getPurchase(
    userId: string,
    artistOrderId: string,
  ): Promise<PurchaseDetail> {
    const purchase = await this.requirePurchase(userId, artistOrderId);
    const [artist, items, fulfillment] = await Promise.all([
      this.db.artists.getById(purchase.artistId),
      this.db.orders.listOrderItemDetails(purchase.id),
      this.db.orders.getFulfillment(purchase.id),
    ]);

    return {
      purchase,
      artist: artist && {
        id: artist.id,
        name: artist.name,
        handle: artist.handle,
      },
      items,
      fulfillment,
    };
  }

  /**
   * Ask the artist for a refund. Their managers are emailed the order and the
   * buyer's message.
   *
   * @throws ApiError 400 for an empty or overlong message, 404 unless the
   * purchase is the buyer's own, 409 when it is not settled.
   */
  public async requestRefund(
    userId: string,
    artistOrderId: string,
    message: string,
  ): Promise<void> {
    const purchase = await this.requirePurchase(userId, artistOrderId);
    if (purchase.status !== 'completed') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Only a settled purchase can be refunded.',
      );
    }
    const trimmed = message.trim();
    if (!trimmed || trimmed.length > MESSAGE_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Tell the artist why, in up to ${MESSAGE_MAX_LENGTH} characters.`,
      );
    }

    const [artist, items, buyer, managers] = await Promise.all([
      this.db.artists.getById(purchase.artistId),
      this.db.orders.listOrderItemDetails(purchase.id),
      this.db.users.getById(userId),
      this.db.artists.listManagers(purchase.artistId),
    ]);
    const saleUrl = `${this.webAppUrl}/studio/artists/${purchase.artistId}/sales/${purchase.id}`;

    for (const manager of managers) {
      const address = await this.db.users.getEmail(manager.userId);
      if (!address) continue;
      await this.email.send(
        orderEmails.refundRequest(
          address,
          artist?.name ?? 'Your artist',
          buyer?.name ?? buyer?.username ?? 'A buyer',
          toEmailLines(items),
          purchase,
          trimmed,
          saleUrl,
        ),
      );
    }
  }

  private async requirePurchase(
    userId: string,
    artistOrderId: string,
  ): Promise<ArtistOrder> {
    const purchase = await this.db.orders.getArtistOrderById(artistOrderId);
    const order =
      purchase && (await this.db.orders.getOrderById(purchase.orderId));
    if (!purchase || order?.userId !== userId) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Purchase not found.',
      );
    }
    return purchase;
  }
}
