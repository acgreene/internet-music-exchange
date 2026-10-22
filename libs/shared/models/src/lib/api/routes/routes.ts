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

  // Accounts

  /** The signed-in user's own profile: GET reads it, PATCH changes it. */
  Me = '/api/me',

  /** Anyone's public profile. */
  UserProfile = '/api/users/:username',

  /** Whether a username is free. */
  UsernameAvailability = '/api/availability/usernames/:username',

  /** Whether an artist handle is free. */
  HandleAvailability = '/api/availability/handles/:handle',

  // Artists

  /** Create an artist. */
  Artists = '/api/artists',

  /** The artists the signed-in user manages. */
  MyArtists = '/api/me/artists',

  /** Change an artist's name, handle, or bio. */
  Artist = '/api/artists/:artistId',

  /** An artist's public profile, by handle. */
  CatalogArtist = '/api/catalog/artists/:handle',

  /** Replace an artist's links. */
  ArtistLinks = '/api/artists/:artistId/links',

  /** Somewhere to upload an artist's avatar or header. */
  ArtistImageUploads = '/api/artists/:artistId/images/:kind/uploads',

  /** PUT records an uploaded avatar or header; DELETE removes it. */
  ArtistImage = '/api/artists/:artistId/images/:kind',

  /** GET lists an artist's managers; POST adds one by username. */
  ArtistManagers = '/api/artists/:artistId/managers',

  /** Remove one of an artist's managers. */
  ArtistManager = '/api/artists/:artistId/managers/:userId',
}
