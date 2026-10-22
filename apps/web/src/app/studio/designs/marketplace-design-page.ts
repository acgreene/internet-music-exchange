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
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import { ReportButton } from '@ime/client-listening';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { StudioService } from '../studio.service';
import { designPriceLabel } from './design-price';

/**
 * One design on the marketplace: what it is, the slots an artist fills in,
 * and getting it for the artist being worked on.
 */
@Component({
  selector: 'ime-marketplace-design-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    ReportButton,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-3xl flex-col gap-6">
      <a class="link text-sm" routerLink="/studio/marketplace">← Marketplace</a>
      @if (marketplace.error()) {
        <ime-alert tone="error">This design could not be found.</ime-alert>
      } @else if (detail(); as detail) {
        <header class="flex flex-col gap-1">
          <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
            {{ detail.design.name }}
          </h1>
          <p class="font-mono text-sm">
            {{ price(detail.design) }} · version {{ detail.latestVersion }}
          </p>
          <div>
            <ime-report-button
              targetType="design"
              [targetId]="detail.design.id"
              [label]="detail.design.name"
            />
          </div>
        </header>
        @if (detail.design.description) {
          <p class="max-w-prose whitespace-pre-line">
            {{ detail.design.description }}
          </p>
        }

        <section class="flex flex-col gap-2" aria-labelledby="slots-heading">
          <h2 id="slots-heading" class="text-lg font-semibold">
            What you fill in
          </h2>
          <ul
            class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
          >
            @for (slot of detail.slots; track slot.name) {
              <li class="flex items-center justify-between gap-4 p-3 text-sm">
                <span>{{ slot.label }}</span>
                <span class="font-mono text-ink-muted">{{ slot.kind }}</span>
              </li>
            } @empty {
              <li class="p-3 text-sm text-ink-muted">
                Nothing: it works from the release alone.
              </li>
            }
          </ul>
        </section>

        @if (studio.currentArtist(); as artist) {
          <section
            class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4"
            aria-labelledby="get-heading"
          >
            <h2 id="get-heading" class="font-semibold">
              Get it for {{ artist.name }}
            </h2>
            <p class="text-sm text-ink-muted">
              A license is permanent and covers every future version, on any of
              {{ artist.name }}'s releases.
            </p>
            @if (detail.design.pricingMode !== 'free') {
              <label class="flex flex-col gap-1.5 text-sm font-medium">
                Pay
                <span
                  class="flex w-48 items-center gap-2 rounded-control border border-line bg-canvas px-3"
                >
                  <span class="text-ink-muted">{{
                    detail.design.currency === 'eur' ? '€' : '$'
                  }}</span>
                  <input
                    class="h-10 w-full bg-transparent font-mono outline-none"
                    type="number"
                    inputmode="decimal"
                    step="0.01"
                    [min]="detail.design.minimumPrice / 100"
                    [value]="amount()"
                    (input)="amount.set(text($event))"
                  />
                </span>
              </label>
            }
            @if (licensed()) {
              <ime-alert tone="success">
                {{ artist.name }} has it.
                <a
                  class="link"
                  [routerLink]="['/studio/artists', artist.id, 'designs']"
                  >Apply it to a release</a
                >.
              </ime-alert>
            } @else {
              <div>
                <button imeButton [busy]="getting()" (click)="get(artist.id)">
                  {{
                    detail.design.pricingMode === 'free' ? 'Get it free' : 'Buy'
                  }}
                </button>
              </div>
            }
            @if (error(); as message) {
              <ime-alert tone="error">{{ message }}</ime-alert>
            }
          </section>
        } @else {
          <ime-alert>
            Designs are licensed to an artist.
            <a class="link" routerLink="/studio/artists/new"
              >Create an artist</a
            >
            to get one.
          </ime-alert>
        }
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class MarketplaceDesignPage {
  private readonly api = inject(ApiClient);
  protected readonly studio = inject(StudioService);

  public readonly designId = input.required<string>();

  protected readonly marketplace = resource({
    params: () => this.designId(),
    loader: async ({ params }) =>
      unwrap(await this.api.designs.getMarketplaceDesign(params)),
  });
  protected readonly detail = computed(() => currentValue(this.marketplace));

  private readonly licensedResource = resource({
    params: () => this.studio.currentArtist()?.id,
    loader: async ({ params }) =>
      unwrap(await this.api.designs.listLicensed(params)),
  });
  protected readonly licensed = computed(
    () =>
      currentValue(this.licensedResource)?.some(
        (design) => design.id === this.designId(),
      ) ?? false,
  );

  protected readonly amount = linkedSignal(() => {
    const design = this.detail()?.design;
    return (
      (design?.suggestedPrice ?? design?.minimumPrice ?? 0) / 100
    ).toFixed(2);
  });
  protected readonly getting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly price = designPriceLabel;

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async get(artistId: string): Promise<void> {
    const design = this.detail()?.design;
    if (!design) return;
    const amount =
      design.pricingMode === 'free'
        ? undefined
        : Math.round(Number(this.amount()) * 100);
    if (
      amount !== undefined &&
      (!Number.isFinite(amount) || amount < design.minimumPrice)
    ) {
      this.error.set('Enter at least the minimum price.');
      return;
    }
    this.getting.set(true);
    this.error.set(null);
    const result = await this.api.designs.acquire(artistId, design.id, amount);
    if (result.ok && result.data.status === 'payment') {
      // the designer is paid on Stripe's page, which sends the manager back
      window.location.assign(result.data.url);
      return;
    }
    this.getting.set(false);
    if (result.ok) this.licensedResource.reload();
    else this.error.set(result.error.message);
  }
}
