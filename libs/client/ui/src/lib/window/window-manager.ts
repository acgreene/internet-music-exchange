import { computed, Injectable, signal, type Signal, type WritableSignal } from '@angular/core';

/**
 * Lifecycle state of a managed window.
 */
export enum WindowState {
  /**
   * Visible on the desktop.
   */
  Open = 'open',

  /**
   * Hidden and docked in the taskbar via the minimize control.
   */
  Minimized = 'minimized',

  /**
   * Removed from the DOM via the close control; restorable from the taskbar
   * so the user is never locked out.
   */
  Closed = 'closed',
}

/**
 * A window registered with the manager. Title and state are the window's own
 * signals, so the taskbar and the window always agree.
 */
export interface ManagedWindow {
  id: number;
  title: Signal<string>;
  state: WritableSignal<WindowState>;
}

/**
 * Registry of windows on the desktop: feeds the taskbar, restores docked
 * windows, and hands out z-indexes so a grabbed window comes to the front.
 */
@Injectable({ providedIn: 'root' })
export class WindowManager {
  private nextId = 0;
  private zCounter = 10;
  private readonly windowsSignal = signal<readonly ManagedWindow[]>([]);

  /**
   * Every registered window.
   */
  public readonly windows = this.windowsSignal.asReadonly();

  /**
   * Windows currently minimized or closed, shown in the taskbar dock.
   */
  public readonly docked = computed(() =>
    this.windowsSignal().filter(
      (window) => window.state() !== WindowState.Open,
    ),
  );

  /**
   * Add a window to the registry and return its id.
   */
  public register(
    title: Signal<string>,
    state: WritableSignal<WindowState>,
  ): number {
    const id = this.nextId++;
    this.windowsSignal.update((windows) => [...windows, { id, title, state }]);
    return id;
  }

  /**
   * Remove a window from the registry, for example when its route is left.
   */
  public unregister(id: number): void {
    this.windowsSignal.update((windows) =>
      windows.filter((window) => window.id !== id),
    );
  }

  /**
   * Reopen a docked window.
   */
  public restore(id: number): void {
    this.windowsSignal()
      .find((window) => window.id === id)
      ?.state.set(WindowState.Open);
  }

  /**
   * The next z-index.ts, so the most recently grabbed window sits on top.
   */
  public bringToFront(): number {
    return ++this.zCounter;
  }
}
