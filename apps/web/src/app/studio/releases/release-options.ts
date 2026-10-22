import { assetKindLabel, releaseKindLabel } from '@ime/client-listening';
import {
  releaseAssetKindSchema,
  releaseKindSchema,
  type ReleaseKind,
} from '@ime/models';

/**
 * The kinds a release can be, as a picker lists them.
 */
export const RELEASE_KINDS: { value: ReleaseKind; label: string }[] =
  releaseKindSchema.options.map((value) => ({
    value,
    label: value === 'other' ? 'Other' : releaseKindLabel(value),
  }));

/**
 * The extras a release can carry besides its cover.
 */
export const EXTRA_KINDS = releaseAssetKindSchema.options
  .filter((kind) => kind !== 'cover')
  .map((value) => ({ value, label: assetKindLabel(value) }));

export const STATUS_LABELS = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
  taken_down: 'Taken down',
} as const;
