/**
 * Route paths served by the API. Values are wire format, shared by the server
 * for route registration and by the client SDK for request paths.
 */
export enum ApiRoute {
  /**
   * API health check.
   */
  Health = '/api/health',

  /**
   * The signed-in user resource: DELETE permanently removes the account.
   */
  Users = '/api/users',

  /**
   * Create an account.
   */
  SignUp = '/api/auth/sign-up',

  /**
   * Exchange email and password for a session.
   */
  SignIn = '/api/auth/sign-in',

  /**
   * Revoke the caller's session.
   */
  SignOut = '/api/auth/sign-out',

  /**
   * Everything needed to render a release within a designer page.
   */
  ArtistReleasePage = '/api/artist-pages/releases/:releaseId',
}
