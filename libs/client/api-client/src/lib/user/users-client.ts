import type {
  AuthError as SupabaseAuthError,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import {
  type AckResponse,
  type AvailabilityResponse,
  type OwnUser,
  type PublicUser,
  type UpdateProfileRequest,
  ApiError,
  ApiErrorKind,
  ApiRoute,
  type SessionResponse,
  type SignUpResponse,
  type UserUpdate,
} from '@ime/models';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

export class UsersClient {
  constructor(
    private readonly transport: ApiTransport,
    private readonly supabase: SupabaseClient,
  ) {}

  /**
   * The signed-in user, or null when signed out.
   */
  public async currentUser(): Promise<User | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.user ?? null;
  }

  /**
   * Create an account through the API, accepting the terms. When the email
   * address must be confirmed first there is no session yet; otherwise the
   * returned session is adopted.
   */
  public async signUp(
    email: string,
    password: string,
  ): Promise<ApiResult<SignUpResponse>> {
    const result = await this.transport.post(ApiRoute.SignUp, {
      body: { email, password, acceptedTerms: true },
    });
    if (result.ok && 'access_token' in result.data) {
      await this.adoptSession(result.data);
    }
    return result;
  }

  /**
   * Sign in through the API and adopt the returned session.
   */
  public async signIn(
    email: string,
    password: string,
  ): Promise<ApiResult<SessionResponse>> {
    const result = await this.transport.post(ApiRoute.SignIn, {
      body: { email, password },
    });
    if (result.ok) {
      await this.adoptSession(result.data);
    }
    return result;
  }

  /**
   * Revoke the session through the API and clear it locally. The local
   * session is cleared even when the server call fails, so the client always
   * signs out.
   */
  public async signOut(): Promise<ApiResult<AckResponse>> {
    const result = await this.transport.post(ApiRoute.SignOut);
    await this.supabase.auth.signOut({ scope: 'local' });
    return result;
  }

  /**
   * Update the signed-in user's email or password.
   */
  public async update(attributes: UserUpdate): Promise<ApiResult<User>> {
    const { data, error } = await this.supabase.auth.updateUser(attributes);
    if (error) {
      return { ok: false, error: this.toApiError(error) };
    }
    return { ok: true, data: data.user };
  }

  /**
   * Permanently delete the signed-in user's account through the API, which
   * holds the secret key, then clear the local session.
   */
  public async deleteAccount(): Promise<ApiResult<AckResponse>> {
    const result = await this.transport.delete(ApiRoute.Users);
    if (result.ok) {
      await this.supabase.auth.signOut({ scope: 'local' });
    }
    return result;
  }

  /**
   * Be told whenever the session changes: signing in or out, here or in
   * another tab, a refreshed token, or a password-reset link being opened.
   *
   * @returns A function that stops listening.
   */
  public onSessionChange(
    listener: (change: {
      signedIn: boolean;
      passwordRecovery: boolean;
    }) => void,
  ): () => void {
    const { data } = this.supabase.auth.onAuthStateChange((event, session) =>
      listener({
        signedIn: session !== null,
        passwordRecovery: event === 'PASSWORD_RECOVERY',
      }),
    );
    return () => data.subscription.unsubscribe();
  }

  /**
   * Email a link to reset the password. The link signs the user in at
   * `redirectTo`, where they choose a new one with `update`.
   */
  public async requestPasswordReset(
    email: string,
    redirectTo: string,
  ): Promise<ApiResult<AckResponse>> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return error
      ? { ok: false, error: this.toApiError(error) }
      : { ok: true, data: { success: true } };
  }

  /**
   * The signed-in user's own profile, including whether they are an admin.
   */
  public getMe(): Promise<ApiResult<OwnUser>> {
    return this.transport.get(ApiRoute.Me);
  }

  /**
   * Change the signed-in user's username or display name.
   */
  public updateProfile(
    changes: UpdateProfileRequest,
  ): Promise<ApiResult<PublicUser>> {
    return this.transport.patch(ApiRoute.Me, { body: changes });
  }

  /**
   * Anyone's public profile, by username.
   */
  public getProfile(username: string): Promise<ApiResult<PublicUser>> {
    return this.transport.get(ApiRoute.UserProfile, { params: { username } });
  }

  /**
   * Whether a username is free for the signed-in user to take.
   */
  public isUsernameAvailable(
    username: string,
  ): Promise<ApiResult<AvailabilityResponse>> {
    return this.transport.get(ApiRoute.UsernameAvailability, {
      params: { username },
    });
  }

  /**
   * Hand a session returned by our API to supabase so it persists and
   * refreshes it from here on.
   * @private
   */
  private async adoptSession(session: SessionResponse): Promise<void> {
    await this.supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  }

  private toApiError(error: SupabaseAuthError): ApiError {
    return new ApiError(
      error.status ? ApiErrorKind.Http : ApiErrorKind.Network,
      error.status ?? null,
      error.message,
    );
  }
}
