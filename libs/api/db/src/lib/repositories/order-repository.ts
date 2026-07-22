import { and, count, desc, eq, gte, inArray, sql, sum } from 'drizzle-orm';
import type { Db, DbTransaction } from '../database-service';
import {
  type ArtistOrder,
  artistOrders,
  type ArtistOrderStatus,
  artists,
  type Currency,
  type Fulfillment,
  fulfillments,
  type FulfillmentStatus,
  type Order,
  orderItems,
  orders,
  products,
  productVariants,
  releases,
  users
} from '../tables';

/**
 * Raised when a checkout asks for more units of a variant than are in stock.
 * The checkout is rolled back whole, so nothing is charged or reserved.
 */
export class InsufficientStockError extends Error {
  constructor(public readonly variantIds: string[]) {
    super(`Insufficient stock for variants: ${variantIds.join(', ')}`);
    this.name = 'InsufficientStockError';
  }
}

export interface CheckoutItemParams {
  releaseId?: string | null;
  productVariantId?: string | null;
  quantity?: number;
  unitPrice: number;
}

export interface CheckoutArtistOrderParams {
  artistId: string;
  currency: Currency;
  amount: number;
  shippingAmount?: number;
  taxAmount?: number;
  stripePaymentIntentId: string;
  items: CheckoutItemParams[];
}

export interface CreateCheckoutParams {
  userId: string;
  shippingAddress?: Record<string, unknown> | null;
  artistOrders: CheckoutArtistOrderParams[];
}

export interface CreatedCheckout {
  orderId: string;
  artistOrderIds: string[];
  /** True when this payment was already recorded and nothing new was written. */
  alreadyRecorded: boolean;
}

/**
 * A release a settled order entitles the buyer to, whether bought directly or
 * bundled with a physical item.
 */
export interface GrantableRelease {
  releaseId: string;
  orderItemId: string;
}

/**
 * A line item with the name of whatever was bought, resolved from either the
 * release or the product variant.
 */
export interface OrderItemDetail {
  id: string;
  releaseId: string | null;
  productVariantId: string | null;
  name: string;
  variantLabel: string | null;
  quantity: number;
  unitPrice: number;
}

/**
 * One artist's portion of a past order, as the buyer sees it in their history.
 */
export interface PurchaseListItem {
  artistOrderId: string;
  orderId: string;
  artistId: string;
  artistName: string;
  status: ArtistOrderStatus;
  amount: number;
  currency: Currency;
  createdAt: Date;
  fulfillmentStatus: FulfillmentStatus | null;
  trackingNumber: string | null;
  carrier: string | null;
}

/**
 * One sale as the selling artist sees it, carrying what they need to ship it.
 */
export interface SaleListItem {
  artistOrderId: string;
  orderId: string;
  status: ArtistOrderStatus;
  amount: number;
  shippingAmount: number;
  taxAmount: number;
  currency: Currency;
  createdAt: Date;
  buyerName: string | null;
  shippingAddress: unknown;
  fulfillmentStatus: FulfillmentStatus | null;
  trackingNumber: string | null;
}

/**
 * An artist's settled sales, totalled per currency.
 */
export interface SalesTotals {
  currency: Currency;
  orderCount: number;
  grossAmount: number;
  shippingAmount: number;
  taxAmount: number;
}

export interface MarkShippedParams {
  trackingNumber?: string | null;
  carrier?: string | null;
}

const DEFAULT_LIST_LIMIT = 24;

/**
 * Queries for the purchase lifecycle: the cart a buyer paid for, each artist's
 * slice of it, the lines within, and the shipping that follows.
 */
export class OrderRepository {
  private readonly saleColumns = {
    artistOrderId: artistOrders.id,
    orderId: orders.id,
    status: artistOrders.status,
    amount: artistOrders.amount,
    shippingAmount: artistOrders.shippingAmount,
    taxAmount: artistOrders.taxAmount,
    currency: artistOrders.currency,
    createdAt: artistOrders.createdAt,
    buyerName: users.name,
    shippingAddress: orders.shippingAddress,
    fulfillmentStatus: fulfillments.status,
    trackingNumber: fulfillments.trackingNumber,
  };

  constructor(private readonly db: Db) {}

  /**
   * Record a settled checkout: the order, one artist order per selling artist,
   * their line items, and a fulfillment for anything that ships. Stock is
   * claimed for every physical line as part of the same write.
   *
   * @param params - The buyer, the shipping address collected at checkout, and
   * each artist's slice of the cart with its Stripe payment intent.
   * @returns The ids written, and whether this payment had already been
   * recorded by an earlier delivery of the same webhook.
   * @throws InsufficientStockError when a variant has fewer units than the
   * order claims, leaving nothing written.
   */
  public async createCheckout(
    params: CreateCheckoutParams,
  ): Promise<CreatedCheckout> {
    return this.db.transaction(async (tx) => {
      const recorded = await this.findRecordedCheckout(tx, params.artistOrders);
      if (recorded) return recorded;

      const [order] = await tx
        .insert(orders)
        .values({
          userId: params.userId,
          shippingAddress: params.shippingAddress,
        })
        .returning({ id: orders.id });

      const artistOrderIds: string[] = [];
      const shortVariantIds: string[] = [];

      for (const artistOrder of params.artistOrders) {
        artistOrderIds.push(
          await this.insertArtistOrder(tx, order.id, artistOrder),
        );
        shortVariantIds.push(...(await this.claimStock(tx, artistOrder.items)));
      }

      if (shortVariantIds.length > 0) {
        throw new InsufficientStockError(shortVariantIds);
      }

      return { orderId: order.id, artistOrderIds, alreadyRecorded: false };
    });
  }

  /**
   * Move an artist order through its payment lifecycle.
   *
   * @param artistOrderId - The id of the artist order to update.
   * @param status - The status the charge has reached.
   */
  public async setArtistOrderStatus(
    artistOrderId: string,
    status: ArtistOrderStatus,
  ): Promise<void> {
    await this.db
      .update(artistOrders)
      .set({
        status,
        refundedAt: status === 'refunded' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(artistOrders.id, artistOrderId));
  }

  /**
   * List the releases a settled artist order entitles its buyer to.
   *
   * @param artistOrderId - The id of the settled artist order.
   * @returns One entry per release bought outright or bundled with a physical
   * item, each with the line item that granted it.
   */
  public async listGrantableReleases(
    artistOrderId: string,
  ): Promise<GrantableRelease[]> {
    // a physical line grants its product's release only when that product is
    // sold as a bundle
    const grantableReleaseId = sql<string>`coalesce(${orderItems.releaseId}, ${products.releaseId})`;

    return this.db
      .select({
        releaseId: grantableReleaseId,
        orderItemId: orderItems.id,
      })
      .from(orderItems)
      .leftJoin(
        productVariants,
        eq(productVariants.id, orderItems.productVariantId),
      )
      .leftJoin(
        products,
        and(
          eq(products.id, productVariants.productId),
          eq(products.includesDigital, true),
        ),
      )
      .where(
        and(
          eq(orderItems.artistOrderId, artistOrderId),
          sql`${grantableReleaseId} is not null`,
        ),
      );
  }

  /**
   * Find a checkout by its id.
   *
   * @param orderId - The id of the order to look up.
   * @returns The order row, or null when no order has that id.
   */
  public async getOrderById(orderId: string): Promise<Order | null> {
    const [order] = await this.db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    return order ?? null;
  }

  /**
   * Find one artist's portion of an order by its id.
   *
   * @param artistOrderId - The id of the artist order to look up.
   * @returns The artist order row, or null when none has that id.
   */
  public async getArtistOrderById(
    artistOrderId: string,
  ): Promise<ArtistOrder | null> {
    const [artistOrder] = await this.db
      .select()
      .from(artistOrders)
      .where(eq(artistOrders.id, artistOrderId))
      .limit(1);

    return artistOrder ?? null;
  }

  /**
   * Find the artist order a Stripe charge paid for, as when handling a webhook.
   *
   * @param stripePaymentIntentId - The payment intent behind the charge.
   * @returns The artist order row, or null when the charge is not on file.
   */
  public async getArtistOrderByPaymentIntentId(
    stripePaymentIntentId: string,
  ): Promise<ArtistOrder | null> {
    const [artistOrder] = await this.db
      .select()
      .from(artistOrders)
      .where(eq(artistOrders.stripePaymentIntentId, stripePaymentIntentId))
      .limit(1);

    return artistOrder ?? null;
  }

  /**
   * List the per-artist slices a checkout broke into.
   *
   * @param orderId - The id of the parent order.
   * @returns The artist order rows belonging to it.
   */
  public async listArtistOrdersForOrder(
    orderId: string,
  ): Promise<ArtistOrder[]> {
    return this.db
      .select()
      .from(artistOrders)
      .where(eq(artistOrders.orderId, orderId));
  }

  /**
   * List what was bought in an artist order, named for display.
   *
   * @param artistOrderId - The id of the artist order whose lines to read.
   * @returns One entry per line with the release or product name, the variant
   * it was, and the price paid.
   */
  public async listOrderItemDetails(
    artistOrderId: string,
  ): Promise<OrderItemDetail[]> {
    return this.db
      .select({
        id: orderItems.id,
        releaseId: orderItems.releaseId,
        productVariantId: orderItems.productVariantId,
        name: sql<string>`coalesce(${releases.title}, ${products.name})`,
        // the option values a variant is made of, such as 'L / Black'
        variantLabel: sql<
          string | null
        >`nullif(concat_ws(' / ', ${productVariants.option1Value}, ${productVariants.option2Value}, ${productVariants.option3Value}), '')`,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
      })
      .from(orderItems)
      .leftJoin(releases, eq(releases.id, orderItems.releaseId))
      .leftJoin(
        productVariants,
        eq(productVariants.id, orderItems.productVariantId),
      )
      .leftJoin(products, eq(products.id, productVariants.productId))
      .where(eq(orderItems.artistOrderId, artistOrderId));
  }

  /**
   * List a buyer's purchase history, newest first.
   *
   * @param userId - The id of the buyer.
   * @param limit - The maximum number of purchases to return.
   * @param offset - How many purchases to skip, for paging.
   * @returns One entry per artist order the buyer paid for, with its shipping
   * progress when it ships.
   */
  public async listPurchases(
    userId: string,
    limit: number = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<PurchaseListItem[]> {
    return this.db
      .select({
        artistOrderId: artistOrders.id,
        orderId: orders.id,
        artistId: artists.id,
        artistName: artists.name,
        status: artistOrders.status,
        amount: artistOrders.amount,
        currency: artistOrders.currency,
        createdAt: artistOrders.createdAt,
        fulfillmentStatus: fulfillments.status,
        trackingNumber: fulfillments.trackingNumber,
        carrier: fulfillments.carrier,
      })
      .from(artistOrders)
      .innerJoin(orders, eq(orders.id, artistOrders.orderId))
      .innerJoin(artists, eq(artists.id, artistOrders.artistId))
      .leftJoin(fulfillments, eq(fulfillments.artistOrderId, artistOrders.id))
      .where(eq(orders.userId, userId))
      .orderBy(desc(artistOrders.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * List an artist's sales, newest first.
   *
   * @param artistId - The id of the selling artist.
   * @param limit - The maximum number of sales to return.
   * @param offset - How many sales to skip, for paging.
   * @returns One entry per artist order, with the buyer and address needed to
   * ship it.
   */
  public async listSalesByArtist(
    artistId: string,
    limit: number = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<SaleListItem[]> {
    return this.db
      .select(this.saleColumns)
      .from(artistOrders)
      .innerJoin(orders, eq(orders.id, artistOrders.orderId))
      .leftJoin(users, eq(users.id, orders.userId))
      .leftJoin(fulfillments, eq(fulfillments.artistOrderId, artistOrders.id))
      .where(eq(artistOrders.artistId, artistId))
      .orderBy(desc(artistOrders.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * List an artist's paid sales that still need shipping.
   *
   * @param artistId - The id of the selling artist.
   * @returns One entry per settled artist order awaiting shipment, oldest
   * first so the longest wait is packed next.
   */
  public async listUnfulfilledSales(artistId: string): Promise<SaleListItem[]> {
    return this.db
      .select(this.saleColumns)
      .from(artistOrders)
      .innerJoin(orders, eq(orders.id, artistOrders.orderId))
      .leftJoin(users, eq(users.id, orders.userId))
      .innerJoin(fulfillments, eq(fulfillments.artistOrderId, artistOrders.id))
      .where(
        and(
          eq(artistOrders.artistId, artistId),
          eq(artistOrders.status, 'completed'),
          eq(fulfillments.status, 'unfulfilled'),
        ),
      )
      .orderBy(artistOrders.createdAt);
  }

  /**
   * Total an artist's settled sales.
   *
   * @param artistId - The id of the selling artist.
   * @returns One total per currency the artist has sold in, empty when they
   * have no settled sales.
   */
  public async listSalesTotals(artistId: string): Promise<SalesTotals[]> {
    const totals = await this.db
      .select({
        currency: artistOrders.currency,
        orderCount: count(),
        grossAmount: sum(artistOrders.amount),
        shippingAmount: sum(artistOrders.shippingAmount),
        taxAmount: sum(artistOrders.taxAmount),
      })
      .from(artistOrders)
      .where(
        and(
          eq(artistOrders.artistId, artistId),
          eq(artistOrders.status, 'completed'),
        ),
      )
      .groupBy(artistOrders.currency);

    return totals.map((total) => ({
      currency: total.currency,
      orderCount: total.orderCount,
      grossAmount: Number(total.grossAmount ?? 0),
      shippingAmount: Number(total.shippingAmount ?? 0),
      taxAmount: Number(total.taxAmount ?? 0),
    }));
  }

  /**
   * Read the shipping progress of an artist order.
   *
   * @param artistOrderId - The id of the artist order.
   * @returns The fulfillment row, or null when the order ships nothing.
   */
  public async getFulfillment(
    artistOrderId: string,
  ): Promise<Fulfillment | null> {
    const [fulfillment] = await this.db
      .select()
      .from(fulfillments)
      .where(eq(fulfillments.artistOrderId, artistOrderId))
      .limit(1);

    return fulfillment ?? null;
  }

  /**
   * Mark an artist order as shipped and record how to track it.
   *
   * @param artistOrderId - The id of the artist order being shipped.
   * @param params - The tracking number and carrier the artist shipped with.
   */
  public async markShipped(
    artistOrderId: string,
    params: MarkShippedParams,
  ): Promise<void> {
    await this.db
      .update(fulfillments)
      .set({
        status: 'shipped',
        trackingNumber: params.trackingNumber,
        carrier: params.carrier,
        // correcting the tracking on an already shipped order keeps its ship date
        shippedAt: sql`coalesce(${fulfillments.shippedAt}, now())`,
        updatedAt: new Date(),
      })
      .where(eq(fulfillments.artistOrderId, artistOrderId));
  }

  /**
   * Mark a shipped artist order as delivered.
   *
   * @param artistOrderId - The id of the artist order that arrived.
   * @returns True when it was marked delivered, false when it has not shipped
   * yet and cannot arrive.
   */
  public async markDelivered(artistOrderId: string): Promise<boolean> {
    const delivered = await this.db
      .update(fulfillments)
      .set({ status: 'delivered', updatedAt: new Date() })
      .where(
        and(
          eq(fulfillments.artistOrderId, artistOrderId),
          eq(fulfillments.status, 'shipped'),
        ),
      )
      .returning({ artistOrderId: fulfillments.artistOrderId });

    return delivered.length > 0;
  }

  /**
   * Look for a checkout already written for these payments, since Stripe
   * redelivers webhooks.
   *
   * @param tx - The transaction recording the checkout.
   * @param checkoutArtistOrders - The artist orders being recorded, with their
   * payment intents.
   * @returns The ids of the checkout already on file, or null when these
   * payments are new.
   */
  private async findRecordedCheckout(
    tx: DbTransaction,
    checkoutArtistOrders: CheckoutArtistOrderParams[],
  ): Promise<CreatedCheckout | null> {
    const paymentIntentIds = checkoutArtistOrders.map(
      (artistOrder) => artistOrder.stripePaymentIntentId,
    );

    const [recorded] = await tx
      .select({ orderId: artistOrders.orderId })
      .from(artistOrders)
      .where(inArray(artistOrders.stripePaymentIntentId, paymentIntentIds))
      .limit(1);

    if (!recorded) return null;

    const existing = await tx
      .select({ id: artistOrders.id })
      .from(artistOrders)
      .where(eq(artistOrders.orderId, recorded.orderId));

    return {
      orderId: recorded.orderId,
      artistOrderIds: existing.map((artistOrder) => artistOrder.id),
      alreadyRecorded: true,
    };
  }

  /**
   * Write one artist's slice of a checkout: the artist order, its lines, and a
   * fulfillment when any of them ship.
   *
   * @param tx - The transaction recording the checkout.
   * @param orderId - The id of the parent order.
   * @param params - The artist's charge and what it covers.
   * @returns The id of the artist order written.
   */
  private async insertArtistOrder(
    tx: DbTransaction,
    orderId: string,
    params: CheckoutArtistOrderParams,
  ): Promise<string> {
    const [created] = await tx
      .insert(artistOrders)
      .values({
        orderId,
        artistId: params.artistId,
        currency: params.currency,
        amount: params.amount,
        shippingAmount: params.shippingAmount ?? 0,
        taxAmount: params.taxAmount ?? 0,
        stripePaymentIntentId: params.stripePaymentIntentId,
      })
      .returning({ id: artistOrders.id });

    await tx.insert(orderItems).values(
      params.items.map((item) => ({
        artistOrderId: created.id,
        releaseId: item.releaseId,
        productVariantId: item.productVariantId,
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice,
      })),
    );

    if (params.items.some((item) => item.productVariantId)) {
      await tx
        .insert(fulfillments)
        .values({ artistOrderId: created.id })
        .onConflictDoNothing();
    }

    return created.id;
  }

  /**
   * Take the ordered units of every physical line out of stock.
   *
   * @param tx - The transaction recording the checkout.
   * @param items - The lines being bought; digital ones are skipped.
   * @returns The ids of any variants that had too few units left, empty when
   * every line was claimed.
   */
  private async claimStock(
    tx: DbTransaction,
    items: CheckoutItemParams[],
  ): Promise<string[]> {
    const shortVariantIds: string[] = [];

    for (const item of items) {
      if (!item.productVariantId) continue;

      const quantity = item.quantity ?? 1;

      // the guard on stock is what keeps two buyers from claiming the same
      // last unit
      const claimed = await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} - ${quantity}` })
        .where(
          and(
            eq(productVariants.id, item.productVariantId),
            gte(productVariants.stock, quantity),
          ),
        )
        .returning({ id: productVariants.id });

      if (claimed.length === 0) shortVariantIds.push(item.productVariantId);
    }

    return shortVariantIds;
  }
}
