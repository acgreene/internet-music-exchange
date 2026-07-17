/**
 * The category of an API failure. Client code branches on this to choose
 * the right user experience (retry, sign-in, bug report).
 */
export enum ApiErrorKind {
  /**
   * The API was unreachable.
   */
  Network = 'Network',

  /**
   * The server answered with an HTTP error. This branches further on the ApiError status property.
   */
  Http = 'Http',

  /**
   * The server answered successfully, but the response body violated the expected shape. This means that the client
   * and server are out of sync regarding the API contract.
   */
  InvalidResponse = 'InvalidResponse',
}

/**
 * Structured API failure carried inside an ApiResult. Extends Error so it keeps
 * a stack trace and interoperates with logging and Angular error handling.
 */
export class ApiError extends Error {
  constructor(
    /**
     * The category of failure.
     */
    public readonly kind: ApiErrorKind,
    /**
     * The HTTP status code, or null when no response was received.
     */
    public readonly status: number | null,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
