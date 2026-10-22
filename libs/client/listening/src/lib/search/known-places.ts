import { inject, Injectable, signal } from '@angular/core';
import { ApiClient } from '@ime/api-client';
import type { KnownPlace } from '@ime/models';

/**
 * The places artists on IME are based, so search can read "from Glasgow"
 * as a filter. Loaded once, the first time someone starts a search.
 */
@Injectable({ providedIn: 'root' })
export class KnownPlaces {
  private readonly api = inject(ApiClient);
  private loading = false;

  public readonly places = signal<KnownPlace[]>([]);

  public load(): void {
    if (this.loading) return;
    this.loading = true;
    void this.api.catalog.listPlaces().then((result) => {
      if (result.ok) this.places.set(result.data);
      else this.loading = false;
    });
  }
}
