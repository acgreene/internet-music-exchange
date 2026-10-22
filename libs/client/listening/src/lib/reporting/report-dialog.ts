import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ApiClient } from '@ime/api-client';
import type { ReportReason } from '@ime/models';
import { AlertComponent, ButtonDirective, InputDirective } from '@ime/ui';
import type { ReportTarget } from './report-button';
import { reportReasonLabel, reportReasonsFor } from './report-labels';

/**
 * The report form, opened by the report button: a reason, an optional note.
 */
@Component({
  selector: 'ime-report-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, InputDirective],
  template: `
    <form
      class="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-[4px_4px_0_var(--color-ink)]"
      (submit)="send($event)"
    >
      <div>
        <h2
          id="report-heading"
          class="text-xl font-extrabold tracking-[-0.03em]"
        >
          Report {{ target.label }}
        </h2>
        <p class="text-sm text-ink-muted">
          An IME admin reviews every report. The people you report are not told
          who reported them.
        </p>
      </div>

      @if (sent()) {
        <ime-alert tone="success">Thanks. An admin will take a look.</ime-alert>
        <div>
          <button imeButton type="button" (click)="ref.close()">Done</button>
        </div>
      } @else {
        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1.5 text-sm font-medium">What is wrong?</legend>
          @for (option of reasons; track option) {
            <label class="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name="report-reason"
                [checked]="reason() === option"
                (change)="reason.set(option)"
              />
              {{ reasonLabel(option) }}
            </label>
          }
        </fieldset>
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          Anything an admin should know?
          <textarea
            imeInput
            rows="3"
            maxlength="1000"
            [value]="note()"
            (input)="note.set(text($event))"
          ></textarea>
        </label>
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
        <div class="flex gap-2">
          <button
            imeButton
            type="submit"
            [disabled]="!reason()"
            [busy]="sending()"
          >
            Send report
          </button>
          <button imeButton type="button" variant="ghost" (click)="ref.close()">
            Cancel
          </button>
        </div>
      }
    </form>
  `,
})
export class ReportDialog {
  private readonly api = inject(ApiClient);
  protected readonly ref = inject(DialogRef);
  protected readonly target = inject<ReportTarget>(DIALOG_DATA);

  protected readonly reasons = reportReasonsFor(this.target.targetType);
  protected readonly reasonLabel = reportReasonLabel;
  protected readonly reason = signal<ReportReason | null>(null);
  protected readonly note = signal('');
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly error = signal<string | null>(null);

  protected text(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected async send(event: Event): Promise<void> {
    event.preventDefault();
    const reason = this.reason();
    if (!reason) return;
    this.sending.set(true);
    this.error.set(null);
    const result = await this.api.reports.report({
      targetType: this.target.targetType,
      targetId: this.target.targetId,
      reason,
      note: this.note().trim() || null,
    });
    this.sending.set(false);
    if (result.ok) this.sent.set(true);
    else this.error.set(result.error.message);
  }
}
