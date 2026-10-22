import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The terms of service and privacy policy. Their text is still to be
 * written, and goes here before launch.
 */
@Component({
  selector: 'ime-legal-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="mx-auto flex max-w-prose flex-col gap-4">
      <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
        {{ heading() }}
      </h1>
      <p class="text-ink-muted">
        This document will be published here before IME launches.
      </p>
    </article>
  `,
})
export class LegalPage {
  public readonly heading = input.required<string>();
}
