import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ReleasePageResponse, StoreItem } from '@ime/models';
import { CoverComponent, MoneyPipe } from '@ime/ui';
import { BuyPanel } from '../buying/buy-panel';
import { LOW_STOCK, productTypeLabel } from '../merch/merch-labels';

/**
 * Every way to get a release, side by side: the download, which can be
 * bought right here, and each physical edition with its price and how many
 * are left.
 */
@Component({
  selector: 'ime-release-formats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BuyPanel, CoverComponent, MoneyPipe, RouterLink],
  template: `
    <section class="flex flex-col gap-3" aria-labelledby="formats-heading">
      <h2
        id="formats-heading"
        class="font-mono text-xs tracking-wider text-ink-muted uppercase"
      >
        {{ owned() ? 'Yours' : 'Get it' }}
      </h2>
      <div class="flex flex-col gap-1.5">
        <span class="text-sm font-bold">Digital</span>
        <ime-buy-panel
          [page]="page()"
          [owned]="owned()"
          (claimed)="claimed.emit()"
        />
      </div>
      @for (edition of editions(); track edition.id) {
        <a
          class="group flex items-center gap-3 rounded-card border border-line bg-surface p-3 hover:bg-wash"
          [routerLink]="['/artists', page().artist.handle, 'merch', edition.id]"
        >
          <ime-cover
            class="size-14 shrink-0 border border-line"
            [src]="edition.imageUrl"
            alt=""
          />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-sm font-bold">{{ typeLabel(edition.type) }}</span>
            <span class="truncate text-sm text-ink-muted">{{
              edition.name
            }}</span>
            <span
              class="font-mono text-xs"
              [class.text-danger]="edition.totalStock === 0"
              [class.text-ink-muted]="edition.totalStock > LOW_STOCK"
              >{{ stockLabel(edition.totalStock) }}</span
            >
          </span>
          <span class="flex shrink-0 flex-col items-end gap-0.5">
            <span class="font-bold">{{
              edition.minPrice | money: edition.currency
            }}</span>
            <span class="text-xs text-ink-muted group-hover:underline"
              >Choose →</span
            >
          </span>
        </a>
      }
    </section>
  `,
})
export class ReleaseFormats {
  public readonly page = input.required<ReleasePageResponse>();
  public readonly editions = input<StoreItem[]>([]);
  public readonly owned = input(false);
  /** The release is now in the viewer's library. */
  public readonly claimed = output<void>();

  protected readonly LOW_STOCK = LOW_STOCK;
  protected readonly typeLabel = productTypeLabel;

  protected stockLabel(stock: number): string {
    if (stock === 0) return 'Sold out';
    if (stock <= LOW_STOCK) return `Only ${stock} left`;
    return `${stock} in stock`;
  }
}
