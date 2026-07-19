import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';

/**
 * Scroll speed in pixels per second.
 */
const SCROLL_SPEED = 60;

/**
 * Whether the visitor prefers reduced motion; scrolling is skipped when true
 * or when the environment has no matchMedia (jsdom).
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Infinite marquee ticker, the classic <marquee> reimagined. The component
 * measures one item sequence and renders enough copies to cover the container
 * plus one; CSS then loops the track by exactly one sequence width, so the
 * scroll is seamless at any viewport and runs on the compositor even when the
 * main thread is busy. Pauses on hover and stays static under reduced motion.
 */
@Component({
  selector: 'ime-marquee',
  templateUrl: './retro-marquee.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
})
export class RetroMarquee {
  /**
   * Phrases to scroll, separated by stars.
   */
  readonly items = input.required<string[]>();

  /**
   * How many copies of the item sequence the track renders; grown after
   * measurement so the track always covers the container plus one copy.
   */
  protected readonly copies = signal(2);

  /**
   * Iteration helper for the template.
   */
  protected readonly copyIndexes = computed(() =>
    Array.from({ length: this.copies() }, (_, index) => index),
  );

  /**
   * Width of one item sequence in pixels, or null before measurement; also
   * the signal that switches the CSS animation on.
   */
  protected readonly unitWidth = signal<number | null>(null);

  /**
   * CSS loop distance, exactly one sequence width.
   */
  protected readonly shift = computed(() => {
    const width = this.unitWidth();
    return width === null ? null : `${width}px`;
  });

  /**
   * CSS loop duration, keeping the speed constant regardless of content.
   */
  protected readonly duration = computed(() => {
    const width = this.unitWidth();
    return width === null ? null : `${width / SCROLL_SPEED}s`;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => this.measure());
  }

  /**
   * Measure one sequence and size the track to the container, now and on
   * resize. The CSS animation switches on once a measurement exists.
   * @private
   */
  private measure(): void {
    if (prefersReducedMotion()) {
      return;
    }

    const container = this.host.nativeElement;
    const group = container.querySelector<HTMLElement>('[data-group]');
    const width = group?.getBoundingClientRect().width ?? 0;
    if (width === 0) {
      // jsdom and hidden containers cannot be measured; stay static.
      return;
    }

    const fitCopies = () => {
      this.copies.set(Math.max(2, Math.ceil(container.clientWidth / width) + 1));
    };
    fitCopies();
    this.unitWidth.set(width);

    window.addEventListener('resize', fitCopies);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('resize', fitCopies);
    });
  }
}
