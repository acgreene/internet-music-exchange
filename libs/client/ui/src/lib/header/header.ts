import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Connectivity of the API as seen by the client, shown in the header indicator.
 */
export type ApiStatus = 'checking' | 'online' | 'offline';

/**
 * Shared top bar for the client apps: brand wordmark plus an API status dot.
 */
@Component({
  selector: 'ime-header',
  templateUrl: './header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  /**
   * Current API connectivity to display.
   */
  readonly apiStatus = input<ApiStatus>('checking');
}
