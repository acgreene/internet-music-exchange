import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WindowManager, WindowState } from '../window/window-manager';
import { RetroTaskbar } from './retro-taskbar';

describe('RetroTaskbar', () => {
  it('lists docked windows and restores them on click', async () => {
    await TestBed.configureTestingModule({
      imports: [RetroTaskbar],
    }).compileComponents();

    const manager = TestBed.inject(WindowManager);
    const state = signal(WindowState.Minimized);
    manager.register(signal('welcome.html'), state);

    const fixture = TestBed.createComponent(RetroTaskbar);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('welcome.html');

    compiled.querySelector('button')?.click();
    await fixture.whenStable();

    expect(state()).toBe(WindowState.Open);
    expect(compiled.querySelector('button')).toBeNull();
  });
});
