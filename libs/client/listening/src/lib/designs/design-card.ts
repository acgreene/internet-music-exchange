import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { designStyleName, type GalleryDesign } from '@ime/models';
import { releasePriceLabel } from '../releases/release-labels';
import { DesignThumbnail } from './design-thumbnail';

/**
 * A design in the gallery: its live preview, name, price, who made it, how
 * many releases use it, and its styles.
 */
@Component({
  selector: 'ime-design-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DesignThumbnail, RouterLink],
  template: `
    <a
      class="group flex flex-col gap-3"
      [routerLink]="['/designs', item().design.id]"
    >
      <ime-design-thumbnail
        class="transition-transform group-hover:-translate-y-1"
        [design]="item()"
      />
      <span class="flex flex-col gap-0.5">
        <span class="flex items-baseline justify-between gap-3">
          <span class="truncate text-lg font-bold group-hover:underline">{{
            item().design.name
          }}</span>
          <span class="shrink-0 font-mono text-xs">{{ price() }}</span>
        </span>
        <span class="truncate text-sm text-ink-muted">{{ byLine() }}</span>
        @if (styles()) {
          <span class="truncate font-mono text-xs text-ink-muted">{{
            styles()
          }}</span>
        }
      </span>
    </a>
  `,
})
export class DesignCard {
  public readonly item = input.required<GalleryDesign>();

  protected readonly price = computed(() => {
    const { design } = this.item();
    return releasePriceLabel({
      mode: design.pricingMode,
      currency: design.currency,
      minimumPrice: design.minimumPrice,
      suggestedPrice: design.suggestedPrice,
    });
  });

  protected readonly byLine = computed(() => {
    const { designer, releaseCount: count } = this.item();
    return [
      designer?.username ? `by @${designer.username}` : null,
      count ? `on ${count} ${count === 1 ? 'release' : 'releases'}` : 'new',
      designer?.openToCommissions ? 'takes requests' : null,
    ]
      .filter(Boolean)
      .join(', ');
  });

  protected readonly styles = computed(() =>
    this.item().design.styles.map(designStyleName).join(', '),
  );
}
