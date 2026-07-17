/**
 * Connectivity of the API as observed by a client.
 */
export enum ApiStatus {
  /**
   * The client has not yet completed a health check.
   */
  Checking = 'checking',

  /**
   * The API is reachable and fully healthy.
   */
  Online = 'online',

  /**
   * The API is reachable but reports a degraded dependency.
   */
  Degraded = 'degraded',

  /**
   * The API cannot be reached.
   */
  Offline = 'offline',
}
