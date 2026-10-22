import { Directive, inject } from '@angular/core';
import { FieldComponent } from './field';

/**
 * Styles a native text input, textarea, or select. Inside an `ime-field`,
 * it takes the field's id and points to its error or hint.
 */
@Directive({
  selector: 'input[imeInput], textarea[imeInput], select[imeInput]',
  host: {
    class:
      'w-full rounded-control border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-ink focus:outline-none aria-invalid:border-danger',
    '[id]': 'field?.controlId',
    '[attr.aria-describedby]': 'field?.hasMessage() ? field.messageId : null',
    '[attr.aria-invalid]': 'field?.error() ? true : null',
  },
})
export class InputDirective {
  protected readonly field = inject(FieldComponent, { optional: true });
}
