import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

let nextId = 0;

/**
 * A labelled form control with its hint and error. Wrap one `imeInput`,
 * which links itself to the label and the message:
 *
 * ```html
 * <ime-field label="Email" [errors]="form.email().errors()">
 *   <input imeInput type="email" [formField]="form.email" />
 * </ime-field>
 * ```
 */
@Component({
  selector: 'ime-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1.5">
      <label class="text-sm font-medium text-ink" [for]="controlId">
        {{ label() }}
      </label>
      <ng-content />
      @if (error(); as message) {
        <span class="text-sm text-danger" role="alert" [id]="messageId">
          {{ message }}
        </span>
      } @else if (hint()) {
        <span class="text-sm text-ink-muted" [id]="messageId">
          {{ hint() }}
        </span>
      }
    </div>
  `,
})
export class FieldComponent {
  public readonly label = input.required<string>();
  public readonly hint = input<string>();
  /** The control's validation errors; the first is shown. */
  public readonly errors = input<readonly { message?: string }[]>([]);
  /** Show errors only once the control was touched. */
  public readonly touched = input(true);

  public readonly controlId = `ime-field-${nextId++}`;
  public readonly messageId = `${this.controlId}-message`;

  /** The error to show, if any. */
  public readonly error = computed(() =>
    this.touched() ? (this.errors()[0]?.message ?? null) : null,
  );

  /** Whether there is an error or hint for the control to point to. */
  public readonly hasMessage = computed(
    () => this.error() !== null || Boolean(this.hint()),
  );
}
