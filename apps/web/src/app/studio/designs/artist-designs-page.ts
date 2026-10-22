import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient, unwrap } from '@ime/api-client';
import { currentValue } from '@ime/client-data';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';
import { StudioService } from '../studio.service';

/**
 * The designs this artist can use: licensed, or granted privately by their
 * designer. Applying one happens in a release's editor.
 */
@Component({
  selector: 'ime-artist-designs-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonDirective, RouterLink, SpinnerComponent],
  template: `
    <div class="flex max-w-3xl flex-col gap-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
            Page designs
          </h1>
          <p class="text-sm text-ink-muted">
            Give a release its own look. Apply a design from the release's
            editor.
          </p>
        </div>
        <a imeButton routerLink="/studio/marketplace">Browse the marketplace</a>
      </div>

      @if (acquired() && !hasAcquired()) {
        <ime-alert tone="success">
          Paid. The design shows up here once Stripe confirms the payment,
          usually within a minute.
          <button class="link" (click)="licensedResource.reload()">
            Check again
          </button>
        </ime-alert>
      }

      @if (licensedResource.error()) {
        <ime-alert tone="error">The designs could not be loaded.</ime-alert>
      } @else if (licensed(); as licensed) {
        <ul
          class="flex flex-col divide-y divide-hairline rounded-card border border-line bg-surface"
        >
          @for (design of licensed; track design.id) {
            <li>
              <a
                class="flex flex-col gap-0.5 p-4 hover:bg-wash"
                [routerLink]="['/studio/marketplace', design.id]"
              >
                <span class="font-semibold">{{ design.name }}</span>
                @if (design.description) {
                  <span class="truncate text-sm text-ink-muted">{{
                    design.description
                  }}</span>
                }
              </a>
            </li>
          } @empty {
            <li class="p-4 text-ink-muted">
              None yet. Find one on the marketplace.
            </li>
          }
        </ul>
      } @else {
        <ime-spinner />
      }
    </div>
  `,
})
export class ArtistDesignsPage {
  private readonly api = inject(ApiClient);
  private readonly studio = inject(StudioService);

  protected readonly licensedResource = resource({
    params: () => this.studio.currentArtistId() ?? undefined,
    loader: async ({ params }) =>
      unwrap(await this.api.designs.listLicensed(params)),
  });
  protected readonly licensed = computed(() =>
    currentValue(this.licensedResource),
  );

  /** Set by Stripe when a manager comes back from paying for a design. */
  public readonly acquired = input<string>();

  protected readonly hasAcquired = computed(
    () =>
      this.licensed()?.some((design) => design.id === this.acquired()) ?? false,
  );
}
