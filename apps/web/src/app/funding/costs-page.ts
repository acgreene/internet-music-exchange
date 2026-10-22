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

/**
 * IME's open books, `/costs`: what running it costs each month, how that was
 * shared between sellers, and the reserve.
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
    <div class="mx-auto flex max-w-4xl flex-col gap-10">
      <header class="flex flex-col gap-4">
        <h1 class="text-5xl leading-[0.95] font-black tracking-[-0.05em]">
          What it costs to run IME
        </h1>
        <p class="max-w-prose text-lg">
          IME is built for, funded by, and hosted by the community, at cost. It
          takes nothing from sales. The people who sell here chip in for the
          hosting they use plus an even share of the bills that keep it online.
          No one profits from those contributions.
        </p>
        <p class="max-w-prose text-ink-muted">
          None of the platform's money goes to the people who build IME, as pay,
          profit, or margin. These are the real bills, every month.
        </p>
      </header>

      @if (costs.error()) {
        <ime-alert tone="error"
          >The costs could not be loaded. Try again in a moment.</ime-alert
        >
      } @else if (costs.hasValue() ? costs.value() : null; as data) {
        @if (latest(); as month) {
          <section class="flex flex-col gap-4" aria-labelledby="latest-heading">
            <h2
              id="latest-heading"
              class="text-2xl font-extrabold tracking-[-0.03em]"
            >
              {{ month.month | date: 'MMMM y' }}
            </h2>
            <dl
              class="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4"
            >
              <div class="flex flex-col gap-1 bg-surface p-4">
                <dt class="text-sm text-ink-muted">Total costs</dt>
                <dd class="font-mono text-2xl font-semibold">
                  {{ month.totalCosts | money: 'usd' }}
                </dd>
              </div>
              <div class="flex flex-col gap-1 bg-surface p-4">
                <dt class="text-sm text-ink-muted">Sellers sharing them</dt>
                <dd class="font-mono text-2xl font-semibold">
                  {{ month.sellerCount }}
                </dd>
              </div>
              <div class="flex flex-col gap-1 bg-surface p-4">
                <dt class="text-sm text-ink-muted">Typical seller's share</dt>
                <dd class="font-mono text-2xl font-semibold">
                  {{ month.medianShare | money: 'usd' }}
                </dd>
              </div>
              <div class="flex flex-col gap-1 bg-surface p-4">
                <dt class="text-sm text-ink-muted">Reserve now</dt>
                <dd class="font-mono text-2xl font-semibold">
                  {{ data.reserveBalance | money: 'usd' }}
                </dd>
              </div>
            </dl>

            <div
              class="overflow-hidden rounded-card border border-line bg-surface"
            >
              <table class="w-full border-collapse text-left text-sm">
                <caption class="sr-only">
                  Costs by category,
                  {{
                    month.month | date: 'MMMM y'
                  }}
                </caption>
                <tbody class="divide-y divide-hairline">
                  @for (category of categories; track category.key) {
                    <tr>
                      <th scope="row" class="p-4 font-normal">
                        <span class="block font-semibold">{{
                          category.label
                        }}</span>
                        <span class="text-ink-muted">{{ category.hint }}</span>
                      </th>
                      <td class="p-4 text-right font-mono whitespace-nowrap">
                        {{
                          month.costsByCategory[category.key] ?? 0
                            | money: 'usd'
                        }}
                      </td>
                    </tr>
                  }
                  <tr class="bg-surface-muted">
                    <th scope="row" class="p-4">Covered by IME's creators</th>
                    <td class="p-4 text-right font-mono whitespace-nowrap">
                      {{ month.subsidy | money: 'usd' }}
                    </td>
                  </tr>
                  <tr class="bg-surface-muted">
                    <th scope="row" class="p-4">Donations to the platform</th>
                    <td class="p-4 text-right font-mono whitespace-nowrap">
                      {{ month.platformDonations | money: 'usd' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="text-sm text-ink-muted">
              While there are few sellers, IME's creators cover part of the
              shared costs so shares stay small. Platform donations go into the
              reserve, which steadies shares in months when costs spike.
            </p>
          </section>

          @if (history().length > 1) {
            <section
              class="flex flex-col gap-3"
              aria-labelledby="history-heading"
            >
              <h2 id="history-heading" class="text-lg font-semibold">
                Past months
              </h2>
              <div
                class="overflow-x-auto rounded-card border border-line bg-surface"
              >
                <table
                  class="w-full min-w-[36rem] border-collapse text-left text-sm"
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
                        Typical share
                      </th>
                      <th scope="col" class="p-3 text-right font-semibold">
                        Creators covered
                      </th>
                      <th scope="col" class="p-3 text-right font-semibold">
                        Donations
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-hairline font-mono">
                    @for (row of history(); track row.month) {
                      <tr>
                        <th scope="row" class="p-3 font-sans font-normal">
                          {{ row.month | date: 'MMM y' }}
                        </th>
                        <td class="p-3 text-right">
                          {{ row.totalCosts | money: 'usd' }}
                        </td>
                        <td class="p-3 text-right">{{ row.sellerCount }}</td>
                        <td class="p-3 text-right">
                          {{ row.medianShare | money: 'usd' }}
                        </td>
                        <td class="p-3 text-right">
                          {{ row.subsidy | money: 'usd' }}
                        </td>
                        <td class="p-3 text-right">
                          {{ row.platformDonations | money: 'usd' }}
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
          class="flex flex-col gap-3 border-t border-line pt-8"
          aria-labelledby="how-heading"
        >
          <h2
            id="how-heading"
            class="text-2xl font-extrabold tracking-[-0.03em]"
          >
            How a seller's share works
          </h2>
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
          <div class="mt-2 flex flex-wrap gap-2">
            <a imeButton routerLink="/donate">Chip in</a>
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

  protected readonly costs = resource({
    id: 'public-costs',
    loader: async () => unwrap(await this.api.funding.getPublicCosts(12)),
  });

  /** Closed months, newest first. */
  protected readonly history = computed(() =>
    [...(currentValue(this.costs)?.months ?? [])].sort((a, b) =>
      b.month.localeCompare(a.month),
    ),
  );
  protected readonly latest = computed(() => this.history()[0] ?? null);
}
