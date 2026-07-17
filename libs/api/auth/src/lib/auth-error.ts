/**
 * Error from the auth service, carrying the HTTP status so API routes can
 * relay an appropriate status to clients.
 */
export class AuthError extends Error {
  constructor(
    /**
     * HTTP status returned by the auth service.
     */
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
