import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Injector,
  input,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '@ime/client-data';
import type { ModerationTarget } from '@ime/models';
import { ButtonDirective } from '@ime/ui';

export interface ReportTarget {
  targetType: ModerationTarget;
  targetId: string;
  /** What is reported, as the dialog names it. */
  label: string;
}

/**
 * Report something for IME's admins to review: a reason and an optional
 * note. Signed out, it leads to sign-in and back.
 */
@Component({
  selector: 'ime-report-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, RouterLink],
  template: `
    @if (session.status() === 'signed-out') {
      <a
        imeButton
        size="sm"
        variant="ghost"
        routerLink="/sign-in"
        [queryParams]="{ returnUrl: router.url }"
        >Report</a
      >
    } @else {
      <button imeButton size="sm" variant="ghost" (click)="open()">
        Report
      </button>
    }
  `,
})
export class ReportButton {
  private readonly injector = inject(Injector);
  protected readonly session = inject(SessionService);
  protected readonly router = inject(Router);

  public readonly targetType = input.required<ModerationTarget>();
  public readonly targetId = input.required<string>();
  public readonly label = input.required<string>();

  protected async open(): Promise<void> {
    // loaded on first use, to keep the dialog out of every page's bundle
    const [{ Dialog }, { ReportDialog }] = await Promise.all([
      import('@angular/cdk/dialog'),
      import('./report-dialog'),
    ]);
    this.injector.get(Dialog).open<void, ReportTarget>(ReportDialog, {
      data: {
        targetType: this.targetType(),
        targetId: this.targetId(),
        label: this.label(),
      },
      ariaLabelledBy: 'report-heading',
      width: 'min(28rem, calc(100vw - 2rem))',
    });
  }
}
