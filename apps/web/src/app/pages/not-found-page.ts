import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from '@ime/ui';

@Component({
  selector: 'ime-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, RouterLink],
  template: `
    <div class="flex flex-col items-start gap-4">
      <h1 class="text-2xl font-semibold tracking-tight">Nothing here</h1>
      <p class="text-ink-muted">
        That page does not exist, or is no longer available.
      </p>
      <a imeButton variant="secondary" routerLink="/">Go home</a>
    </div>
  `,
})
export class NotFoundPage {}
