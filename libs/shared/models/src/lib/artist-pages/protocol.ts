/**
 * The contract between our artist page host and a third party design.
 */

export interface ArtistPageTrack {
  position: number;
  title: string;
  durationMs: number | null;
  /** The words, when the artist wrote them in. */
  lyrics: string | null;
  /** Anyone can hear it, before getting the record. */
  preview: boolean;
}

export interface ArtistPagePrice {
  mode: 'free' | 'fixed' | 'name_your_price';
  /** ISO 4217, lowercase. Null for a free release. */
  currency: string | null;
  /** Minor units. Null for a free release. */
  minimumPrice: number | null;
  suggestedPrice: number | null;
}

/** Who made the record, as a design can show them. */
export interface ArtistPageArtist {
  name: string;
  handle: string;
  city: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string | null;
  avatarUrl: string | null;
  headerUrl: string | null;
}

/**
 * Something else that comes with the record that anyone can open: the back
 * cover, the inside of the sleeve, liner notes, photos, and the like.
 */
export interface ArtistPageAsset {
  kind:
    | 'back_cover'
    | 'liner_notes'
    | 'photo'
    | 'video'
    | 'audio'
    | 'document'
    | 'other';
  title: string | null;
  description: string | null;
  /** Signed URL to the file. */
  url: string;
  mimeType: string;
}

/** A physical edition of the record, as a vinyl pressing or a tape. */
export interface ArtistPageEdition {
  format: 'vinyl' | 'cassette' | 'cd';
  name: string;
  /** Minor units: the cheapest variant. */
  price: number;
  currency: string;
  inStock: boolean;
}

export interface ArtistPageRelease {
  id: string;
  title: string;
  /** Kept beside `artist` for designs written before it. */
  artistName: string;
  artist: ArtistPageArtist;
  /** single, ep, lp, album, compilation, and so on. */
  kind: string;
  /** When it came out, `YYYY-MM-DD`, when the artist said. */
  releasedAt: string | null;
  /** What the artist says about the record. */
  description: string | null;
  credits: string | null;
  /** Genre names, most fitting first. */
  genres: string[];
  tags: string[];
  /** Signed URL to the cover art. Every design shows it. */
  coverUrl: string | null;
  tracks: ArtistPageTrack[];
  /** Track positions where sides B, C, and so on begin. */
  sideStarts: number[];
  assets: ArtistPageAsset[];
  editions: ArtistPageEdition[];
  price: ArtistPagePrice;
}

/**
 * The artist's slot values, keyed by slot name: the text of a text slot, or
 * a signed URL to the image of an image slot.
 */
export type ArtistPageCustomization = Record<string, string>;

/**
 * The data needed to render the artist page.
 */
export interface ArtistPageRenderPayload {
  release: ArtistPageRelease;
  customization: ArtistPageCustomization;
}

export interface ArtistPageRenderResponse {
  /**
   * Signed URL to the design bundle in object storage, or null when the
   * release uses the default layout.
   */
  bundleUrl: string | null;
  payload: ArtistPageRenderPayload;
}

/**
 * Message types that can be sent to or from the design and our host
 */
export enum ArtistPageProtocolMessage {
  /** Sent from the host to the design to signal initialization */
  Init = 'artist-page:init',

  /** Sent from the design to the host to signal readiness */
  Ready = 'artist-page:ready',

  /** Sent from the design to the host to signal a resize */
  Resize = 'artist-page:resize',

  /** Sent from the design to the host to signal a purchase */
  Purchase = 'artist-page:purchase',

  /** Sent from the design to the host to signal playback of a track */
  Play = 'artist-page:play',

  /** Sent from the design to the host to pause what is playing */
  Pause = 'artist-page:pause',

  /**
   * Sent from the host to the design whenever playback changes, so the
   * design can show what is playing
   */
  Playback = 'artist-page:playback',
}

/** What the listener is hearing from this record, if anything. */
export interface ArtistPagePlayback {
  /** The track's position on the record, or null when none of it plays. */
  trackPosition: number | null;
  playing: boolean;
}

export type HostToDesignMessage =
  | {
      type: ArtistPageProtocolMessage.Init;
      payload: ArtistPageRenderPayload;
    }
  | {
      type: ArtistPageProtocolMessage.Playback;
      playback: ArtistPagePlayback;
    };

/** Variants of payloads that the design can send to our host */
export type DesignToHostMessage =
  | { type: ArtistPageProtocolMessage.Ready }
  | { type: ArtistPageProtocolMessage.Resize; height: number }
  | { type: ArtistPageProtocolMessage.Purchase }
  | { type: ArtistPageProtocolMessage.Play; trackPosition: number }
  | { type: ArtistPageProtocolMessage.Pause };

/**
 * Utility function to check if a message is a valid design to host message
 * @param message The message to check
 */
export function isDesignToHostMessage(
  message: unknown,
): message is DesignToHostMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as { type?: unknown }).type === 'string' &&
    (message as { type: string }).type.startsWith('artist-page:')
  );
}
