import { computed, inject, Injectable, resource, signal } from '@angular/core';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';

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

  public readonly currentArtist = computed(
    () =>
      currentValue(this.artists)?.find(
        (artist) => artist.id === this.currentArtistId(),
      ) ?? null,
  );
}
