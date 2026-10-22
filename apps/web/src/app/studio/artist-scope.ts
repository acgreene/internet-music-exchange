import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { StudioService } from './studio.service';

/**
 * Makes the artist in the address the one the studio is working on, for the
 * artist's pages beneath it.
 */
@Component({
  selector: 'ime-artist-scope',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class ArtistScope {
  private readonly studio = inject(StudioService);

  public readonly artistId = input.required<string>();

  constructor() {
    effect(() => this.studio.currentArtistId.set(this.artistId()));
  }
}
