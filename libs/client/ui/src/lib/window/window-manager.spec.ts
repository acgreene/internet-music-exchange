import { signal } from '@angular/core';
import { WindowManager, WindowState } from './window-manager';

describe('WindowManager', () => {
  it('docks minimized and closed windows and restores them', () => {
    const manager = new WindowManager();
    const state = signal(WindowState.Open);
    const id = manager.register(signal('welcome.html'), state);

    expect(manager.docked()).toHaveLength(0);

    state.set(WindowState.Minimized);
    expect(manager.docked().map((w) => w.id)).toEqual([id]);

    manager.restore(id);
    expect(state()).toBe(WindowState.Open);
    expect(manager.docked()).toHaveLength(0);
  });

  it('unregisters windows', () => {
    const manager = new WindowManager();
    const id = manager.register(signal('a'), signal(WindowState.Closed));

    manager.unregister(id);

    expect(manager.windows()).toHaveLength(0);
    expect(manager.docked()).toHaveLength(0);
  });

  it('hands out increasing z-indexes', () => {
    const manager = new WindowManager();

    expect(manager.bringToFront()).toBeLessThan(manager.bringToFront());
  });
});
