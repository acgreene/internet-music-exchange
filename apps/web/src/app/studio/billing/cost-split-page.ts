import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, type ApiResult, unwrap } from '@ime/api-client';
import { currentValue, SessionService } from '@ime/client-data';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { StudioService } from '../studio.service';

/**
 * Who pays the artist's hosting costs, and in what proportion. A new split
 * applies once every manager in it accepts their share.
 */
@Component({
  selector: 'ime-cost-split-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, RouterLink, SpinnerComponent],
  template: `
    <div class="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
          Hosting costs
        </h1>
        <p class="text-sm text-ink-muted">
          The artist's hosting costs come out of its managers'
          <a class="link" routerLink="/studio/billing">hosting balances</a>,
          split however you agree. Taking on a share needs a card on file.
        </p>
      </div>

      @if (splitResource.error()) {
        <ime-alert tone="error">The split could not be loaded.</ime-alert>
      } @else if (split(); as split) {
        <section class="flex flex-col gap-2" aria-labelledby="current-heading">
          <h2 id="current-heading" class="text-lg font-semibold">Now</h2>
          <ul
            class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
          >
            @for (share of split.shares; track share.userId) {
              <li class="flex items-center justify-between gap-4 p-4">
                <span>{{ nameOf(share.userId) }}</span>
                <span class="font-medium tabular-nums"
                  >{{ share.shareBasisPoints / 100 }}%</span
                >
              </li>
            } @empty {
              <li class="p-4 text-sm text-ink-muted">
                Nobody pays yet: nothing is hosted.
              </li>
            }
          </ul>
        </section>

        @if (split.proposal.length) {
          <section
            class="flex flex-col gap-2"
            aria-labelledby="proposal-heading"
          >
            <h2 id="proposal-heading" class="text-lg font-semibold">
              Proposed
            </h2>
            <ul
              class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
            >
              @for (share of split.proposal; track share.userId) {
                <li class="flex items-center justify-between gap-4 p-4">
                  <span>
                    {{ nameOf(share.userId) }}
                    <span class="text-sm text-ink-muted"
                      >· {{ share.acceptedAt ? 'accepted' : 'waiting' }}</span
                    >
                  </span>
                  <span class="font-medium tabular-nums"
                    >{{ share.shareBasisPoints / 100 }}%</span
                  >
                </li>
              }
            </ul>
            <div class="flex gap-2">
              @if (awaitingMe()) {
                <button
                  imeButton
                  [busy]="working() === 'accept'"
                  (click)="accept()"
                >
                  Accept my share
                </button>
              }
              <button
                imeButton
                variant="ghost"
                [busy]="working() === 'withdraw'"
                (click)="withdraw()"
              >
                Withdraw proposal
              </button>
            </div>
          </section>
        }

        <section class="flex flex-col gap-3" aria-labelledby="propose-heading">
          <h2 id="propose-heading" class="text-lg font-semibold">
            Propose a new split
          </h2>
          <div
            class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
          >
            @for (row of draft(); track row.userId; let index = $index) {
              <label class="flex items-center justify-between gap-4">
                <span>{{ nameOf(row.userId) }}</span>
                <span class="flex items-center gap-2">
                  <input
                    class="h-10 w-24 rounded-control border border-line bg-canvas px-2 text-right"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    [attr.aria-label]="'Share for ' + nameOf(row.userId)"
                    [value]="row.percent"
                    (input)="setPercent(index, $event)"
                  />
                  %
                </span>
              </label>
            }
            <p
              class="text-sm"
              [class.text-danger]="total() !== 100"
              [class.text-ink-muted]="total() === 100"
            >
              Total {{ total() }}%{{
                total() === 100 ? '' : ', which must come to 100%'
              }}
            </p>
            <div>
              <button
                imeButton
                variant="secondary"
                [disabled]="total() !== 100"
                [busy]="working() === 'propose'"
                (click)="propose()"
              >
                Propose
              </button>
            </div>
          </div>
        </section>
        @if (error(); as message) {
          <ime-alert tone="error">{{ message }}</ime-alert>
        }
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class CostSplitPage {
  private readonly api = inject(ApiClient);
  private readonly studio = inject(StudioService);
  private readonly session = inject(SessionService);

  private readonly artistId = computed(
    () => this.studio.currentArtistId() ?? undefined,
  );

  protected readonly splitResource = resource({
    params: this.artistId,
    loader: async ({ params }) =>
      unwrap(await this.api.funding.getCostSplit(params)),
  });
  private readonly managersResource = resource({
    params: this.artistId,
    loader: async ({ params }) =>
      unwrap(await this.api.artists.listManagers(params)),
  });

  protected readonly split = computed(() => currentValue(this.splitResource));
  private readonly managers = computed(
    () => currentValue(this.managersResource) ?? [],
  );

  /** A row per manager, starting from the split as it stands. */
  protected readonly draft = linkedSignal(() => {
    const shares = new Map(
      (this.split()?.shares ?? []).map((share) => [
        share.userId,
        share.shareBasisPoints,
      ]),
    );
    return this.managers().map((manager) => ({
      userId: manager.userId,
      percent: String((shares.get(manager.userId) ?? 0) / 100),
    }));
  });
  protected readonly total = computed(
    () =>
      Math.round(
        this.draft().reduce((sum, row) => sum + (Number(row.percent) || 0), 0) *
          100,
      ) / 100,
  );

  protected readonly awaitingMe = computed(() => {
    const me = this.session.user()?.id;
    return (
      this.split()?.proposal.some(
        (share) => share.userId === me && !share.acceptedAt,
      ) ?? false
    );
  });

  protected readonly working = signal<'accept' | 'withdraw' | 'propose' | null>(
    null,
  );
  protected readonly error = signal<string | null>(null);

  protected nameOf(userId: string): string {
    const manager = this.managers().find(
      (candidate) => candidate.userId === userId,
    );
    const name = manager?.name || manager?.username || 'A manager';
    return userId === this.session.user()?.id ? `${name} (you)` : name;
  }

  protected setPercent(index: number, event: Event): void {
    const percent = (event.target as HTMLInputElement).value;
    this.draft.update((rows) =>
      rows.map((row, at) => (at === index ? { ...row, percent } : row)),
    );
  }

  protected async propose(): Promise<void> {
    const artistId = this.artistId();
    if (!artistId) return;
    const shares = this.draft()
      .map((row) => ({
        userId: row.userId,
        shareBasisPoints: Math.round(Number(row.percent) * 100),
      }))
      .filter((share) => share.shareBasisPoints > 0);
    await this.run('propose', () =>
      this.api.funding.proposeCostSplit(artistId, shares),
    );
  }

  protected async accept(): Promise<void> {
    const artistId = this.artistId();
    if (artistId)
      await this.run('accept', () =>
        this.api.funding.acceptCostShare(artistId),
      );
  }

  protected async withdraw(): Promise<void> {
    const artistId = this.artistId();
    if (artistId)
      await this.run('withdraw', () =>
        this.api.funding.withdrawCostSplit(artistId),
      );
  }

  private async run(
    kind: 'accept' | 'withdraw' | 'propose',
    call: () => Promise<ApiResult<unknown>>,
  ): Promise<void> {
    this.working.set(kind);
    this.error.set(null);
    const result = await call();
    this.working.set(null);
    if (result.ok) this.splitResource.reload();
    else this.error.set(result.error.message);
  }
}
