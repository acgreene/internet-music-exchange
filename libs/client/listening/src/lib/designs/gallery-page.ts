import {
  ChangeDetectionStrategy,
  Component,
  inject,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import type { GalleryDesign } from '@ime/models';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { releasePriceLabel } from '../releases/release-labels';
import { DesignThumbnail } from './design-thumbnail';

/**
 * The public design gallery, `/designs`: what designed releases are, and
 * every design on offer, each open to try with a stand-in album.
 */
@Component({
  selector: 'ime-gallery-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DesignThumbnail,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-10">
      <header
        class="grid gap-6 border-b border-line pb-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
      >
        <div class="flex max-w-2xl flex-col gap-3">
          <span
            class="font-mono text-xs tracking-wider text-ink-muted uppercase"
            >Design gallery</span
          >
          <h1
            class="text-4xl leading-[0.95] font-black tracking-[-0.05em] md:text-6xl"
          >
            A record deserves its own page.
          </h1>
          <p class="leading-relaxed">
            Designers and creative developers build these pages. Artists put one
            on a release and fill it with their own words and images, the way
            records once had sleeves and liner notes. Open any design to try it
            with a stand-in album, or with your own cover.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <a imeButton routerLink="/studio">Sell your music</a>
          <a imeButton variant="secondary" routerLink="/studio/designs"
            >Build a design</a
          >
        </div>
      </header>

      @if (designs(); as designs) {
        <ul class="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          @for (item of designs; track item.design.id) {
            <li>
              <a
                class="group flex flex-col gap-3"
                [routerLink]="['/designs', item.design.id]"
              >
                <ime-design-thumbnail
                  class="transition-transform group-hover:-translate-y-1"
                  [design]="item"
                />
                <span class="flex flex-col gap-0.5">
                  <span class="flex items-baseline justify-between gap-3">
                    <span
                      class="truncate text-lg font-bold group-hover:underline"
                      >{{ item.design.name }}</span
                    >
                    <span class="shrink-0 font-mono text-xs">{{
                      price(item)
                    }}</span>
                  </span>
                  <span class="text-sm text-ink-muted">
                    @if (item.designer?.username; as username) {
                      by &#64;{{ username }} ·
                    }
                    {{ usedOn(item) }}
                  </span>
                  @if (item.designer?.openToCommissions) {
                    <span
                      class="mt-1 w-fit rounded-full border border-ink px-2 text-xs font-medium"
                      >Takes custom requests</span
                    >
                  }
                </span>
              </a>
            </li>
          } @empty {
            <li class="text-ink-muted">No designs are on show yet.</li>
          }
        </ul>
      } @else if (gallery.error()) {
        <ime-alert tone="error">The gallery could not be loaded.</ime-alert>
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class GalleryPage {
  private readonly api = inject(ApiClient);

  protected readonly gallery = resource({
    id: 'design-gallery',
    loader: async () => unwrap(await this.api.designs.listGallery()),
  });
  protected readonly designs = () => currentValue(this.gallery);

  protected price(item: GalleryDesign): string {
    return releasePriceLabel({
      mode: item.design.pricingMode,
      currency: item.design.currency,
      minimumPrice: item.design.minimumPrice,
      suggestedPrice: item.design.suggestedPrice,
    });
  }

  protected usedOn(item: GalleryDesign): string {
    const count = item.releaseCount;
    if (!count) return 'new';
    return `on ${count} ${count === 1 ? 'release' : 'releases'}`;
  }
}
