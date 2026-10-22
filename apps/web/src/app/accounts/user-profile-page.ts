import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  resource,
} from '@angular/core';
import { ApiClient } from '@ime/api-client';
import { AlertComponent, SpinnerComponent } from '@ime/ui';

/**
 * Anyone's public profile, `/users/<username>`.
 */
@Component({
  selector: 'ime-user-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, SpinnerComponent],
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
      </div>
    }
  `,
})
export class UserProfilePage {
  private readonly api = inject(ApiClient);

  public readonly username = input.required<string>();

  protected readonly profile = resource({
    params: () => this.username(),
    loader: async ({ params }) => {
      const result = await this.api.user.getProfile(params);
      if (!result.ok) throw result.error;
      return result.data;
    },
  });
}
