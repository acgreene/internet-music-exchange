import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { ArtistPageHost } from '@ime/client-artist-pages';
import type { GalleryDesign } from '@ime/models';
import { placeholderRelease } from './placeholder-release';

/**
 * A design shrunk to a card: its page rendered with a stand-in album at
 * three times the card's width, then scaled down, so the card shows the
 * design itself rather than a picture of it.
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
    <div
      class="pointer-events-none absolute top-0 left-0 w-[300%] origin-top-left scale-[0.3333]"
    >
      <ime-artist-page-host
        [bundleUrl]="design().bundleUrl"
        [payload]="payload()"
      />
    </div>
  `,
})
export class DesignThumbnail {
  public readonly design = input.required<GalleryDesign>();

  protected readonly payload = computed(() =>
    placeholderRelease('album', this.design().slots, null),
  );
}
