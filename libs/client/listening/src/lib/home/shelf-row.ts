import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Shelf } from '@ime/models';
import { CoverComponent, MoneyPipe } from '@ime/ui';
import { productTypeLabel } from '../merch/merch-labels';
import { releasePriceLabel } from '../releases/release-labels';

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
        @if (shelf().link; as link) {
          <a class="hover:underline" [routerLink]="link">{{ shelf().title }}</a>
        } @else {
          {{ shelf().title }}
        }
        <span class="ml-1 text-base font-medium tracking-normal text-ink-muted">{{
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
  protected readonly priceLabel = releasePriceLabel;

  protected headingId(): string {
    return `shelf-${this.shelf().id}`;
  }
}
