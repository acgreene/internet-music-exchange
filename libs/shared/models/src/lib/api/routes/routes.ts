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

  // Releases, for managers

  /** POST starts a draft release; GET lists every release of the artist. */
  ArtistReleases = '/api/artists/:artistId/releases',

  /** A release with everything its managers edit. */
  Release = '/api/releases/:releaseId',

  /** Set how a release is priced. */
  ReleasePricing = '/api/releases/:releaseId/pricing',

  /** Put a release on sale. */
  ReleasePublish = '/api/releases/:releaseId/publish',

  /** Withdraw a release from the catalog. Owners keep it. */
  ReleaseArchive = '/api/releases/:releaseId/archive',

  /** POST adds a track; PUT sets the track order. */
  ReleaseTracks = '/api/releases/:releaseId/tracks',

  /** Rename a track or set its length. */
  Track = '/api/tracks/:trackId',

  /** Take a track off a release. */
  ReleaseTrack = '/api/releases/:releaseId/tracks/:trackId',

  /** Whether anyone may stream a track as a preview. */
  ReleaseTrackPreview = '/api/releases/:releaseId/tracks/:trackId/preview',

  /** Somewhere to upload a track's audio. */
  TrackAudioUploads = '/api/releases/:releaseId/tracks/:trackId/audio/uploads',

  /** Record a track's uploaded audio. */
  TrackAudio = '/api/releases/:releaseId/tracks/:trackId/audio',

  /** Somewhere to upload artwork or another release asset. */
  ReleaseAssetUploads = '/api/releases/:releaseId/assets/uploads',

  /** Record an uploaded release asset. */
  ReleaseAssets = '/api/releases/:releaseId/assets',

  /** PATCH changes an asset's details; DELETE removes it. */
  ReleaseAsset = '/api/assets/:assetId',

  /** Give a listener a release, by username. */
  ReleaseGifts = '/api/releases/:releaseId/gifts',

  // Catalog and library, for listeners

  /** The newest releases. */
  CatalogReleases = '/api/catalog/releases',

  /** Search artists and releases, `?q=`. */
  CatalogSearch = '/api/catalog/search',

  /** An artist's published releases. */
  CatalogDiscography = '/api/catalog/artists/:handle/releases',

  /** A release page. */
  CatalogReleasePage = '/api/catalog/artists/:handle/releases/:slug',

  /** A link that streams one track. */
  CatalogTrackStream = '/api/catalog/releases/:releaseId/tracks/:trackId/stream',

  /** A link that downloads one track's original, for owners. */
  CatalogTrackDownload = '/api/catalog/releases/:releaseId/tracks/:trackId/download',

  /** A link that opens a release asset. */
  CatalogAsset = '/api/catalog/assets/:assetId',

  /** The releases the signed-in user owns. */
  MyLibrary = '/api/me/library',

  /** New releases from the artists the signed-in user follows. */
  MyFeed = '/api/me/feed',
}
