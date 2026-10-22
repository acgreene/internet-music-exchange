import {
  computed,
  inject,
  Injectable,
  isDevMode,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiClient, type ApiResult } from '@ime/api-client';
import type { OwnUser, SignUpResponse } from '@ime/models';

/**
 * Whether we know who is signed in yet. A server render never does, so it
 * stays `loading` and leaves the account controls out until the browser
 * takes over.
 */
export type SessionStatus = 'loading' | 'signed-in' | 'signed-out';

/**
 * The signed-in user, kept current as they sign in and out here or in
 * another tab. Every screen reads who is signed in from here.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiClient);
  private readonly inBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly currentUser = signal<OwnUser | null>(null);
  private readonly currentStatus = signal<SessionStatus>('loading');

  /** The signed-in user's profile, or null. */
  public readonly user = this.currentUser.asReadonly();
  public readonly status = this.currentStatus.asReadonly();
  public readonly isSignedIn = computed(() => this.status() === 'signed-in');
  public readonly isAdmin = computed(() => this.user()?.isAdmin ?? false);

  /** Set when a password-reset link signed the user in. */
  public readonly passwordRecovery = signal(false);

  constructor() {
    if (!this.inBrowser) return;
    this.api.user.onSessionChange(({ signedIn, passwordRecovery }) => {
      if (passwordRecovery) this.passwordRecovery.set(true);
      if (!signedIn) {
        this.currentUser.set(null);
        this.currentStatus.set('signed-out');
        return;
      }
      void this.refresh();
    });
  }

  /**
   * Read the signed-in user's profile again, as after editing it.
   */
  public async refresh(): Promise<void> {
    const result = await this.api.user.getMe();
    if (result.ok) {
      this.currentUser.set(result.data);
      this.currentStatus.set('signed-in');
      return;
    }
    if (isDevMode() && result.error.status !== 401) {
      console.warn('could not read the signed-in user', result.error);
    }
    this.currentUser.set(null);
    this.currentStatus.set('signed-out');
  }

  public async signIn(
    email: string,
    password: string,
  ): Promise<ApiResult<unknown>> {
    const result = await this.api.user.signIn(email, password);
    if (result.ok) await this.refresh();
    return result;
  }

  /**
   * Create an account. When the email must be confirmed first, the result
   * says so and nobody is signed in yet.
   */
  public async signUp(
    email: string,
    password: string,
  ): Promise<ApiResult<SignUpResponse>> {
    const result = await this.api.user.signUp(email, password);
    if (result.ok && 'access_token' in result.data) await this.refresh();
    return result;
  }

  public async signOut(): Promise<void> {
    await this.api.user.signOut();
    this.currentUser.set(null);
    this.currentStatus.set('signed-out');
  }
}
