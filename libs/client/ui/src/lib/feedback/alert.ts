import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const TONES = {
  error: 'border-danger/40 bg-danger/10 text-danger',
  success: 'border-success/40 bg-success/10 text-success',
  info: 'border-line bg-surface-muted text-ink',
};

/**
 * A short message about what just happened.
 */
@Component({
  selector: 'ime-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.role]': "tone() === 'error' ? 'alert' : 'status'" },
  template: `
    <div class="rounded-control border px-3 py-2 text-sm" [class]="classes()">
      <ng-content />
    </div>
  `,
})
export class AlertComponent {
  public readonly tone = input<keyof typeof TONES>('info');

  protected classes(): string {
    return TONES[this.tone()];
  }
}
