import {
  type AuthError as SupabaseAuthError,
  createClient,
  type Session as SupabaseSession,
  type SupabaseClient,
  type User as SupabaseUser
} from '@supabase/supabase-js';
import { env } from '@ime/env';
import type { Session, User } from '@ime/models';
import { AuthError } from './auth-error';

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
 * Auth domain service. Wraps supabase-js so routes never reach supabase.auth
 * directly; rate-limit detection and the admin / anon-client split live here.
 * Stateless: explicit tokens and the admin API, never client-held sessions,
 * because the API serves many users per process.
 */
export class AuthService {
  constructor(
    /**
     * Client bound to the publishable key, for user-scoped operations.
     * Defaults to a client built from the validated environment; pass one
     * explicitly only in tests.
     */
    private readonly anonClient: SupabaseClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_ANON_KEY,
      STATELESS_AUTH_OPTIONS,
    ),
    /**
     * Client bound to the service role key, for admin operations. Defaults to
     * a client built from the validated environment; pass one explicitly only
     * in tests.
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
  public async signUp(email: string, password: string): Promise<Session> {
    const { data, error } = await this.anonClient.auth.signUp({
      email,
      password,
    });
    if (error) {
      if (this.isRateLimited(error)) {
        throw new AuthError(
          429,
          'Too many sign-up attempts. Please try again later.',
        );
      }
      throw this.toAuthError(error);
    }
    if (!data.session) {
      throw new AuthError(
        500,
        'Sign-up did not return a session; is email confirmation enabled?',
      );
    }
    return this.toSession(data.session);
  }

  /**
   * Exchange email and password for a session.
   */
  public async signIn(email: string, password: string): Promise<Session> {
    const { data, error } = await this.anonClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (this.isRateLimited(error)) {
        throw new AuthError(
          429,
          'Too many login attempts. Please try again later.',
        );
      }
      throw new AuthError(401, 'Invalid email or password.');
    }
    return this.toSession(data.session);
  }

  /**
   * Revoke the session behind the given access token.
   */
  public async signOut(accessToken: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.signOut(accessToken);
    if (error) {
      throw this.toAuthError(error);
    }
  }

  /**
   * Fetch the user behind the given access token, validating it in the process.
   */
  public async getUser(accessToken: string): Promise<User> {
    const { data, error } = await this.anonClient.auth.getUser(accessToken);
    if (error) {
      throw this.toAuthError(error);
    }
    return this.toUser(data.user);
  }

  /**
   * Permanently delete a user by id. Admin operation.
   */
  public async deleteUser(userId: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.deleteUser(userId);
    if (error) {
      throw this.toAuthError(error);
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

  /**
   * Map a supabase-js auth error to our AuthError.
   */
  private toAuthError(error: SupabaseAuthError): AuthError {
    return new AuthError(error.status ?? 500, error.message);
  }

  /**
   * Map a supabase-js user to the domain user. Throws for users without an
   * email, which cannot happen for password-based accounts.
   */
  private toUser(user: SupabaseUser): User {
    if (!user.email) {
      throw new AuthError(500, 'Auth user is missing an email');
    }
    return { id: user.id, email: user.email, createdAt: user.created_at };
  }

  /**
   * Map a supabase-js session to the domain session.
   */
  private toSession(session: SupabaseSession): Session {
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt:
        session.expires_at ??
        Math.floor(Date.now() / 1000) + session.expires_in,
      user: this.toUser(session.user),
    };
  }
}
