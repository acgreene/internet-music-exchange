import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RetroWindow } from '@ime/ui';

/**
 * The web desktop's welcome window.
 */
@Component({
  selector: 'ime-home-page',
  templateUrl: './home-page.html',
  imports: [RetroWindow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1' },
})
export class HomePage {}
