import { ApiRoute, HttpMethod } from '@ime/models';
import type { StripeWebhookService } from '@ime/services';
import { AbstractRouter } from '../abstract-router';
import type { RouteGuard } from '../route-guard';

/**
 * Stripe's two webhooks. Each passes the raw body and its signature to the
 * service, which verifies them, so the body is never parsed here.
 */
export class WebhooksRouter extends AbstractRouter {
  constructor(
    guard: RouteGuard,
    private readonly stripeWebhooks: StripeWebhookService,
  ) {
    super(guard);
    this.register();
  }

  protected register(): void {
    this.handle(
      HttpMethod.Post,
      ApiRoute.StripeWebhook,
      'public',
      async ({ request }) =>
        this.stripeWebhooks.handlePlatformEvent(
          await request.text(),
          request.header('Stripe-Signature') ?? '',
        ),
    );

    this.handle(
      HttpMethod.Post,
      ApiRoute.StripeConnectWebhook,
      'public',
      async ({ request }) =>
        this.stripeWebhooks.handleConnectEvent(
          await request.text(),
          request.header('Stripe-Signature') ?? '',
        ),
    );
  }
}
