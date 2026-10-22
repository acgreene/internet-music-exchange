import type { ReleaseAssetKind, ReleaseKind } from '@ime/models';

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
