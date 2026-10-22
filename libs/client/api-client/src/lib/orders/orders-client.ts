import {
  type AckResponse,
  ApiRoute,
  type CheckoutRequest,
  type PageQuery,
  type PurchaseDetail,
  type PurchaseListItem,
  type SaleDetail,
  type SaleListItem,
  type SalesTotals,
  type ShipmentRequest,
  type StartedCheckout,
} from '@ime/models';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

/**
 * Buying and selling. A checkout returns one payment per artist; send the
 * buyer to each payment's Stripe page in turn. Purchases appear once each
 * payment settles.
 */
export class OrdersClient {
  constructor(private readonly transport: ApiTransport) {}

  /**
   * Check a cart out. Free releases are granted at once.
   */
  public checkout(cart: CheckoutRequest): Promise<ApiResult<StartedCheckout>> {
    return this.transport.post(ApiRoute.Checkout, { body: cart });
  }

  /**
   * The signed-in user's purchases, newest first.
   */
  public listPurchases(
    page?: PageQuery,
  ): Promise<ApiResult<PurchaseListItem[]>> {
    return this.transport.get(ApiRoute.MyPurchases, { query: page });
  }

  public getPurchase(
    artistOrderId: string,
  ): Promise<ApiResult<PurchaseDetail>> {
    return this.transport.get(ApiRoute.Purchase, {
      params: { artistOrderId },
    });
  }

  /**
   * Ask the artist for a refund. Their managers are emailed the message.
   */
  public requestRefund(
    artistOrderId: string,
    message: string,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.PurchaseRefundRequest, {
      params: { artistOrderId },
      body: { message },
    });
  }

  /**
   * An artist's sales, newest first.
   */
  public listSales(
    artistId: string,
    page?: PageQuery,
  ): Promise<ApiResult<SaleListItem[]>> {
    return this.transport.get(ApiRoute.ArtistSales, {
      params: { artistId },
      query: page,
    });
  }

  /**
   * Paid sales still waiting to ship, oldest first.
   */
  public listToShip(artistId: string): Promise<ApiResult<SaleListItem[]>> {
    return this.transport.get(ApiRoute.ArtistSalesToShip, {
      params: { artistId },
    });
  }

  public getTotals(artistId: string): Promise<ApiResult<SalesTotals[]>> {
    return this.transport.get(ApiRoute.ArtistSalesTotals, {
      params: { artistId },
    });
  }

  public getSale(artistOrderId: string): Promise<ApiResult<SaleDetail>> {
    return this.transport.get(ApiRoute.Sale, { params: { artistOrderId } });
  }

  /**
   * Mark a sale shipped. The buyer is emailed the tracking.
   */
  public markShipped(
    artistOrderId: string,
    shipment: ShipmentRequest,
  ): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.SaleShipment, {
      params: { artistOrderId },
      body: shipment,
    });
  }

  public markDelivered(artistOrderId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.SaleDelivered, {
      params: { artistOrderId },
    });
  }

  /**
   * Refund a sale in full from the artist's Stripe account.
   */
  public refund(artistOrderId: string): Promise<ApiResult<AckResponse>> {
    return this.transport.post(ApiRoute.SaleRefund, {
      params: { artistOrderId },
    });
  }
}
