import type {
  DiscographyItem,
  PricingResponse,
  ReleaseAssetKind,
  ReleaseKind,
} from '@ime/models';
import { formatMoney } from '@ime/utils';

const KIND_LABELS: Record<ReleaseKind, string> = {
  single: 'Single',
  ep: 'EP',
  lp: 'LP',
  album: 'Album',
  compilation: 'Compilation',
  remaster: 'Remaster',
  soundtrack: 'Soundtrack',
  score: 'Score',
  demo: 'Demo',
  other: 'Release',
};

const ASSET_LABELS: Record<ReleaseAssetKind, string> = {
  cover: 'Cover art',
  back_cover: 'Back cover',
  liner_notes: 'Liner notes',
  photo: 'Photo',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
  other: 'File',
};

export function releaseKindLabel(kind: ReleaseKind): string {
  return KIND_LABELS[kind];
}

export function assetKindLabel(kind: ReleaseAssetKind): string {
  return ASSET_LABELS[kind];
}

/** When a release came out, or went up on IME when the artist gave no date. */
function releaseDate(release: DiscographyItem): string {
  return (
    release.releasedAt ?? release.publishedAt?.toISOString().slice(0, 10) ?? ''
  );
}

/** An artist's releases, newest first. */
export function newestFirst(releases: DiscographyItem[]): DiscographyItem[] {
  return [...releases].sort((a, b) =>
    releaseDate(b).localeCompare(releaseDate(a)),
  );
}

/** A discography card's line under the title: kind, year, and price. */
export function discographySubtitle(release: DiscographyItem): string {
  return [
    releaseKindLabel(release.kind),
    releaseDate(release).slice(0, 4),
    releasePriceLabel(release.pricing),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** What a release costs, as a card or result shows it. */
export function releasePriceLabel(pricing: PricingResponse | null): string {
  if (!pricing || pricing.mode === 'free') return 'Free';
  const amount = formatMoney(pricing.minimumPrice, pricing.currency ?? 'usd');
  if (pricing.mode === 'fixed') return amount;
  return pricing.minimumPrice > 0 ? `${amount} or more` : 'Name your price';
}
