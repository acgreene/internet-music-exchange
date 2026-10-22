import { computed, Directive, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-muted',
  ghost: 'text-ink hover:bg-surface-muted',
  danger: 'bg-danger text-white hover:opacity-90',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
};

/**
 * Styles a native button or link as a button, so it keeps all of its own
 * behavior and accessibility.
 */
@Directive({
  selector: 'button[imeButton], a[imeButton]',
  host: {
    '[class]': 'classes()',
    '[attr.aria-busy]': 'busy() || null',
    '[attr.disabled]': 'busy() || null',
  },
})
export class ButtonDirective {
  public readonly variant = input<ButtonVariant>('primary');
  public readonly size = input<keyof typeof SIZES>('md');
  /** Working on it: disabled, and announced as busy. */
  public readonly busy = input(false);

  protected readonly classes = computed(
    () =>
      `inline-flex items-center justify-center gap-2 rounded-control font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[this.variant()]} ${SIZES[this.size()]}`,
  );
}
