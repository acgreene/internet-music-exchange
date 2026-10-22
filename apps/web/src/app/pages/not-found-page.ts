import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PageMetaService } from '@ime/client-listening';
import { ButtonDirective } from '@ime/ui';

@Component({
  selector: 'ime-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, RouterLink],
  template: `
    <div class="flex flex-col items-start gap-4">
      <h1 class="text-3xl font-extrabold tracking-[-0.04em]">Nothing here</h1>
      <p class="text-ink-muted">
        That page does not exist, or is no longer available.
      </p>
      <a imeButton variant="secondary" routerLink="/">Go home</a>
    </div>
  `,
})
export class NotFoundPage {
  constructor() {
    inject(PageMetaService).notFound();
  }
}
