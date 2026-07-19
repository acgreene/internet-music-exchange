import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiStatus } from '@ime/models';
import type { User } from '@supabase/supabase-js';
import { RetroTaskbar } from '../taskbar/retro-taskbar';

/**
 * Taskbar-style top chrome shared by the client apps: brand, the dock of
 * minimized and closed windows, API status, and auth controls that swap
 * between signed-out links and the signed-in user. Sticky so the dock stays
 * reachable while the page scrolls.
 */
@Component({
  selector: 'ime-header',
  templateUrl: './header.html',
  imports: [RetroTaskbar, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sticky top-0 z-40 block' },
})
export class Header {
  /**
   * Current API connectivity to display.
   */
  readonly apiStatus = input<ApiStatus>(ApiStatus.Checking);

  /**
   * The signed-in user, or null when signed out.
   */
  readonly user = input<User | null>(null);

  /**
   * Emits when the user chooses to sign out.
   */
  readonly signOutSelected = output<void>();

  /**
   * Exposes the enum to the template for comparisons.
   * @protected
   */
  protected readonly ApiStatus = ApiStatus;
}
