/**
 * HTTP status codes the API responds with.
 */
export enum HttpStatus {
  /**
   * The request succeeded.
   */
  Ok = 200,

  /**
   * The request was malformed or failed validation.
   */
  BadRequest = 400,

  /**
   * The request needs a valid sign-in.
   */
  Unauthorized = 401,

  /**
   * The caller is signed in but not allowed to do this.
   */
  Forbidden = 403,

  /**
   * The thing asked for does not exist, or is not visible to the caller.
   */
  NotFound = 404,

  /**
   * The request conflicts with the current state, such as a taken handle.
   */
  Conflict = 409,

  /**
   * The caller is being rate limited.
   */
  TooManyRequests = 429,

  /**
   * Something failed on the server.
   */
  InternalServerError = 500,
}
