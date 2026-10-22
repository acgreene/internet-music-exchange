import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiClient } from '@ime/api-client';
import { SessionService } from '@ime/client-data';
import { ButtonDirective } from '@ime/ui';

/**
 * Follow or unfollow an artist. Signed out, it leads to sign-in and back.
 */
@Component({
  selector: 'ime-follow-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective, RouterLink],
  template: `
    @if (session.status() === 'signed-out') {
      <a
        imeButton
        size="sm"
        routerLink="/sign-in"
        [queryParams]="{ returnUrl: router.url }"
        >Follow</a
      >
    } @else {
      <button
        imeButton
        size="sm"
        [variant]="following() ? 'secondary' : 'primary'"
        [busy]="busy() || session.status() === 'loading'"
        [attr.aria-pressed]="following()"
        (click)="toggle()"
      >
        {{ following() ? 'Following' : 'Follow' }}
      </button>
    }
  `,
})
export class FollowButton {
  private readonly api = inject(ApiClient);
  protected readonly session = inject(SessionService);
  protected readonly router = inject(Router);

  public readonly artistId = input.required<string>();
  public readonly following = model(false);
  protected readonly busy = signal(false);

  protected async toggle(): Promise<void> {
    const wasFollowing = this.following();
    this.busy.set(true);
    this.following.set(!wasFollowing);
    const result = wasFollowing
      ? await this.api.community.unfollow(this.artistId())
      : await this.api.community.follow(this.artistId());
    if (!result.ok) this.following.set(wasFollowing);
    this.busy.set(false);
  }
}
