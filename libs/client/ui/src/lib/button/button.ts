import { booleanAttribute, computed, Directive, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-ink',
  secondary: 'border border-line bg-surface text-ink hover:bg-wash',
  ghost: 'text-ink hover:bg-wash',
  danger: 'bg-danger text-white hover:bg-ink',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-[15px]',
};

/**
 * Styles a native button or link as a button, so it keeps all of its own
 * behavior and accessibility. On a label it dresses a file picker: put the
 * file input inside, visually hidden.
 */
@Directive({
  selector: 'button[imeButton], a[imeButton], label[imeButton]',
  host: {
    '[class]': 'classes()',
    '[attr.aria-busy]': 'busy() || null',
    '[attr.disabled]': 'busy() || disabled() || null',
  },
})
export class ButtonDirective {
  public readonly variant = input<ButtonVariant>('primary');
  public readonly size = input<keyof typeof SIZES>('md');
  /** Working on it: disabled, and announced as busy. */
  public readonly busy = input(false);
  /**
   * Taken here rather than left to the element, since the busy state also
   * sets the disabled attribute and would otherwise clear it.
   */
  public readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(
    () =>
      `inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[this.variant()]} ${SIZES[this.size()]}`,
  );
}
