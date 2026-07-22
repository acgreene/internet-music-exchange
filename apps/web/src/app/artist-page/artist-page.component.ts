import { Component, effect, inject, input, signal } from '@angular/core';
import { ArtistPageHost } from '@ime/client-artist-pages';
import type { ArtistPageRenderResponse } from '@ime/models';
import { ApiClient } from '@ime/api-client';

@Component({
  selector: 'ime-artist-page',
  imports: [ArtistPageHost],
  templateUrl: './artist-page.component.html',
})
export class ArtistPage {
  protected readonly rendered = signal<ArtistPageRenderResponse | null>(null);
  protected readonly error = signal<string | null>(null);

  /** The id of the release to render, provided as a route parameter.*/
  protected readonly releaseId = input.required<string>();

  private readonly api = inject(ApiClient);

  constructor() {
    // read input reactively since it isn't avail until after construction
    effect(() => {
      void this.load(this.releaseId());
    });
  }

  /** Handle the request of a purchase from the 3rd party artist page. */
  protected onPurchaseRequested(): void {
    return;
  }

  private async load(releaseId: string): Promise<void> {
    this.rendered.set(null);
    this.error.set(null);

    const result =
      await this.api.artistPages.getArtistReleasePageData(releaseId);

    // a newer request took over while this one was in flight
    if (releaseId !== this.releaseId()) {
      return;
    }

    if (result.ok) {
      this.rendered.set(result.data);
      return;
    }

    this.error.set(result.error.message);
  }
}
