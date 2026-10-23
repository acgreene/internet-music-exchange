import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

const OPTION =
  'rounded-full px-3 py-1 font-medium whitespace-nowrap transition-colors aria-[current=page]:bg-ink aria-[current=page]:text-canvas hover:bg-wash aria-[current=page]:hover:bg-ink';

/**
 * Switches a release with a design between its designed page and IME's
 * standard page, which keeps everything a design may leave out.
 */
@Component({
  selector: 'ime-release-view-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <nav
      class="flex items-center gap-0.5 rounded-full border border-line bg-canvas p-0.5 text-sm"
      aria-label="Page for this release"
    >
      <a
        [class]="option"
        [routerLink]="[]"
        [queryParams]="{ view: null }"
        [attr.aria-current]="current() === 'designed' ? 'page' : null"
        >Designed</a
      >
      <a
        [class]="option"
        [routerLink]="[]"
        [queryParams]="{ view: 'plain' }"
        [attr.aria-current]="current() === 'standard' ? 'page' : null"
        >Standard</a
      >
    </nav>
  `,
})
export class ReleaseViewToggle {
  public readonly current = input.required<'designed' | 'standard'>();

  protected readonly option = OPTION;
}
