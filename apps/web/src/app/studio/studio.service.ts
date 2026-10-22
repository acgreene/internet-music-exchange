import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import type { ArtistResponse } from '@ime/models';

/**
 * The artists the signed-in user manages, and which one the studio is
 * working on. Pages set the current artist from their route.
 */
@Injectable({ providedIn: 'root' })
export class StudioService {
  private readonly api = inject(ApiClient);

  public readonly artists = resource({
    loader: async () => unwrap(await this.api.artists.listMine()),
  });

  /** The artists, or none while they load. */
  public readonly artistList = computed(() => currentValue(this.artists) ?? []);

  public readonly currentArtistId = signal<string | null>(null);

  /** The artist in the address, or the first one on pages with none. */
  public readonly currentArtist = computed<ArtistResponse | null>(() => {
    const artists = this.artistList();
    return (
      artists.find((artist) => artist.id === this.currentArtistId()) ??
      artists[0] ??
      null
    );
  });
}
