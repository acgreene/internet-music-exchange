import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ApiStatus } from '@ime/models';

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
  readonly apiStatus = input<ApiStatus>(ApiStatus.Checking);

  /**
   * Exposes the enum to the template for comparisons.
   * @protected
   */
  protected readonly ApiStatus = ApiStatus;
}
