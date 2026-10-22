import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import { paymentLabel, shippingLabel } from '@ime/client-listening';
import type { SaleListItem } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  MoneyPipe,
  SpinnerComponent,
} from '@ime/ui';
import { StudioService } from '../studio.service';

const PAGE_SIZE = 50;

/**
 * What the artist has sold: totals, orders waiting to ship, and every sale.
 */
@Component({
  selector: 'ime-sales-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    MoneyPipe,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-4xl flex-col gap-8">
      <h1 class="text-2xl font-semibold tracking-tight">Sales</h1>

      @if (totals(); as totals) {
        @if (totals.length) {
          <div class="grid gap-4 sm:grid-cols-2">
            @for (total of totals; track total.currency) {
              <dl
                class="grid grid-cols-2 gap-2 rounded-card border border-line bg-surface p-4 text-sm"
              >
                <dt class="text-ink-muted">Sales</dt>
                <dd class="text-right font-medium">{{ total.orderCount }}</dd>
                <dt class="text-ink-muted">Gross</dt>
                <dd class="text-right font-medium">
                  {{ total.grossAmount | money: total.currency }}
                </dd>
                <dt class="text-ink-muted">Of which shipping</dt>
                <dd class="text-right">
                  {{ total.shippingAmount | money: total.currency }}
                </dd>
                <dt class="text-ink-muted">Of which tax</dt>
                <dd class="text-right">
                  {{ total.taxAmount | money: total.currency }}
                </dd>
              </dl>
            }
          </div>
        }
      }

      @if (toShip().length) {
        <section class="flex flex-col gap-3" aria-labelledby="ship-heading">
          <h2 id="ship-heading" class="text-lg font-semibold">
            To ship ({{ toShip().length }})
          </h2>
          <p class="text-sm text-ink-muted">
            Oldest first, so the longest wait goes out next.
          </p>
          <ul
            class="flex flex-col divide-y divide-line rounded-card border border-line bg-surface"
          >
            @for (sale of toShip(); track sale.artistOrderId) {
              <li>
                <a
                  class="flex items-center justify-between gap-4 p-4 hover:bg-surface-muted"
                  [routerLink]="sale.artistOrderId"
                >
                  <span class="flex flex-col">
                    <span class="font-medium">{{
                      sale.buyerName || 'A buyer'
                    }}</span>
                    <span class="text-sm text-ink-muted">
                      Paid {{ sale.createdAt | date: 'mediumDate' }}
                      @if (sale.shippingAddress; as address) {
                        · {{ address.city }}, {{ address.country }}
                      }
                    </span>
                  </span>
                  <span class="text-sm font-medium">Ship it →</span>
                </a>
              </li>
            }
          </ul>
        </section>
      }

      <section class="flex flex-col gap-3" aria-labelledby="all-heading">
        <h2 id="all-heading" class="text-lg font-semibold">All sales</h2>
        @if (firstPage.error()) {
          <ime-alert tone="error">The sales could not be loaded.</ime-alert>
        }
        <ul
          class="flex flex-col divide-y divide-line rounded-card border border-line bg-surface"
        >
          @for (sale of sales(); track sale.artistOrderId) {
            <li>
              <a
                class="flex items-center justify-between gap-4 p-4 hover:bg-surface-muted"
                [routerLink]="sale.artistOrderId"
              >
                <span class="flex min-w-0 flex-col">
                  <span class="truncate font-medium">{{
                    sale.buyerName || 'A buyer'
                  }}</span>
                  <span class="text-sm text-ink-muted">
                    {{ sale.createdAt | date: 'mediumDate' }} ·
                    {{ statusLabel(sale.status) }}
                    @if (sale.fulfillmentStatus; as shipping) {
                      · {{ shipLabel(shipping) }}
                    }
                  </span>
                </span>
                <span class="shrink-0 font-medium">{{
                  sale.amount | money: sale.currency
                }}</span>
              </a>
            </li>
          } @empty {
            @if (firstPage.hasValue()) {
              <li class="p-4 text-ink-muted">No sales yet.</li>
            }
          }
        </ul>
        @if (firstPage.isLoading()) {
          <ime-spinner />
        } @else if (hasMore()) {
          <div>
            <button
              imeButton
              variant="secondary"
              [busy]="loadingMore()"
              (click)="loadMore()"
            >
              Show more
            </button>
          </div>
        }
      </section>
    </div>
  `,
})
export class SalesPage {
  private readonly api = inject(ApiClient);
  private readonly studio = inject(StudioService);

  private readonly artistId = computed(
    () => this.studio.currentArtistId() ?? undefined,
  );

  private readonly totalsResource = resource({
    params: this.artistId,
    loader: async ({ params }) =>
      unwrap(await this.api.orders.getTotals(params)),
  });
  private readonly toShipResource = resource({
    params: this.artistId,
    loader: async ({ params }) =>
      unwrap(await this.api.orders.listToShip(params)),
  });
  protected readonly firstPage = resource({
    params: this.artistId,
    loader: async ({ params }) =>
      unwrap(await this.api.orders.listSales(params, { limit: PAGE_SIZE })),
  });

  protected readonly totals = computed(() => currentValue(this.totalsResource));
  protected readonly toShip = computed(
    () => currentValue(this.toShipResource) ?? [],
  );

  private readonly more = signal<SaleListItem[]>([]);
  private readonly lastPageSize = signal(PAGE_SIZE);
  protected readonly loadingMore = signal(false);

  protected readonly sales = computed(() => [
    ...(currentValue(this.firstPage) ?? []),
    ...this.more(),
  ]);
  protected readonly hasMore = computed(
    () =>
      (currentValue(this.firstPage)?.length ?? 0) === PAGE_SIZE &&
      this.lastPageSize() === PAGE_SIZE,
  );

  protected readonly statusLabel = paymentLabel;
  protected readonly shipLabel = shippingLabel;

  protected async loadMore(): Promise<void> {
    const artistId = this.artistId();
    if (!artistId) return;
    this.loadingMore.set(true);
    const result = await this.api.orders.listSales(artistId, {
      limit: PAGE_SIZE,
      offset: this.sales().length,
    });
    this.loadingMore.set(false);
    if (!result.ok) return;
    this.more.update((more) => [...more, ...result.data]);
    this.lastPageSize.set(result.data.length);
  }
}
