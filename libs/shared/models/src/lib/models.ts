/**
 * Core domain models shared between the web client and the API.
 */

export interface Artist {
  id: string;
  slug: string;
  name: string;
  location?: string;
  bio?: string;
  /** Affirmative attestation that this artist's catalog is human-made, per platform policy. */
  humanMadeAttestation: boolean;
  createdAt: string;
}

export type ReleaseFormat = 'digital' | 'vinyl' | 'cd' | 'cassette';

export interface Track {
  id: string;
  releaseId: string;
  title: string;
  trackNumber: number;
  durationSeconds: number;
}

export interface Release {
  id: string;
  artistId: string;
  slug: string;
  title: string;
  format: ReleaseFormat;
  /** Price in the smallest currency unit (e.g. cents for USD). */
  priceCents: number;
  /** ISO 4217 currency code, lowercase (Stripe convention). */
  currency: string;
  releasedAt: string;
  tracks: Track[];
}

export interface ApiHealth {
  status: 'ok';
  service: string;
  timestamp: string;
}
