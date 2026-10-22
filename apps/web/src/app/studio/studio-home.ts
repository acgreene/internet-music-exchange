import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { StudioService } from './studio.service';
import { currentValue } from '@ime/client-data';

/**
 * `/studio`: straight to the first artist the user manages, or, with none, an
 * invitation to make one.
 */
@Component({
  selector: 'ime-studio-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, RouterLink, SpinnerComponent],
  template: `
    @if (studio.artists.error()) {
      <ime-alert tone="error">Your artists could not be loaded.</ime-alert>
    } @else if (studio.artists.value()?.length === 0) {
      <div class="mx-auto flex max-w-xl flex-col gap-4 py-8">
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
          Welcome to the studio
        </h1>
        <p class="text-ink-muted">
          This is where artists publish music and run their store. Start by
          creating an artist: a band, a project, or yourself. You can invite
          bandmates to manage it with you.
        </p>
        <div>
          <a imeButton routerLink="/studio/artists/new">Create an artist</a>
        </div>
      </div>
    } @else {
      <ime-spinner />
    }
  `,
})
export class StudioHome {
  protected readonly studio = inject(StudioService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      const first = currentValue(this.studio.artists)?.[0];
      if (first) {
        void this.router.navigate(['/studio/artists', first.id], {
          replaceUrl: true,
        });
      }
    });
  }
}
