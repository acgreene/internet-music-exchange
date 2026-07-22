/**
 * The contract between our artist page host and a third party design.
 */

export interface ArtistPageTrack {
  position: number;
  title: string;
  durationMs: number | null;
}

export interface ArtistPagePrice {
  mode: 'free' | 'fixed' | 'name_your_price';
  /** ISO 4217, lowercase. Null for a free release. */
  currency: string | null;
  /** Minor units. Null for a free release. */
  minimumPrice: number | null;
  suggestedPrice: number | null;
}

export interface ArtistPageRelease {
  id: string;
  title: string;
  artistName: string;
  tracks: ArtistPageTrack[];
  price: ArtistPagePrice;
}

/** Text and asset URL overrides */
export type ArtistPageCustomization = Record<string, string>;

/**
 * The data needed to render the artist page.
 */
export interface ArtistPageRenderPayload {
  release: ArtistPageRelease;
  customization: ArtistPageCustomization;
}

export interface ArtistPageRenderResponse {
  /** Signed URL to the design bundle in object storage. */
  bundleUrl: string;
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
}

export type HostToDesignMessage = {
  type: ArtistPageProtocolMessage.Init;
  payload: ArtistPageRenderPayload;
};

/** Variants of payloads that the design can send to our host */
export type DesignToHostMessage =
  | { type: ArtistPageProtocolMessage.Ready }
  | { type: ArtistPageProtocolMessage.Resize; height: number }
  | { type: ArtistPageProtocolMessage.Purchase }
  | { type: ArtistPageProtocolMessage.Play; trackPosition: number };

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
