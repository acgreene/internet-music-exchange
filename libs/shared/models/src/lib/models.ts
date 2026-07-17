// Shared domain models. Types are defined here as features are implemented.

/**
 * A user account.
 */
export interface User {
  id: string;
  email: string;
  createdAt: string;
}

/**
 * Attributes a signed-in user can change about themselves.
 */
export interface UserUpdate {
  email?: string;
  password?: string;
}

/**
 * An authenticated session: tokens plus the signed-in user. expiresAt is Unix
 * epoch seconds for the access token.
 */
export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: User;
}
