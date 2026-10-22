import type {
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

/** What a release costs, as a card or result shows it. */
export function releasePriceLabel(pricing: PricingResponse | null): string {
  if (!pricing || pricing.mode === 'free') return 'Free';
  const amount = formatMoney(pricing.minimumPrice, pricing.currency ?? 'usd');
  if (pricing.mode === 'fixed') return amount;
  return pricing.minimumPrice > 0 ? `${amount} or more` : 'Name your price';
}
