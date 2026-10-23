import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Something a "⋯" menu can do. */
export interface MenuAction {
  label: string;
  run: () => void;
}

/**
 * A quiet "⋯" button that opens a short menu of actions, for the things a
 * page offers but should not shout about, like reporting.
 */
@Component({
  selector: 'ime-more-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkMenu, CdkMenuItem, CdkMenuTrigger],
  template: `
    <button
      class="flex size-8 items-center justify-center rounded-full text-lg leading-none text-ink-muted hover:bg-wash hover:text-ink"
      [attr.aria-label]="label()"
      [cdkMenuTriggerFor]="menu"
    >
      ⋯
    </button>
    <ng-template #menu>
      <div
        cdkMenu
        class="min-w-36 rounded-card border border-line bg-surface p-1 shadow-[4px_4px_0_var(--color-ink)]"
      >
        @for (action of actions(); track action.label) {
          <button
            cdkMenuItem
            class="block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-wash"
            (cdkMenuItemTriggered)="action.run()"
          >
            {{ action.label }}
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class MoreMenu {
  /** What the button is for, as a screen reader says it. */
  public readonly label = input('More');
  public readonly actions = input.required<MenuAction[]>();
}
