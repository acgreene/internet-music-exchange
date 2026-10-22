import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Something is loading.
 */
@Component({
  selector: 'ime-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-block size-5 animate-spin rounded-full border-2 border-line border-t-ink"
      role="status"
      [attr.aria-label]="label()"
    ></span>
  `,
})
export class SpinnerComponent {
  public readonly label = input('Loading');
}
