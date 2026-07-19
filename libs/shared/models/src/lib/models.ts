// Shared domain models. Types are defined here as features are implemented.

/**
 * Attributes a signed-in user can change about themselves.
 */
export interface UserUpdate {
  email?: string;
  password?: string;
}
