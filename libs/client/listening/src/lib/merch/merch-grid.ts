import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { StoreItem } from '@ime/models';
import { CoverComponent, MoneyPipe } from '@ime/ui';
import { LOW_STOCK, productTypeLabel } from './merch-labels';

/**
 * Merch in a grid: photo, name, and the lowest price, linking to each
 * product.
 */
@Component({
  selector: 'ime-merch-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CoverComponent, MoneyPipe, RouterLink],
  template: `
    <ul [class]="gridClasses()">
      @for (item of items(); track item.id) {
        <li>
          <a
            class="group flex flex-col gap-2"
            [routerLink]="['/artists', handle(), 'merch', item.id]"
          >
            <ime-cover
              class="w-full transition group-hover:opacity-90"
              [src]="item.imageUrl"
              [alt]="item.name"
            />
            <span class="truncate text-sm font-medium group-hover:underline">{{
              item.name
            }}</span>
            <span class="text-sm text-ink-muted">
              {{ typeLabel(item.type) }},
              @if (item.totalStock === 0) {
                Sold out
              } @else {
                from {{ item.minPrice | money: item.currency }}
              }
            </span>
            @if (item.totalStock > 0 && item.totalStock <= LOW_STOCK) {
              <span class="-mt-1 font-mono text-xs text-danger"
                >Only {{ item.totalStock }} left</span
              >
            }
          </a>
        </li>
      }
    </ul>
  `,
})
export class MerchGrid {
  protected readonly LOW_STOCK = LOW_STOCK;
  public readonly items = input.required<StoreItem[]>();
  /** The artist the items belong to, for their addresses. */
  public readonly handle = input.required<string>();
  /** Two across at every width, for a narrow column. */
  public readonly compact = input(false, { transform: booleanAttribute });

  protected readonly gridClasses = computed(() =>
    this.compact()
      ? 'grid grid-cols-2 gap-4'
      : 'grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4',
  );

  protected readonly typeLabel = productTypeLabel;
}
