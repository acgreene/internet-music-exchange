import { ApiRoute, HttpMethod } from '@ime/models';
import type {
  CheckoutService,
  PurchaseService,
  SalesService,
} from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Buying and selling: checkout, a buyer's purchases and refund requests, and
 * a manager's sales, shipping, and refunds.
 */
export class OrdersRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly checkout: CheckoutService,
    private readonly purchases: PurchaseService,
    private readonly sales: SalesService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(
      HttpMethod.Post,
      ApiRoute.Checkout,
      'user',
      ({ userId, body }) => this.checkout.start(userId, body),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.MyPurchases,
      'user',
      ({ userId, query }) =>
        this.purchases.listPurchases(userId, query.limit, query.offset),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.Purchase,
      'user',
      ({ userId, params }) =>
        this.purchases.getPurchase(userId, params.artistOrderId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.PurchaseRefundRequest,
      'user',
      ({ userId, params, body }) =>
        this.purchases.requestRefund(
          userId,
          params.artistOrderId,
          body.message,
        ),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.ArtistSales,
      'user',
      ({ userId, params, query }) =>
        this.sales.listSales(
          userId,
          params.artistId,
          query.limit,
          query.offset,
        ),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.ArtistSalesToShip,
      'user',
      ({ userId, params }) => this.sales.listToShip(userId, params.artistId),
    );

    this.handle(
      HttpMethod.Get,
      ApiRoute.ArtistSalesTotals,
      'user',
      ({ userId, params }) => this.sales.getTotals(userId, params.artistId),
    );

    this.handle(HttpMethod.Get, ApiRoute.Sale, 'user', ({ userId, params }) =>
      this.sales.getSale(userId, params.artistOrderId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.SaleShipment,
      'user',
      ({ userId, params, body }) =>
        this.sales.markShipped(userId, params.artistOrderId, body),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.SaleDelivered,
      'user',
      ({ userId, params }) =>
        this.sales.markDelivered(userId, params.artistOrderId),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.SaleRefund,
      'user',
      ({ userId, params }) => this.sales.refund(userId, params.artistOrderId),
    );
  }
}
