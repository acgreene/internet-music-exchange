import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WindowManager, WindowState } from '../window/window-manager';

/**
 * Dock of minimized and closed windows, rendered inside the header between
 * the brand and the status controls; each entry reopens its window on click.
 * The site's menu surface grows here over time instead of a classic nav.
 */
@Component({
  selector: 'ime-taskbar',
  templateUrl: './retro-taskbar.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-w-0 flex-wrap items-center gap-1' },
})
export class RetroTaskbar {
  /**
   * Window registry feeding the dock.
   */
  protected readonly manager = inject(WindowManager);

  /**
   * Exposes the enum to the template for comparisons.
   * @protected
   */
  protected readonly WindowState = WindowState;
}
