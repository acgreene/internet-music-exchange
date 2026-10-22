import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ApiClient } from '@ime/api-client';
import { reportReasonLabel } from '@ime/client-listening';
import type { ReleaseTakedown } from '@ime/models';
import { AlertComponent, ButtonDirective, InputDirective } from '@ime/ui';

/**
 * Why IME's admins took the release down, and, for a copyright claim still
 * open to contest, the managers' statement against it.
 */
@Component({
  selector: 'ime-takedown-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, DatePipe, InputDirective],
  template: `
    <section
      class="flex flex-col gap-3 rounded-card border border-danger/40 bg-danger/5 p-4"
      aria-labelledby="takedown-heading"
    >
      <h2 id="takedown-heading" class="font-semibold text-danger">
        Taken down for {{ reasonLabel(takedown().reason).toLowerCase() }}
      </h2>
      <p class="text-sm">
        IME's moderators took it down on
        {{ takedown().takenDownAt | date: 'longDate' }}. It is off the catalog
        and out of every library.
      </p>
      @if (takedown().note; as note) {
        <blockquote
          class="border-l-2 border-line pl-3 text-sm whitespace-pre-line"
        >
          {{ note }}
        </blockquote>
      }

      @if (takedown().contestPending || contested()) {
        <ime-alert>
          Your contest is with IME's moderators. If they uphold it, the release
          comes back as it was.
        </ime-alert>
      } @else if (takedown().contestBy; as contestBy) {
        <p class="text-sm">
          If you have the rights to it, contest the claim by
          <b>{{ contestBy | date: 'longDate' }}</b
          >. Until then its files are kept and buyers are not refunded. After
          that the takedown is final.
        </p>
        <label class="flex flex-col gap-1.5 text-sm font-medium">
          Why the claim is wrong
          <textarea
            imeInput
            rows="4"
            maxlength="5000"
            placeholder="Who owns the rights, and how you can show it."
            [value]="statement()"
            (input)="statement.set(text($event))"
          ></textarea>
        </label>
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
        <div>
          <button
            imeButton
            [disabled]="!statement().trim()"
            [busy]="sending()"
            (click)="contest()"
          >
            Contest the claim
          </button>
        </div>
      } @else {
        <p class="text-sm text-ink-muted">
          This takedown is final. Owners were refunded and its files deleted.
        </p>
      }
    </section>
  `,
})
export class TakedownNotice {
  private readonly api = inject(ApiClient);

  public readonly releaseId = input.required<string>();
  public readonly takedown = input.required<ReleaseTakedown>();
  public readonly changed = output<void>();

  protected readonly reasonLabel = reportReasonLabel;
  protected readonly statement = signal('');
  protected readonly sending = signal(false);
  protected readonly contested = signal(false);
  protected readonly error = signal<string | null>(null);

  protected text(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected async contest(): Promise<void> {
    this.sending.set(true);
    this.error.set(null);
    const result = await this.api.reports.contest(
      this.releaseId(),
      this.statement().trim(),
    );
    this.sending.set(false);
    if (!result.ok) {
      this.error.set(result.error.message);
      return;
    }
    this.contested.set(true);
    this.changed.emit();
  }
}
