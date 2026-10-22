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
import type { PurchaseListItem } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  MoneyPipe,
  SpinnerComponent,
} from '@ime/ui';
import { paymentLabel, shippingLabel } from './purchase-labels';
import { currentValue } from '@ime/client-data';

const PAGE_SIZE = 25;

/**
 * Everything the buyer has bought, one row per artist paid, newest first.
 */
@Component({
  selector: 'ime-purchases-page',
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
    <div class="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 class="text-2xl font-semibold tracking-tight">Purchases</h1>
      @if (firstPage.error()) {
        <ime-alert tone="error">Your purchases could not be loaded.</ime-alert>
      }
      <ul
        class="flex flex-col divide-y divide-line rounded-card border border-line bg-surface"
      >
        @for (purchase of purchases(); track purchase.artistOrderId) {
          <li>
            <a
              class="flex items-center justify-between gap-4 p-4 hover:bg-surface-muted"
              [routerLink]="['/purchases', purchase.artistOrderId]"
            >
              <span class="flex min-w-0 flex-col">
                <span class="truncate font-medium">{{
                  purchase.artistName
                }}</span>
                <span class="text-sm text-ink-muted">
                  {{ purchase.createdAt | date: 'mediumDate' }} ·
                  {{ statusLabel(purchase.status) }}
                  @if (purchase.fulfillmentStatus; as shipping) {
                    · {{ shipLabel(shipping) }}
                  }
                </span>
              </span>
              <span class="shrink-0 font-medium">{{
                purchase.amount | money: purchase.currency
              }}</span>
            </a>
          </li>
        } @empty {
          @if (firstPage.hasValue()) {
            <li class="p-4 text-ink-muted">
              You have not bought anything yet.
            </li>
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
    </div>
  `,
})
export class PurchasesPage {
  private readonly api = inject(ApiClient);

  protected readonly firstPage = resource({
    loader: async () =>
      unwrap(await this.api.orders.listPurchases({ limit: PAGE_SIZE })),
  });

  private readonly more = signal<PurchaseListItem[]>([]);
  private readonly lastPageSize = signal(PAGE_SIZE);
  protected readonly loadingMore = signal(false);

  protected readonly purchases = computed(() => [
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
    this.loadingMore.set(true);
    const result = await this.api.orders.listPurchases({
      limit: PAGE_SIZE,
      offset: this.purchases().length,
    });
    this.loadingMore.set(false);
    if (!result.ok) return;
    this.more.update((more) => [...more, ...result.data]);
    this.lastPageSize.set(result.data.length);
  }
}
