import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * IME's wordmark: a lowercase `ime` set as a link, with the full name
 * beneath it.
 */
@Component({
  selector: 'ime-wordmark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex flex-col leading-none' },
  template: `
    <span
      class="font-black tracking-[-0.07em] text-accent underline"
      [class]="markClasses()"
      >ime</span
    >
    @if (showName()) {
      <span class="mt-1.5 text-[10px] font-semibold tracking-normal text-ink">
        internet music exchange
      </span>
    }
  `,
})
export class WordmarkComponent {
  public readonly size = input<'sm' | 'lg'>('sm');
  /** Spell out the name beneath the mark. */
  public readonly showName = input(true);

  protected readonly markClasses = computed(() =>
    this.size() === 'lg'
      ? 'text-7xl decoration-[6px] underline-offset-[8px]'
      : 'text-[28px] decoration-[3px] underline-offset-[4px]',
  );
}
