import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClient } from '@ime/api-client';
import { SessionService } from '@ime/client-data';
import {
  CrateCard,
  DesignThumbnail,
  ReportButton,
  releasePriceLabel,
} from '@ime/client-listening';
import { designStyleName, type GalleryDesign } from '@ime/models';
import { AlertComponent, ButtonDirective, SpinnerComponent } from '@ime/ui';

/**
 * Anyone's public profile, `/users/<username>`: their crates, and for a
 * designer, their designs and a way to ask them for one.
 */
@Component({
  selector: 'ime-user-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AlertComponent,
    ButtonDirective,
    CrateCard,
    DesignThumbnail,
    ReportButton,
    RouterLink,
    SpinnerComponent,
  ],
  template: `
    @if (profile.isLoading()) {
      <ime-spinner />
    } @else if (profile.error()) {
      <ime-alert tone="error">{{ profile.error()?.message }}</ime-alert>
    } @else if (profile.value(); as user) {
      <div class="flex flex-col gap-1">
        <h1 class="text-3xl font-extrabold tracking-[-0.04em]">
          {{ user.name || user.username }}
        </h1>
        <p class="text-ink-muted">&#64;{{ user.username }}</p>
        @if (user.openToCommissions && designs.value()?.length) {
          <div class="mt-3">
            <a
              imeButton
              [routerLink]="['/designs', designs.value()![0].design.id]"
              fragment="commission"
              >Ask for a design</a
            >
          </div>
        }
        @if (user.id !== session.user()?.id) {
          <div class="mt-2">
            <ime-report-button
              targetType="user"
              [targetId]="user.id"
              [label]="'@' + user.username"
            />
          </div>
        }
      </div>
      @if (designs.value()?.length) {
        <section
          class="mt-10 flex flex-col gap-4"
          aria-labelledby="designs-heading"
        >
          <h2
            id="designs-heading"
            class="text-2xl font-extrabold tracking-[-0.035em]"
          >
            Designs
          </h2>
          <ul class="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            @for (item of designs.value(); track item.design.id) {
              <li>
                <a
                  class="group flex flex-col gap-3"
                  [routerLink]="['/designs', item.design.id]"
                >
                  <ime-design-thumbnail [design]="item" />
                  <span class="flex items-baseline justify-between gap-3">
                    <span class="truncate font-bold group-hover:underline">{{
                      item.design.name
                    }}</span>
                    <span class="shrink-0 font-mono text-xs">{{
                      price(item)
                    }}</span>
                  </span>
                  @if (item.design.styles.length) {
                    <span
                      class="-mt-2 truncate font-mono text-xs text-ink-muted"
                      >{{ styleNames(item.design.styles) }}</span
                    >
                  }
                </a>
              </li>
            }
          </ul>
        </section>
      }
      @if (crates.value()?.length) {
        <section
          class="mt-10 flex flex-col gap-4"
          aria-labelledby="crates-heading"
        >
          <h2
            id="crates-heading"
            class="text-2xl font-extrabold tracking-[-0.035em]"
          >
            Crates
          </h2>
          <ul
            class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4 lg:grid-cols-6"
          >
            @for (crate of crates.value(); track crate.id) {
              <li><ime-crate-card [crate]="crate" [byLine]="false" /></li>
            }
          </ul>
        </section>
      }
    }
  `,
})
export class UserProfilePage {
  private readonly api = inject(ApiClient);
  protected readonly session = inject(SessionService);

  public readonly username = input.required<string>();

  /** Their listed designs, the most used first. */
  protected readonly designs = resource({
    params: () => this.username(),
    loader: async ({ params }) => {
      const result = await this.api.designs.listGallery({
        designer: params,
        sort: 'most-used',
      });
      return result.ok ? result.data.designs : [];
    },
  });

  protected price(item: GalleryDesign): string {
    return releasePriceLabel({
      mode: item.design.pricingMode,
      currency: item.design.currency,
      minimumPrice: item.design.minimumPrice,
      suggestedPrice: item.design.suggestedPrice,
    });
  }

  protected styleNames(ids: string[]): string {
    return ids.map(designStyleName).join(', ');
  }

  /** Their public crates. */
  protected readonly crates = resource({
    params: () => this.username(),
    loader: async ({ params }) => {
      const result = await this.api.crates.listByUsername(params);
      return result.ok ? result.data : [];
    },
  });

  protected readonly profile = resource({
    params: () => this.username(),
    loader: async ({ params }) => {
      const result = await this.api.user.getProfile(params);
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}
