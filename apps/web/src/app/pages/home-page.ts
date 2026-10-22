import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '@ime/client-data';
import { ButtonDirective } from '@ime/ui';

@Component({
  selector: 'ime-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, RouterLink],
  template: `
    <div class="flex flex-col gap-4">
      <h1 class="text-2xl font-semibold tracking-tight">Home</h1>
      @if (session.status() === 'signed-out') {
        <p class="max-w-prose text-ink-muted">
          Independent music, sold straight from the artists who made it. Buy it
          once and it is yours to stream and download.
        </p>
        <div>
          <a imeButton routerLink="/sign-up">Create an account</a>
        </div>
      }
    </div>
  `,
})
export class HomePage {
  protected readonly session = inject(SessionService);
}
