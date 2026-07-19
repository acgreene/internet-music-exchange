import {
  type AuthError as SupabaseAuthError,
  createClient,
  type Session as SupabaseSession,
  type SupabaseClient,
  type User as SupabaseUser
} from '@supabase/supabase-js';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind } from '@ime/models';

/**
 * Supabase error codes that indicate rate limiting in addition to status 429.
 */
const RATE_LIMITED_CODES = new Set([
  'over_request_rate_limit',
  'over_email_send_rate_limit',
]);

/**
 * Options that keep server-side supabase-js clients stateless.
 */
const STATELESS_AUTH_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false },
};

/**
 * Service that coordinates with and wraps supabase auth.
 */
export class AuthService {
  constructor(
    /**
     * Client bound to the publishable key for user-scoped operations.
     */
    private readonly anonClient: SupabaseClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      STATELESS_AUTH_OPTIONS,
    ),
    /**
     * Client bound to the service role key, for admin operations.
     */
    private readonly adminClient: SupabaseClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      STATELESS_AUTH_OPTIONS,
    ),
  ) {}

  /**
   * Create an account.
   */
  public async signUp(
    email: string,
    password: string,
  ): Promise<SupabaseSession> {
    const { data, error } = await this.anonClient.auth.signUp({
      email,
      password,
    });
    if (error) {
      if (this.isRateLimited(error)) {
        throw new ApiError(
          ApiErrorKind.Http,
          429,
          'Too many sign-up attempts. Please try again later.',
        );
      }
      throw new ApiError(ApiErrorKind.Http, error.status ?? 500, error.message);
    }
    if (!data.session) {
      throw new ApiError(
        ApiErrorKind.Http,
        500,
        'Sign-up did not return a session; is email confirmation enabled?',
      );
    }
    return data.session;
  }

  /**
   * Exchange email and password for a session.
   */
  public async signIn(
    email: string,
    password: string,
  ): Promise<SupabaseSession> {
    const { data, error } = await this.anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (this.isRateLimited(error)) {
        throw new ApiError(
          ApiErrorKind.Http,
          429,
          'Too many login attempts. Please try again later.',
        );
      }
      throw new ApiError(ApiErrorKind.Http, 401, 'Invalid email or password.');
    }
    return data.session;
  }

  /**
   * Revoke the session behind the given access token, signs the user out.
   */
  public async signOut(accessToken: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.signOut(accessToken);
    if (error) {
      throw new ApiError(ApiErrorKind.Http, error.status ?? 500, error.message);
    }
  }

  /**
   * Fetch the user behind the given access token, validating it in the process.
   */
  public async getUser(accessToken: string): Promise<SupabaseUser> {
    const { data, error } = await this.anonClient.auth.getUser(accessToken);
    if (error) {
      throw new ApiError(ApiErrorKind.Http, error.status ?? 500, error.message);
    }
    return data.user;
  }

  /**
   * Permanently delete a user by id. Admin operation.
   */
  public async deleteUser(userId: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.deleteUser(userId);
    if (error) {
      throw new ApiError(ApiErrorKind.Http, error.status ?? 500, error.message);
    }
  }

  /**
   * Whether a supabase-js auth error represents rate limiting.
   */
  private isRateLimited(error: SupabaseAuthError): boolean {
    return (
      error.status === 429 ||
      (typeof error.code === 'string' && RATE_LIMITED_CODES.has(error.code))
    );
  }
}
