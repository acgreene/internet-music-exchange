import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import gsap from 'gsap';
import { WindowManager, WindowState } from './window-manager';

/**
 * Whether the visitor prefers reduced motion; animation is skipped when true
 * or when the environment has no matchMedia (jsdom).
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Clamp a value into [min, max].
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Bottom edge of the top chrome, the highest a window may be dragged. The
 * header is sticky and the marquee scrolls, so the limit is whichever sits
 * lower right now.
 */
function desktopTop(): number {
  const bottoms = ['ime-header', 'ime-marquee'].map(
    (selector) =>
      document.querySelector(selector)?.getBoundingClientRect().bottom ?? 0,
  );
  return Math.max(0, ...bottoms);
}

/**
 * Chrome window frame with a titlebar gradient, working window controls, and
 * a beveled body; page content projects into the body. Behaves like an OS
 * window: the titlebar drags it around the desktop (never off-screen or over
 * the top chrome), minimize docks it into the taskbar, and close removes it
 * from the DOM with a compositor-style shrink, restorable from the taskbar.
 */
@Component({
  selector: 'ime-window',
  templateUrl: './retro-window.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
})
export class RetroWindow {
  /**
   * Text shown in the titlebar.
   */
  readonly windowTitle = input.required<string>();

  /**
   * Lifecycle state; drives the taskbar and removes the frame from the DOM
   * when not open.
   */
  protected readonly state = signal(WindowState.Open);

  /**
   * Exposes the enum to the template for comparisons.
   * @protected
   */
  protected readonly WindowState = WindowState;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly manager = inject(WindowManager);
  private readonly id = this.manager.register(this.windowTitle, this.state);
  private previousState = WindowState.Open;

  constructor() {
    this.destroyRef.onDestroy(() => this.manager.unregister(this.id));

    afterNextRender(() => this.playSpawnAnimation());

    effect(() => {
      const state = this.state();
      const wasDocked = this.previousState !== WindowState.Open;
      this.previousState = state;
      if (state === WindowState.Open && wasDocked) {
        // Wait a frame so the @if has put the frame back in the DOM.
        requestAnimationFrame(() => this.playSpawnAnimation());
      }
    });
  }

  /**
   * Close the window: shrink and blur out, then remove the frame from the
   * DOM. The taskbar keeps a restore entry so the user is never locked out.
   */
  protected close(): void {
    this.dock(WindowState.Closed, { scale: 0.92, y: 10 });
  }

  /**
   * Minimize the window: slide up toward the taskbar, then dock.
   */
  protected minimize(): void {
    this.dock(WindowState.Minimized, { scale: 0.85, y: -60 });
  }

  /**
   * Begin an OS-style titlebar drag: pointer-captured, clamped to the desktop
   * area, and brought to the front.
   */
  protected startDrag(event: PointerEvent): void {
    if ((event.target as HTMLElement).closest('[data-window-control]')) {
      return;
    }
    const frame = this.frame();
    if (!frame) {
      return;
    }
    event.preventDefault();

    const titlebar = event.currentTarget as HTMLElement;
    try {
      titlebar.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointers (tests, automation) may not be capturable; window
      // listeners below keep the drag working regardless.
    }

    const element = this.host.nativeElement;
    gsap.set(element, { zIndex: this.manager.bringToFront() });

    const startRect = frame.getBoundingClientRect();
    const baseX = Number(gsap.getProperty(element, 'x'));
    const baseY = Number(gsap.getProperty(element, 'y'));
    const startX = event.clientX;
    const startY = event.clientY;
    const topLimit = desktopTop();

    const move = (moveEvent: PointerEvent) => {
      const dx = clamp(
        moveEvent.clientX - startX,
        -startRect.left,
        window.innerWidth - startRect.right,
      );
      const dy = clamp(
        moveEvent.clientY - startY,
        topLimit - startRect.top,
        window.innerHeight - startRect.bottom,
      );
      gsap.set(element, { x: baseX + dx, y: baseY + dy });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  /**
   * The window frame element, or null while docked.
   * @private
   */
  private frame(): HTMLElement | null {
    return this.host.nativeElement.querySelector('[data-frame]');
  }

  /**
   * Animate the frame out with a compositor-style shrink, then dock it.
   * @private
   */
  private dock(target: WindowState, motion: { scale: number; y: number }): void {
    const frame = this.frame();
    if (!frame || prefersReducedMotion()) {
      this.state.set(target);
      return;
    }
    gsap.to(frame, {
      ...motion,
      opacity: 0,
      filter: 'blur(6px)',
      duration: 0.26,
      ease: 'power3.in',
      onComplete: () => this.state.set(target),
    });
  }

  /**
   * Pop the frame in, used on boot and when restored from the taskbar.
   * @private
   */
  private playSpawnAnimation(): void {
    const frame = this.frame();
    if (!frame || prefersReducedMotion()) {
      return;
    }
    gsap.fromTo(
      frame,
      { y: 26, scale: 0.94, opacity: 0, filter: 'blur(6px)' },
      {
        y: 0,
        scale: 1,
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.4,
        ease: 'back.out(1.5)',
        clearProps: 'transform,opacity,filter',
      },
    );
  }
}
