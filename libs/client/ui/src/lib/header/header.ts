import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type ApiStatus = 'checking' | 'online' | 'offline';

@Component({
  selector: 'ime-header',
  templateUrl: './header.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  readonly apiStatus = input<ApiStatus>('checking');
}
