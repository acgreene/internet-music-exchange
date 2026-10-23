import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { ArtistPageHost } from '@ime/client-artist-pages';
import type { GalleryDesign } from '@ime/models';
import { placeholderRelease } from './placeholder-release';

/** How far off screen a thumbnail starts its design, so it is ready in time. */
const AHEAD = '600px';

/**
 * A design shrunk to a card: its page rendered with a stand-in album in a
 * frame three times the card's size, then scaled down, so the card shows the
 * first screen of the design itself rather than a picture of it. The design
 * only starts once the card nears the screen, so a long gallery runs just
 * the few in view.
 */
@Component({
  selector: 'ime-design-thumbnail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ArtistPageHost],
  host: {
    class:
      'relative block aspect-[5/4] overflow-hidden border border-line bg-canvas',
    'aria-hidden': 'true',
  },
  template: `
    @if (near()) {
      <div
        class="pointer-events-none absolute top-0 left-0 h-[300%] w-[300%] origin-top-left scale-[0.3333]"
      >
        <ime-artist-page-host
          fill
          [bundleUrl]="design().bundleUrl"
          [payload]="payload()"
        />
      </div>
    }
  `,
})
export class DesignThumbnail {
  public readonly design = input.required<GalleryDesign>();

  protected readonly near = signal(false);
  protected readonly payload = computed(() =>
    placeholderRelease('album', this.design().slots, null),
  );

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          this.near.set(true);
          observer.disconnect();
        },
        { rootMargin: AHEAD },
      );
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
