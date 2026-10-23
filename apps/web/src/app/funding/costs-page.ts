import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import type { PublicCosts } from '@ime/models';
import {
  AlertComponent,
  ButtonDirective,
  MoneyPipe,
  SpinnerComponent,
} from '@ime/ui';

type Category = keyof PublicCosts['months'][number]['costsByCategory'];

const CATEGORIES: { key: Category; label: string; hint: string }[] = [
  {
    key: 'storage_and_delivery',
    label: 'Storage and delivery',
    hint: 'Audio, artwork, photos, and designs, stored and served.',
  },
  { key: 'hosting', label: 'Hosting', hint: 'The servers IME runs on.' },
  {
    key: 'database',
    label: 'Database',
    hint: 'Where accounts and the catalog live.',
  },
  {
    key: 'other_services',
    label: 'Other services',
    hint: 'Email, the domain, and monitoring.',
  },
  {
    key: 'ownership_guarantee',
    label: 'Ownership guarantee',
    hint: 'Files listeners own from sellers who left or stopped paying.',
  },
];

/** A four-minute song kept as a lossless master and a streaming copy. */
const BYTES_PER_SONG = 45_000_000;
/** Cover art and the other images that come with a release. */
const BYTES_PER_RELEASE = 3_000_000;
/** Files fetched to play a song once: the audio and its cover. */
const REQUESTS_PER_PLAY = 2;
const BYTES_PER_GB = 1_000_000_000;

const SOURCE_URL = 'https://github.com/acgreene/internet-music-exchange';

/**
 * IME's open books, `/costs`: what running it costs each month, who paid
 * for it, the reserve, what a seller would pay, and who chipped in.
 */
@Component({
  selector: 'ime-costs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    DatePipe,
    MoneyPipe,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="mx-auto flex max-w-4xl flex-col gap-14">
      <header class="flex flex-col gap-4">
        <span class="font-mono text-xs tracking-wider text-ink-muted uppercase"
          >Open books</span
        >
        <h1
          class="text-5xl leading-[0.95] font-black tracking-[-0.05em] text-balance"
        >
          What it costs to run IME
        </h1>
        <p class="max-w-prose text-lg">
          Artists and designers keep what they sell here. IME takes no cut and
          runs at cost: the people who sell share the real bills for hosting
          their work, and nobody behind IME makes money from that, not the
          platform, its developers, or its founder.
        </p>
      </header>

      @if (costs.error()) {
        <ime-alert tone="error"
          >The costs could not be loaded. Try again in a moment.</ime-alert
        >
      } @else if (costs.hasValue() ? costs.value() : null; as data) {
        @if (latest(); as month) {
          <section
            class="flex flex-col gap-6"
            aria-labelledby="headline-heading"
          >
            <h2
              id="headline-heading"
              class="max-w-3xl text-3xl leading-tight font-extrabold tracking-[-0.035em] text-balance md:text-4xl"
            >
              @switch (coverage()) {
                @case ('all') {
                  In {{ month.month | date: 'MMMM' : 'UTC' }}, IME's reserve
                  paid <span class="text-accent">every seller's share</span>.
                }
                @case ('part') {
                  In {{ month.month | date: 'MMMM' : 'UTC' }}, IME's reserve
                  paid
                  <span class="text-accent">{{ coveredPercent() }}%</span>
                  of every seller's share.
                }
                @default {
                  In {{ month.month | date: 'MMMM' : 'UTC' }}, every seller paid
                  <span class="text-accent">{{
                    month.sharedShare | money: 'usd'
                  }}</span>
                  toward IME's shared bills.
                }
              }
            </h2>
            <p class="max-w-prose text-ink-muted">
              @if (coverage() === 'none') {
                On top of that, each seller pays for storing their own files, at
                the provider's rate. The typical seller's whole share came to
                {{ month.medianShare | money: 'usd' }}.
              } @else {
                Each seller's part of the shared bills was
                {{ month.sharedShare | money: 'usd' }}, plus what storing their
                own files costs at the provider's rate. The typical seller's
                whole share came to {{ month.medianShare | money: 'usd' }}.
              }
            </p>
            <ul class="grid gap-3 sm:grid-cols-2">
              @if (data.covering) {
                <li [class]="promise">
                  <span class="font-bold">No card needed for now</span>
                  <span class="text-sm text-ink-muted"
                    >The reserve can pay a whole month of shares, so you can
                    start selling without a top-up.</span
                  >
                </li>
              } @else {
                <li [class]="promise">
                  <span class="font-bold"
                    >One {{ data.minimumTopUp | money: 'usd' }} top-up</span
                  >
                  <span class="text-sm text-ink-muted">{{ topUpLasts() }}</span>
                </li>
              }
              <li [class]="promise">
                <span class="font-bold">No cut of sales, ever</span>
                <span class="text-sm text-ink-muted"
                  >Artists and designers keep everything but the card
                  processor's fee.</span
                >
              </li>
            </ul>
          </section>

          <section class="flex flex-col gap-4" aria-labelledby="month-heading">
            <h2 id="month-heading" [class]="heading">
              {{ month.month | date: 'MMMM y' : 'UTC' }}, in full
            </h2>
            <div class="grid gap-4 md:grid-cols-2">
              <div [class]="panel">
                <h3 [class]="panelHeading">What it cost</h3>
                <table class="w-full border-collapse text-left text-sm">
                  <tbody class="divide-y divide-hairline">
                    @for (category of categories; track category.key) {
                      <tr>
                        <th scope="row" class="py-3 pr-4 font-normal">
                          <span class="block font-semibold">{{
                            category.label
                          }}</span>
                          <span class="text-ink-muted">{{
                            category.hint
                          }}</span>
                        </th>
                        <td
                          class="py-3 text-right align-top font-mono whitespace-nowrap"
                        >
                          {{
                            month.costsByCategory[category.key] ?? 0
                              | money: 'usd'
                          }}
                        </td>
                      </tr>
                    }
                    <tr class="font-bold">
                      <th scope="row" class="py-3 pr-4">Total</th>
                      <td class="py-3 text-right font-mono whitespace-nowrap">
                        {{ month.totalCosts | money: 'usd' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="flex flex-col gap-4">
                <div [class]="panel">
                  <h3 [class]="panelHeading">Who paid</h3>
                  <dl class="flex flex-col divide-y divide-hairline text-sm">
                    <div class="flex justify-between gap-4 py-3">
                      <dt>
                        <span class="block font-semibold"
                          >{{ month.sellerCount }} sellers</span
                        >
                        <span class="text-ink-muted"
                          >Their shares, without card fees.</span
                        >
                      </dt>
                      <dd class="font-mono">
                        {{ month.sellersPaid | money: 'usd' }}
                      </dd>
                    </div>
                    @if (month.coveredFromReserve) {
                      <div class="flex justify-between gap-4 py-3">
                        <dt>
                          <span class="block font-semibold">The reserve</span>
                          <span class="text-ink-muted"
                            >From what it held past its target.</span
                          >
                        </dt>
                        <dd class="font-mono">
                          {{ month.coveredFromReserve | money: 'usd' }}
                        </dd>
                      </div>
                    }
                  </dl>
                </div>

                <div [class]="panel">
                  <h3 [class]="panelHeading">The reserve</h3>
                  <p class="font-mono text-2xl font-semibold">
                    {{ data.reserveBalance | money: 'usd' }}
                    <span class="text-sm font-normal text-ink-muted"
                      >of {{ data.reserveTarget | money: 'usd' }}</span
                    >
                  </p>
                  <div
                    class="h-2 overflow-hidden rounded-full bg-hairline"
                    role="img"
                    [attr.aria-label]="reserveFull() + ' percent full'"
                  >
                    <div
                      class="h-full rounded-full bg-accent"
                      [style.width.%]="reserveFull()"
                    ></div>
                  </div>
                  <dl class="flex flex-col gap-1 text-sm">
                    <div class="flex justify-between gap-4">
                      <dt class="text-ink-muted">Gifts to hosting</dt>
                      <dd class="font-mono">
                        {{ month.platformDonations | money: 'usd' }}
                      </dd>
                    </div>
                    @if (month.reserveFunding) {
                      <div class="flex justify-between gap-4">
                        <dt class="text-ink-muted">Added by IME</dt>
                        <dd class="font-mono">
                          {{ month.reserveFunding | money: 'usd' }}
                        </dd>
                      </div>
                    }
                    <div class="flex justify-between gap-4">
                      <dt class="text-ink-muted">
                        Paid toward sellers' shares
                      </dt>
                      <dd class="font-mono">
                        {{ month.coveredFromReserve | money: 'usd' }}
                      </dd>
                    </div>
                  </dl>
                  <p class="text-sm text-ink-muted">
                    Gifts to IME's hosting fill a reserve. It keeps three months
                    of costs for months when they spike, and anything past that
                    pays sellers' shares.
                  </p>
                </div>
              </div>
            </div>
          </section>

          @if (thanks().length) {
            <section
              class="flex flex-col gap-3 rounded-card border border-line bg-surface p-5"
              aria-labelledby="thanks-heading"
            >
              <h2 id="thanks-heading" class="text-lg font-bold">
                Thank you to everyone who chipped in this
                {{ data.thanks.month | date: 'MMMM' : 'UTC' }}
              </h2>
              <p class="leading-relaxed">{{ thanks() }}</p>
              <a class="link text-sm" routerLink="/donate">Chip in</a>
            </section>
          }

          <section
            class="flex flex-col gap-4"
            aria-labelledby="estimate-heading"
          >
            <h2 id="estimate-heading" [class]="heading">What would you pay?</h2>
            <div
              class="grid gap-6 rounded-card border border-line bg-surface p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center"
            >
              <div class="flex flex-col gap-4">
                <label class="flex flex-col gap-1.5 text-sm font-medium">
                  Songs you'd put on IME
                  <input
                    class="h-10 w-40 rounded-control border border-line bg-canvas px-3 font-mono"
                    type="number"
                    min="0"
                    max="100000"
                    inputmode="numeric"
                    [value]="songs()"
                    (input)="songs.set(count($event))"
                  />
                </label>
                <label class="flex flex-col gap-1.5 text-sm font-medium">
                  Releases they're on
                  <input
                    class="h-10 w-40 rounded-control border border-line bg-canvas px-3 font-mono"
                    type="number"
                    min="0"
                    max="10000"
                    inputmode="numeric"
                    [value]="releases()"
                    (input)="releases.set(count($event))"
                  />
                </label>
                <label class="flex flex-col gap-1.5 text-sm font-medium">
                  Plays a month
                  <input
                    class="h-10 w-40 rounded-control border border-line bg-canvas px-3 font-mono"
                    type="number"
                    min="0"
                    max="100000000"
                    inputmode="numeric"
                    [value]="plays()"
                    (input)="plays.set(count($event))"
                  />
                </label>
              </div>
              @if (estimate(); as estimate) {
                <div class="flex flex-col gap-2">
                  <p class="text-sm text-ink-muted">About</p>
                  <p
                    class="font-mono text-5xl font-semibold tracking-tight text-accent"
                  >
                    {{ estimate.total | money: 'usd' }}
                  </p>
                  <p class="text-sm text-ink-muted">a month</p>
                  <dl class="mt-2 flex flex-col gap-1 text-sm">
                    <div class="flex justify-between gap-4">
                      <dt>Storing and serving your files</dt>
                      <dd class="font-mono">
                        {{ estimate.usage | money: 'usd' }}
                      </dd>
                    </div>
                    <div class="flex justify-between gap-4">
                      <dt>Your part of the shared bills</dt>
                      <dd class="font-mono">
                        {{ estimate.shared | money: 'usd' }}
                      </dd>
                    </div>
                  </dl>
                  @if (data.covering) {
                    <p class="text-sm font-medium">
                      Right now, the reserve pays this for you.
                    </p>
                  }
                  <p class="text-xs text-ink-muted">
                    A rough guide at last month's rates, counting a lossless
                    master and a streaming copy of each song. Your statement
                    shows the exact amount.
                  </p>
                </div>
              }
            </div>
          </section>

          @if (history().length) {
            <section
              class="flex flex-col gap-3"
              aria-labelledby="history-heading"
            >
              <h2 id="history-heading" class="text-lg font-semibold">
                Earlier months
              </h2>
              <div
                class="overflow-x-auto rounded-card border border-line bg-surface"
              >
                <table
                  class="w-full min-w-[38rem] border-collapse text-left text-sm"
                >
                  <thead class="border-b border-line">
                    <tr>
                      <th scope="col" class="p-3 font-semibold">Month</th>
                      <th scope="col" class="p-3 text-right font-semibold">
                        Costs
                      </th>
                      <th scope="col" class="p-3 text-right font-semibold">
                        Sellers
                      </th>
                      <th scope="col" class="p-3 text-right font-semibold">
                        Shared part
                      </th>
                      <th scope="col" class="p-3 text-right font-semibold">
                        Typical share
                      </th>
                      <th scope="col" class="p-3 text-right font-semibold">
                        Reserve paid
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-hairline font-mono">
                    @for (row of history(); track row.month) {
                      <tr>
                        <th scope="row" class="p-3 font-sans font-normal">
                          {{ row.month | date: 'MMM y' : 'UTC' }}
                        </th>
                        <td class="p-3 text-right">
                          {{ row.totalCosts | money: 'usd' }}
                        </td>
                        <td class="p-3 text-right">{{ row.sellerCount }}</td>
                        <td class="p-3 text-right">
                          {{ row.sharedShare | money: 'usd' }}
                        </td>
                        <td class="p-3 text-right">
                          {{ row.medianShare | money: 'usd' }}
                        </td>
                        <td class="p-3 text-right">
                          {{ row.coveredFromReserve | money: 'usd' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </section>
          }
        } @else {
          <ime-alert>
            No month has closed yet. The first month's costs appear here once it
            ends and its shares are worked out.
          </ime-alert>
        }

        <section
          class="flex flex-col gap-5 border-t border-line pt-10"
          aria-labelledby="catch-heading"
        >
          <h2 id="catch-heading" [class]="heading">So what's the catch?</h2>
          <p class="max-w-prose text-lg">
            There isn't one. Storing music costs very little. What makes selling
            music online expensive is the cut a platform takes, and IME takes
            none.
          </p>
          <ul class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <li class="flex flex-col gap-1">
              <span class="font-bold">No cut, no ads, no paid placement</span>
              <span class="text-ink-muted"
                >IME earns nothing from what you sell, and nobody can buy their
                way up the charts or the gallery.</span
              >
            </li>
            <li class="flex flex-col gap-1">
              <span class="font-bold">Every bill, every month</span>
              <span class="text-ink-muted"
                >This page shows what IME paid and who paid it, down to the
                cent.</span
              >
            </li>
            <li class="flex flex-col gap-1">
              <span class="font-bold">The code is public</span>
              <span class="text-ink-muted"
                >Anyone can read how shares are worked out.
                <a class="link" [href]="sourceUrl">See the source code</a
                >.</span
              >
            </li>
            <li class="flex flex-col gap-1">
              <span class="font-bold">Cheaper as IME grows</span>
              <span class="text-ink-muted"
                >The shared bills are split evenly, so each new seller makes
                everyone's share smaller.</span
              >
            </li>
          </ul>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="how-heading">
          <h2 id="how-heading" [class]="heading">How a seller's share works</h2>
          <ul class="flex max-w-prose list-disc flex-col gap-2 pl-5">
            <li>
              <b>What you use.</b> Storing and serving your files, at the
              provider's actual rates, with nothing added.
            </li>
            <li>
              <b>An even share</b> of the bills that belong to no one seller.
            </li>
            <li><b>Card fees</b> on your own top-ups.</li>
            <li>
              Never a cut of what you sell. Listeners never pay to listen.
            </li>
          </ul>
          <div class="mt-2 flex flex-wrap gap-3">
            <a imeButton routerLink="/studio">Sell on IME</a>
            <a imeButton variant="secondary" routerLink="/donate">Chip in</a>
          </div>
        </section>
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class CostsPage {
  private readonly api = inject(ApiClient);

  protected readonly categories = CATEGORIES;
  protected readonly sourceUrl = SOURCE_URL;
  protected readonly heading = 'text-2xl font-extrabold tracking-[-0.03em]';
  protected readonly panel =
    'flex flex-col gap-3 rounded-card border border-line bg-surface p-5';
  protected readonly panelHeading =
    'font-mono text-xs tracking-wider text-ink-muted uppercase';
  protected readonly promise =
    'flex flex-col gap-1 rounded-card border border-line bg-surface p-4';

  protected readonly costs = resource({
    id: 'public-costs',
    loader: async () => unwrap(await this.api.funding.getPublicCosts(12)),
  });

  /** Closed months, newest first. */
  private readonly months = computed(() =>
    [...(currentValue(this.costs)?.months ?? [])].sort((a, b) =>
      b.month.localeCompare(a.month),
    ),
  );
  protected readonly latest = computed(() => this.months()[0] ?? null);
  /** The months before the one shown in full. */
  protected readonly history = computed(() => this.months().slice(1));

  protected readonly reserveFull = computed(() => {
    const data = currentValue(this.costs);
    if (!data?.reserveTarget) return 0;
    return Math.min(
      100,
      Math.round((data.reserveBalance / data.reserveTarget) * 100),
    );
  });

  /** How much of the latest month's shares the reserve paid. */
  protected readonly coverage = computed<'all' | 'part' | 'none'>(() => {
    const month = this.latest();
    if (!month?.coveredFromReserve) return 'none';
    return month.sellersPaid === 0 ? 'all' : 'part';
  });
  protected readonly coveredPercent = computed(() => {
    const month = this.latest();
    if (!month) return 0;
    const owed = month.sellersPaid + month.coveredFromReserve;
    return owed ? Math.round((month.coveredFromReserve / owed) * 100) : 0;
  });

  protected readonly thanks = computed(() =>
    (currentValue(this.costs)?.thanks.names ?? []).join(', '),
  );

  /** How long the smallest top-up lasts the typical seller. */
  protected readonly topUpLasts = computed(() => {
    const data = currentValue(this.costs);
    const share = this.latest()?.medianShare ?? 0;
    if (!data || share <= 0) return 'lasts a long time.';
    const months = Math.floor(data.minimumTopUp / share);
    if (months >= 24) return 'covers the typical seller for years.';
    if (months >= 12) return 'covers the typical seller for over a year.';
    return `covers the typical seller for about ${months} ${months === 1 ? 'month' : 'months'}.`;
  });

  protected readonly songs = signal(12);
  protected readonly releases = signal(1);
  protected readonly plays = signal(1000);

  /** A seller's monthly share for a catalog this size, at last month's rates. */
  protected readonly estimate = computed(() => {
    const data = currentValue(this.costs);
    const month = this.latest();
    if (!data?.rates || !month) return null;
    const gb =
      (this.songs() * BYTES_PER_SONG + this.releases() * BYTES_PER_RELEASE) /
      BYTES_PER_GB;
    const requests = this.plays() * REQUESTS_PER_PLAY;
    // rates are in millionths of a dollar; shares are in cents
    const usage = Math.round(
      (gb * data.rates.storageMicrodollarsPerGbMonth +
        (requests / 1_000_000) * data.rates.requestMicrodollarsPerMillion) /
        10_000,
    );
    return {
      usage,
      shared: month.sharedShare,
      total: usage + month.sharedShare,
    };
  });

  protected count(event: Event): number {
    const value = Number((event.target as HTMLInputElement).value);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
}
