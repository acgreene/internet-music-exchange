import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import {
  moderationTargetLabel,
  reportReasonLabel,
} from '@ime/client-listening';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';

/**
 * Everything with open reports, one row per item, longest waiting first.
 */
@Component({
  selector: 'ime-queue-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-4xl flex-col gap-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-[-0.04em]">Reports</h1>
          <p class="text-sm text-ink-muted">
            Open reports, grouped by what was reported, oldest first.
          </p>
        </div>
        <button
          imeButton
          variant="secondary"
          size="sm"
          (click)="queue.reload()"
        >
          Refresh
        </button>
      </div>

      @if (queue.error()) {
        <ime-alert tone="error">The queue could not be loaded.</ime-alert>
      } @else if (groups(); as groups) {
        <ul
          class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
        >
          @for (group of groups; track group.targetType + group.targetId) {
            <li>
              <a
                class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-4 hover:bg-wash"
                [routerLink]="[
                  '/admin/cases',
                  group.targetType,
                  group.targetId,
                ]"
              >
                <span class="flex min-w-0 flex-col">
                  <span class="truncate font-semibold">{{
                    group.subject?.label ?? 'Gone'
                  }}</span>
                  <span class="truncate text-sm text-ink-muted">
                    <span>{{ targetLabel(group.targetType) }}</span>
                    @if (group.subject?.context; as context) {
                      <span>, {{ context }}</span>
                    }
                    @if (group.subject?.down) {
                      <span>, <span class="text-danger">down</span></span>
                    }
                  </span>
                  <span class="text-sm">{{ reasons(group.reasons) }}</span>
                </span>
                <span class="flex flex-col items-end text-sm">
                  <span class="font-mono"
                    >{{ group.reports }}
                    {{ group.reports === 1 ? 'report' : 'reports' }}</span
                  >
                  <span class="text-ink-muted"
                    >since
                    {{ group.firstReportedAt | date: 'mediumDate' }}</span
                  >
                </span>
              </a>
            </li>
          } @empty {
            <li class="p-4 text-ink-muted">
              Nothing waiting. The queue is clear.
            </li>
          }
        </ul>
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class QueuePage {
  private readonly api = inject(ApiClient);

  protected readonly queue = resource({
    loader: async () => unwrap(await this.api.admin.listQueue(200)),
  });
  protected readonly groups = computed(() => currentValue(this.queue));
  protected readonly targetLabel = moderationTargetLabel;

  protected reasons(
    reasons: Parameters<typeof reportReasonLabel>[0][],
  ): string {
    return reasons.map(reportReasonLabel).join(', ');
  }
}
