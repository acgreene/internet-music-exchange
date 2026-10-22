import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { PricingResponse, Shelf } from '@ime/models';
import { CoverComponent, MoneyPipe } from '@ime/ui';
import { formatMoney } from '@ime/utils';
import { productTypeLabel } from '../merch/merch-labels';

/**
 * One home page shelf: a titled row of records or merch that scrolls
 * sideways, with the reason it is there.
 */
@Component({
  selector: 'ime-shelf-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoverComponent, MoneyPipe, RouterLink],
  template: `
    <section class="flex flex-col gap-3" [attr.aria-labelledby]="headingId()">
      <h2
        [id]="headingId()"
        class="text-2xl font-extrabold tracking-[-0.035em]"
      >
        {{ shelf().title }}
        <span class="text-base font-medium tracking-normal text-ink-muted">{{
          shelf().reason
        }}</span>
      </h2>
      <ul
        class="-mx-4 grid snap-x auto-cols-[minmax(9.5rem,11rem)] grid-flow-col gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0"
      >
        @for (item of shelf().items; track $index) {
          <li class="snap-start">
            @if (item.kind === 'release') {
              <a
                class="group flex flex-col gap-1.5"
                [routerLink]="[
                  '/artists',
                  item.release.artistHandle,
                  item.release.slug,
                ]"
              >
                <ime-cover
                  class="w-full border border-line"
                  [src]="item.release.coverUrl"
                  [alt]="'Cover of ' + item.release.title"
                />
                <span class="truncate font-bold group-hover:underline">{{
                  item.release.title
                }}</span>
                <span class="-mt-1 truncate text-sm text-ink-muted">{{
                  item.release.artistName
                }}</span>
                <span class="font-mono text-xs">{{
                  priceLabel(item.pricing)
                }}</span>
              </a>
            } @else {
              <a
                class="group flex flex-col gap-1.5"
                [routerLink]="['/artists', item.artistHandle, 'merch', item.id]"
              >
                <ime-cover
                  class="w-full border border-line"
                  [src]="item.imageUrl"
                  [alt]="item.name"
                />
                <span class="truncate font-bold group-hover:underline">{{
                  item.name
                }}</span>
                <span class="-mt-1 truncate text-sm text-ink-muted">{{
                  item.artistName
                }}</span>
                <span class="font-mono text-xs"
                  >{{ typeLabel(item.productType) }} ·
                  {{ item.price | money: item.currency }}</span
                >
              </a>
            }
          </li>
        }
      </ul>
    </section>
  `,
})
export class ShelfRow {
  public readonly shelf = input.required<Shelf>();

  protected readonly typeLabel = productTypeLabel;

  protected headingId(): string {
    return `shelf-${this.shelf().id}`;
  }

  protected priceLabel(pricing: PricingResponse | null): string {
    if (!pricing || pricing.mode === 'free') return 'Free';
    const amount = formatMoney(pricing.minimumPrice, pricing.currency ?? 'usd');
    if (pricing.mode === 'fixed') return amount;
    return pricing.minimumPrice > 0 ? `${amount} or more` : 'Name your price';
  }
}
