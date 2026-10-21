import { DrizzleQueryError } from 'drizzle-orm';

/**
 * Postgres error codes the API reacts to. See
 * https://www.postgresql.org/docs/current/errcodes-appendix.html.
 */
export enum PostgresErrorCode {
  /**
   * A unique constraint was violated, as when two people claim one handle.
   */
  UniqueViolation = '23505',

  /**
   * A foreign key was violated, as when deleting something still referenced.
   */
  ForeignKeyViolation = '23503',

  /**
   * A check constraint was violated.
   */
  CheckViolation = '23514',
}

/**
 * Read the Postgres error code from a failed query. Drizzle wraps the driver's
 * error, which carries the code, as the cause of its own.
 *
 * @returns The code, or undefined when the error did not come from Postgres.
 */
export function getPostgresErrorCode(error: unknown): string | undefined {
  if (!(error instanceof DrizzleQueryError)) return undefined;
  return (error.cause as { code?: string } | undefined)?.code;
}
