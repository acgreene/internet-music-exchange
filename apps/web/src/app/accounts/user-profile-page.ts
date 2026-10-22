import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  resource,
} from '@angular/core';
import { ApiClient } from '@ime/api-client';
import { SessionService } from '@ime/client-data';
import { CrateCard, ReportButton } from '@ime/client-listening';
import { AlertComponent, SpinnerComponent } from '@ime/ui';

/**
 * Anyone's public profile, `/users/<username>`.
 */
@Component({
  selector: 'ime-user-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, CrateCard, ReportButton, SpinnerComponent],
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
