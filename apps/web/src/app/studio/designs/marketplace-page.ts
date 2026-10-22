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
import {
  AlertComponent,
  ButtonDirective,
  InputDirective,
  SpinnerComponent,
} from '@ime/ui';
import { designPriceLabel } from './design-price';

/**
 * The design marketplace: page designs built by independent designers for
 * release pages, newest first, with search by name.
 */
@Component({
  selector: 'ime-marketplace-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    InputDirective,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    <div class="flex max-w-5xl flex-col gap-6">
      <div>
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
          Design marketplace
        </h1>
        <p class="max-w-prose text-sm text-ink-muted">
          Release page designs made by independent designers. Get one for your
          artist, then fill it with your own words and images. Designers are
          paid directly; IME takes nothing.
        </p>
      </div>

      <form class="flex max-w-xl gap-2" role="search" (submit)="search($event)">
        <input
          imeInput
          type="search"
          aria-label="Search designs"
          placeholder="Search designs by name"
          [value]="draft()"
          (input)="draft.set(text($event))"
        />
        <button imeButton type="submit" variant="secondary">Search</button>
      </form>

      @if (results.error()) {
        <ime-alert tone="error">The designs could not be loaded.</ime-alert>
      } @else if (designs(); as designs) {
        <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @for (design of designs; track design.id) {
            <li>
              <a
                class="flex h-full flex-col gap-2 rounded-card border border-line bg-surface p-4 hover:bg-wash"
                [routerLink]="['/studio/marketplace', design.id]"
              >
                <span class="text-lg font-bold tracking-[-0.02em]">{{
                  design.name
                }}</span>
                @if (design.description) {
                  <span class="line-clamp-3 text-sm text-ink-muted">{{
                    design.description
                  }}</span>
                }
                <span class="mt-auto font-mono text-sm">{{
                  price(design)
                }}</span>
              </a>
            </li>
          } @empty {
            <li class="text-ink-muted">
              {{
                query()
                  ? 'No designs match “' + query() + '”.'
                  : 'No designs yet. Designers publish them from their studio.'
              }}
            </li>
          }
        </ul>
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class MarketplacePage {
  private readonly api = inject(ApiClient);

  protected readonly draft = signal('');
  protected readonly query = signal('');

  protected readonly results = resource({
    params: () => ({ q: this.query() }),
    loader: async ({ params }) =>
      unwrap(
        params.q
          ? await this.api.designs.search(params.q)
          : await this.api.designs.browse({ limit: 60 }),
      ),
  });
  protected readonly designs = computed(() => currentValue(this.results));
  protected readonly price = designPriceLabel;

  protected text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected search(event: Event): void {
    event.preventDefault();
    this.query.set(this.draft().trim());
  }
}
