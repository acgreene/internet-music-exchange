import {
  type AuthError as SupabaseAuthError,
  createClient,
  type Session as SupabaseSession,
  type SupabaseClient,
  type User as SupabaseUser,
} from '@supabase/supabase-js';
import { DatabaseRepository } from '@ime/db';
import { env } from '@ime/env';
import { BillingService } from '../funding/billing-service';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';

/**
 * Supabase error codes that indicate rate limiting in addition to status 429.
 */
const RATE_LIMITED_CODES = new Set([
  'over_request_rate_limit',
  'over_email_send_rate_limit',
]);

/**
 * The version of the terms of service and privacy policy a new user accepts,
 * recorded with their account. Change it when either document changes.
 */
export const TERMS_VERSION = '2026-10-22';

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
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly billing: BillingService = new BillingService(db),
    /** Where confirmation emails send people back to. */
    private readonly webAppUrl: string = env.WEB_APP_URL,
    /**
     * Client bound to the publishable key for user-scoped operations.
     */
    private readonly publicClient: SupabaseClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_PUBLISHABLE_KEY,
      STATELESS_AUTH_OPTIONS,
    ),
    /**
     * Client bound to the secret key, for admin operations.
     */
    private readonly adminClient: SupabaseClient = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SECRET_KEY,
      STATELESS_AUTH_OPTIONS,
    ),
  ) {}

  /**
   * Create an account, recording which terms the user accepted. When
   * Supabase requires email confirmation, there is no session until the user
   * follows the link it emails them.
   *
   * @returns The new session, or null when the email must be confirmed first.
   * @throws ApiError 429 when rate limited.
   */
  public async signUp(
    email: string,
    password: string,
  ): Promise<SupabaseSession | null> {
    const { data, error } = await this.publicClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${this.webAppUrl}/sign-in?confirmed=1`,
        data: {
          termsVersion: TERMS_VERSION,
          termsAcceptedAt: new Date().toISOString(),
        },
      },
    });
    if (error) {
      if (this.isRateLimited(error)) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.TooManyRequests,
          'Too many sign-up attempts. Please try again later.',
        );
      }
      throw new ApiError(
        ApiErrorKind.Http,
        error.status ?? HttpStatus.InternalServerError,
        error.message,
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
    const { data, error } = await this.publicClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (this.isRateLimited(error)) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.TooManyRequests,
          'Too many login attempts. Please try again later.',
        );
      }
      if (error.code === 'email_not_confirmed') {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Forbidden,
          'Confirm your email address first, with the link we sent when you signed up.',
        );
      }
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Unauthorized,
        'Invalid email or password.',
      );
    }
    return data.session;
  }

  /**
   * Revoke the session behind the given access token, signs the user out.
   */
  public async signOut(accessToken: string): Promise<void> {
    const { error } = await this.adminClient.auth.admin.signOut(accessToken);
    if (error) {
      throw new ApiError(
        ApiErrorKind.Http,
        error.status ?? HttpStatus.InternalServerError,
        error.message,
      );
    }
  }

  /**
   * Fetch the user behind the given access token, validating it in the process.
   *
   * @throws ApiError 401 when the token is expired, revoked, or its user is
   * gone.
   */
  public async getUser(accessToken: string): Promise<SupabaseUser> {
    const { data, error } = await this.publicClient.auth.getUser(accessToken);
    if (error) {
      const status = error.status ?? HttpStatus.InternalServerError;
      if (
        status < HttpStatus.InternalServerError &&
        !this.isRateLimited(error)
      ) {
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Unauthorized,
          'Your session has ended. Sign in again.',
        );
      }
      throw new ApiError(
        ApiErrorKind.Http,
        error.status ?? HttpStatus.InternalServerError,
        error.message,
      );
    }
    return data.user;
  }

  /**
   * Permanently delete a user by id. Admin operation.
   */
  public async deleteUser(userId: string): Promise<void> {
    const soleArtists = await this.db.artists.listSolelyManagedArtists(userId);
    if (soleArtists.length > 0) {
      const names = soleArtists.map((artist) => artist.name).join(', ');
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        `You are the only manager of ${names}. Add another manager or delete the artist before deleting your account.`,
      );
    }

    // the account's prepaid hosting balance goes back to its card first
    await this.billing.refundOnAccountClose(userId);

    // a failure here is the platform's, so it is logged rather than shown
    const { error } = await this.adminClient.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error(`Could not delete user ${userId}: ${error.message}`);
    }
  }

  /**
   * Whether a supabase-js auth error represents rate limiting.
   */
  private isRateLimited(error: SupabaseAuthError): boolean {
    return (
      error.status === HttpStatus.TooManyRequests ||
      (typeof error.code === 'string' && RATE_LIMITED_CODES.has(error.code))
    );
  }
}
