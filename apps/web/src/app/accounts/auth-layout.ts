import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The narrow, centered column the sign-in and sign-up screens share.
 */
@Component({
  selector: 'ime-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-sm flex-col gap-6 py-8">
      <h1 class="text-2xl font-semibold tracking-tight">{{ heading() }}</h1>
      <ng-content />
    </div>
  `,
})
export class AuthLayout {
  public readonly heading = input.required<string>();
}
