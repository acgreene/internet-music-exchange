import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, type ApiResult, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import {
  moderationTargetLabel,
  reportReasonLabel,
  reportReasonsFor,
} from '@ime/client-listening';
import type {
  ModerationActionResponse,
  ModerationOutcome,
  ModerationTarget,
  ReportReason,
} from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';

const ACTION_LABELS: Record<ModerationActionResponse['action'], string> = {
  dismiss: 'Dismissed the reports',
  take_down: 'Took it down',
  finalize_takedown: 'Made the takedown final',
  restore: 'Restored it',
  suspend: 'Suspended',
  unsuspend: 'Lifted the suspension',
  clear_profile: 'Cleared the profile',
};

type Working =
  'dismiss' | 'takeDown' | 'restore' | 'clear' | 'upheld' | 'rejected';

/**
 * One reported item: what it is, every report and action on record, and
 * the decision: dismiss, take down, restore, or settle a contest.
 */
@Component({
  selector: 'ime-case-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    InputDirective,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-4xl flex-col gap-8">
      <a class="link text-sm" routerLink="/admin">← Reports</a>

      @if (caseResource.error(); as error) {
        <ime-alert tone="error">{{ error.message }}</ime-alert>
      } @else if (record(); as record) {
        <header class="flex flex-col gap-2">
          <p class="text-sm text-ink-muted">{{ targetLabel(targetType()) }}</p>
          @if (record.subject; as subject) {
            <div class="flex flex-wrap items-center gap-3">
              <h1
                class="max-w-prose text-3xl font-extrabold tracking-[-0.04em] [overflow-wrap:anywhere]"
              >
                {{ excerpt(subject.label) }}
              </h1>
              @if (subject.down) {
                <span
                  class="rounded-full border border-danger px-2.5 py-0.5 text-xs font-medium text-danger"
                >
                  {{
                    targetType() === 'artist' || targetType() === 'user'
                      ? 'Suspended'
                      : 'Down'
                  }}
                </span>
              }
            </div>
            @if (subject.context) {
              <p class="text-ink-muted">{{ subject.context }}</p>
            }
            @if (subject.path) {
              <p>
                <a
                  class="link text-sm"
                  [href]="subject.path"
                  target="_blank"
                  rel="noopener"
                  >Open it in a new tab</a
                >
              </p>
            }
          } @else {
            <h1 class="text-3xl font-extrabold tracking-[-0.04em]">Gone</h1>
            <p class="text-ink-muted">
              It no longer exists, so there is nothing left to act on.
            </p>
          }
          <p class="font-mono text-xs text-ink-subtle">{{ targetId() }}</p>
        </header>

        @if (outcome(); as outcome) {
          <ime-alert tone="success">
            Done.
            @if (outcome.refunded) {
              Refunded {{ outcome.refunded }}
              {{ outcome.refunded === 1 ? 'purchase' : 'purchases' }}.
            }
          </ime-alert>
          @if (outcome.failedRefunds.length) {
            <ime-alert tone="error">
              Stripe refused {{ outcome.failedRefunds.length }} refunds. Follow
              up by hand:
              <span class="font-mono">{{
                outcome.failedRefunds.join(', ')
              }}</span>
            </ime-alert>
          }
        }
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }

        @if (record.openContest; as contest) {
          <section
            class="flex flex-col gap-3 rounded-card border border-accent bg-wash p-4"
            aria-labelledby="contest-heading"
          >
            <h2 id="contest-heading" class="font-semibold">
              The artist contests this copyright takedown
            </h2>
            <p class="text-sm text-ink-muted">
              Filed {{ contest.createdAt | date: 'medium' }}
            </p>
            <blockquote class="border-l-2 border-line pl-3 whitespace-pre-line">
              {{ contest.statement }}
            </blockquote>
            <label class="flex flex-col gap-1.5 text-sm font-medium">
              Note to the artist
              <textarea
                imeInput
                rows="2"
                [value]="contestNote()"
                (input)="contestNote.set(text($event))"
              ></textarea>
            </label>
            <div class="flex flex-wrap gap-2">
              <button
                imeButton
                [busy]="working() === 'upheld'"
                (click)="decideContest('upheld')"
              >
                Uphold: restore the release
              </button>
              <button
                imeButton
                variant="danger"
                [busy]="working() === 'rejected'"
                (click)="decideContest('rejected')"
              >
                Reject: make the takedown final
              </button>
            </div>
          </section>
        }

        @if (record.subject; as subject) {
          <section
            class="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
            aria-labelledby="decide-heading"
          >
            <h2 id="decide-heading" class="text-lg font-semibold">Decide</h2>
            @if (!subject.down) {
              <div class="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
                <label class="flex flex-col gap-1.5 text-sm font-medium">
                  Rule broken
                  <select imeInput (change)="reason.set(select($event))">
                    @for (option of reasons(); track option) {
                      <option [value]="option" [selected]="option === reason()">
                        {{ reasonLabel(option) }}
                      </option>
                    }
                  </select>
                </label>
                <label class="flex flex-col gap-1.5 text-sm font-medium">
                  Note to the people affected
                  <textarea
                    imeInput
                    rows="2"
                    maxlength="2000"
                    [value]="note()"
                    (input)="note.set(text($event))"
                  ></textarea>
                </label>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  imeButton
                  variant="danger"
                  [busy]="working() === 'takeDown'"
                  (click)="takeDown()"
                >
                  {{ takeDownLabel() }}
                </button>
                @if (targetType() === 'user') {
                  <button
                    imeButton
                    variant="secondary"
                    [busy]="working() === 'clear'"
                    (click)="clearProfile()"
                  >
                    Clear their name
                  </button>
                }
                @if (openReports()) {
                  <button
                    imeButton
                    variant="secondary"
                    [busy]="working() === 'dismiss'"
                    (click)="dismiss()"
                  >
                    Dismiss the reports
                  </button>
                }
              </div>
              <p class="text-sm text-ink-muted">{{ consequence() }}</p>
            } @else {
              <label class="flex flex-col gap-1.5 text-sm font-medium">
                Note
                <textarea
                  imeInput
                  rows="2"
                  maxlength="2000"
                  [value]="note()"
                  (input)="note.set(text($event))"
                ></textarea>
              </label>
              <div class="flex flex-wrap gap-2">
                @if (targetType() !== 'comment') {
                  <button
                    imeButton
                    variant="secondary"
                    [busy]="working() === 'restore'"
                    (click)="restore()"
                  >
                    {{
                      targetType() === 'artist' || targetType() === 'user'
                        ? 'Lift the suspension'
                        : 'Restore it'
                    }}
                  </button>
                }
                @if (openReports()) {
                  <button
                    imeButton
                    variant="secondary"
                    [busy]="working() === 'dismiss'"
                    (click)="dismiss()"
                  >
                    Dismiss the reports
                  </button>
                }
              </div>
            }
          </section>
        }

        <section class="flex flex-col gap-3" aria-labelledby="reports-heading">
          <h2 id="reports-heading" class="text-lg font-semibold">Reports</h2>
          <ul
            class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
          >
            @for (report of record.reports; track report.id) {
              <li class="flex flex-col gap-1 p-4 text-sm">
                <div
                  class="flex flex-wrap items-baseline justify-between gap-2"
                >
                  <span class="font-semibold">{{
                    reasonLabel(report.reason)
                  }}</span>
                  <span class="text-ink-muted">
                    {{ report.createdAt | date: 'medium' }} ·
                    <span [class.font-semibold]="report.status === 'open'">{{
                      report.status
                    }}</span>
                  </span>
                </div>
                @if (report.claimantName) {
                  <span
                    >Claim from {{ report.claimantName }} &lt;{{
                      report.claimantEmail
                    }}&gt;</span
                  >
                }
                @if (report.note) {
                  <p class="whitespace-pre-line">{{ report.note }}</p>
                }
              </li>
            } @empty {
              <li class="p-4 text-sm text-ink-muted">No reports.</li>
            }
          </ul>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="history-heading">
          <h2 id="history-heading" class="text-lg font-semibold">History</h2>
          <ul
            class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
          >
            @for (action of record.actions; track action.id) {
              <li class="flex flex-col gap-1 p-4 text-sm">
                <div
                  class="flex flex-wrap items-baseline justify-between gap-2"
                >
                  <span class="font-semibold">
                    {{ actionLabel(action.action) }}
                    @if (action.reason) {
                      <span class="font-normal text-ink-muted"
                        >for
                        {{ reasonLabel(action.reason).toLowerCase() }}</span
                      >
                    }
                  </span>
                  <span class="text-ink-muted">
                    {{ action.createdAt | date: 'medium' }} ·
                    {{ action.adminUserId ? 'an admin' : 'IME' }}
                  </span>
                </div>
                @if (action.note) {
                  <p class="whitespace-pre-line">{{ action.note }}</p>
                }
              </li>
            } @empty {
              <li class="p-4 text-sm text-ink-muted">Nothing done yet.</li>
            }
          </ul>
        </section>
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class CasePage {
  private readonly api = inject(ApiClient);

  public readonly targetType = input.required<ModerationTarget>();
  public readonly targetId = input.required<string>();

  protected readonly caseResource = resource({
    params: () => ({ type: this.targetType(), id: this.targetId() }),
    loader: async ({ params }) =>
      unwrap(await this.api.admin.getCase(params.type, params.id)),
  });
  protected readonly record = computed(() => currentValue(this.caseResource));

  protected readonly reasons = computed(() =>
    reportReasonsFor(this.targetType()),
  );
  /** The reason most reporters gave, to start from. */
  protected readonly reason = linkedSignal<ReportReason>(() => {
    const counts = new Map<ReportReason, number>();
    for (const report of this.record()?.reports ?? []) {
      if (report.status === 'open')
        counts.set(report.reason, (counts.get(report.reason) ?? 0) + 1);
    }
    const top = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    return top && this.reasons().includes(top) ? top : this.reasons()[0];
  });
  protected readonly note = signal('');
  protected readonly contestNote = signal('');
  protected readonly working = signal<Working | null>(null);
  protected readonly outcome = signal<ModerationOutcome | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly openReports = computed(
    () =>
      this.record()?.reports.some((report) => report.status === 'open') ??
      false,
  );

  protected readonly takeDownLabel = computed(() => {
    switch (this.targetType()) {
      case 'artist':
        return 'Suspend the artist';
      case 'user':
        return 'Suspend the user';
      case 'comment':
        return 'Delete the comment';
      default:
        return 'Take it down';
    }
  });

  protected readonly consequence = computed(() => {
    switch (this.targetType()) {
      case 'release':
        return this.reason() === 'copyright'
          ? 'Pulled from the catalog and every library. The artist has 14 days to contest; after that buyers are refunded and the files deleted.'
          : 'Pulled from the catalog and every library, buyers refunded, and the files deleted.';
      case 'product':
        return 'Pulled from the store. Orders not yet shipped are refunded.';
      case 'comment':
        return 'Deleted for good. It cannot be restored.';
      case 'design':
        return 'Removed from the marketplace and every release using it, and buyers refunded.';
      case 'artist':
        return 'Profile hidden, everything pulled from sale, uploads blocked. Listeners keep what they own.';
      case 'user':
        return 'They can still sign in and listen, but cannot comment, report, publish, or sell.';
    }
  });

  protected readonly targetLabel = moderationTargetLabel;
  protected readonly reasonLabel = reportReasonLabel;

  protected actionLabel(action: ModerationActionResponse['action']): string {
    return ACTION_LABELS[action];
  }

  protected excerpt(label: string): string {
    return label.length > 160 ? `${label.slice(0, 160)}…` : label;
  }

  protected text(event: Event): string {
    return (event.target as HTMLTextAreaElement).value;
  }

  protected select(event: Event): ReportReason {
    return (event.target as HTMLSelectElement).value as ReportReason;
  }

  protected async takeDown(): Promise<void> {
    await this.act('takeDown', () =>
      this.api.admin.takeDown(this.targetType(), this.targetId(), {
        reason: this.reason(),
        note: this.noteValue(),
      }),
    );
  }

  protected async dismiss(): Promise<void> {
    await this.act('dismiss', () =>
      this.api.admin.dismiss(
        this.targetType(),
        this.targetId(),
        this.noteValue() ?? undefined,
      ),
    );
  }

  protected async restore(): Promise<void> {
    await this.act('restore', () =>
      this.api.admin.restore(
        this.targetType(),
        this.targetId(),
        this.noteValue() ?? undefined,
      ),
    );
  }

  protected async clearProfile(): Promise<void> {
    await this.act('clear', () =>
      this.api.admin.clearProfile(this.targetId(), {
        reason: this.reason(),
        note: this.noteValue(),
      }),
    );
  }

  protected async decideContest(outcome: 'upheld' | 'rejected'): Promise<void> {
    await this.act(outcome, () =>
      this.api.admin.decideContest(
        this.targetId(),
        outcome,
        this.contestNote().trim() || undefined,
      ),
    );
  }

  private noteValue(): string | null {
    return this.note().trim() || null;
  }

  private async act(
    kind: Working,
    call: () => Promise<ApiResult<unknown>>,
  ): Promise<void> {
    this.working.set(kind);
    this.error.set(null);
    this.outcome.set(null);
    const result = await call();
    this.working.set(null);
    if (!result.ok) {
      this.error.set(result.error.message);
      return;
    }
    const data = result.data as Partial<ModerationOutcome>;
    this.outcome.set(
      typeof data?.refunded === 'number'
        ? (data as ModerationOutcome)
        : { refunded: 0, failedRefunds: [] },
    );
    this.note.set('');
    this.contestNote.set('');
    this.caseResource.reload();
  }
}
