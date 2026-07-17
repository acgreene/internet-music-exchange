import type {
  AuthError as SupabaseAuthError,
  SupabaseClient,
  User as SupabaseUser,
} from '@supabase/supabase-js';
import {
  type AckResponse,
  ackResponseSchema,
  ApiRoute,
  type Session,
  sessionSchema,
  type User,
  type UserUpdate,
} from '@ime/models';
import { ApiError, ApiErrorKind } from '../api-error';
import type { ApiResult } from '../api-result';
import type { ApiTransport } from '../api-transport';

/**
 * Map a supabase-js auth failure to the SDK's ApiError.
 */
function toApiError(error: SupabaseAuthError): ApiError {
  return new ApiError(
    error.status ? ApiErrorKind.Http : ApiErrorKind.Network,
    error.status ?? null,
    error.message,
  );
}

/**
 * Map a supabase-js user to the domain user.
 */
function toUser(user: SupabaseUser): User {
  return { id: user.id, email: user.email ?? '', createdAt: user.created_at };
}

/**
 * Account and session operations, exposed as api.user on the ApiService
 * facade. Sign-up, sign-in, and sign-out go through our API routes, and the
 * returned tokens are adopted into supabase-js, which owns session
 * persistence, refresh, and multi-tab sync.
 */
export class UserApi {
  constructor(
    private readonly transport: ApiTransport,
    /**
     * Lazy source of the Supabase client, called only when an operation runs
     * so SSR never constructs the client.
     */
    private readonly supabase: () => SupabaseClient,
  ) {}

  /**
   * The signed-in user, or null when signed out.
   */
  public async currentUser(): Promise<User | null> {
    const { data } = await this.supabase().auth.getSession();
    return data.session ? toUser(data.session.user) : null;
  }

  /**
   * Create an account through the API and adopt the returned session.
   */
  public async signUp(
    email: string,
    password: string,
  ): Promise<ApiResult<Session>> {
    const result = await this.transport.post(
      ApiRoute.SignUp,
      { email, password },
      sessionSchema,
    );
    if (result.ok) {
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
  ): Promise<ApiResult<Session>> {
    const result = await this.transport.post(
      ApiRoute.SignIn,
      { email, password },
      sessionSchema,
    );
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
    const result = await this.transport.post(
      ApiRoute.SignOut,
      {},
      ackResponseSchema,
    );
    await this.supabase().auth.signOut({ scope: 'local' });
    return result;
  }

  /**
   * Update the signed-in user's email or password.
   */
  public async update(attributes: UserUpdate): Promise<ApiResult<User>> {
    const { data, error } = await this.supabase().auth.updateUser(attributes);
    if (error) {
      return { ok: false, error: toApiError(error) };
    }
    return { ok: true, data: toUser(data.user) };
  }

  /**
   * Permanently delete the signed-in user's account through the API, which
   * holds the service role key, then clear the local session.
   */
  public async deleteAccount(): Promise<ApiResult<AckResponse>> {
    const result = await this.transport.delete(
      ApiRoute.Users,
      ackResponseSchema,
    );
    if (result.ok) {
      await this.supabase().auth.signOut({ scope: 'local' });
    }
    return result;
  }

  /**
   * Hand a session returned by our API to supabase-js so it persists and
   * refreshes it from here on.
   * @private
   */
  private async adoptSession(session: Session): Promise<void> {
    await this.supabase().auth.setSession({
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });
  }
}
