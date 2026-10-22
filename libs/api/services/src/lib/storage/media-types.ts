import type { AudioFormat, ReleaseAssetKind } from '@ime/db';

const MB = 1024 * 1024;
const GB = 1024 * MB;

/**
 * What one kind of upload may be, and what to tell the user when a file is
 * not that.
 */
export interface UploadRules {
  types: string[];
  maxBytes: number;
  message: string;
}

/**
 * The file extension each accepted upload type is stored with.
 */
export const FILE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/html': 'html',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/aiff': 'aiff',
  'audio/x-aiff': 'aiff',
  'audio/mpeg': 'mp3',
};

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Audio a track can be uploaded as: lossless encouraged, MP3 accepted.
 */
export const TRACK_AUDIO_FORMATS: Record<string, AudioFormat> = {
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/aiff': 'aiff',
  'audio/x-aiff': 'aiff',
  'audio/mpeg': 'mp3',
};

const DOCUMENT_TYPES = ['application/pdf'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const AUDIO_TYPES = Object.keys(TRACK_AUDIO_FORMATS);

export const TRACK_AUDIO_RULES: UploadRules = {
  types: AUDIO_TYPES,
  maxBytes: 2 * GB,
  message: 'Audio must be WAV, FLAC, AIFF, or MP3, and at most 2 GB.',
};

const sizeLabel = (bytes: number) =>
  bytes >= GB ? `${bytes / GB} GB` : `${bytes / MB} MB`;

const rules = (
  label: string,
  types: string[],
  maxBytes: number,
  allowed: string,
): UploadRules => ({
  types,
  maxBytes,
  message: `A ${label} must be ${allowed}, and at most ${sizeLabel(maxBytes)}.`,
});

const IMAGE_LABEL = 'JPEG, PNG, or WebP';

/**
 * What each kind of release asset may be uploaded as, and how large.
 */
export const RELEASE_ASSET_RULES: Record<ReleaseAssetKind, UploadRules> = {
  cover: rules('cover', IMAGE_TYPES, 20 * MB, IMAGE_LABEL),
  back_cover: rules('back cover', IMAGE_TYPES, 20 * MB, IMAGE_LABEL),
  photo: rules('photo', IMAGE_TYPES, 20 * MB, IMAGE_LABEL),
  liner_notes: rules(
    'liner notes file',
    [...IMAGE_TYPES, ...DOCUMENT_TYPES],
    50 * MB,
    'an image or a PDF',
  ),
  document: rules('document', DOCUMENT_TYPES, 50 * MB, 'a PDF'),
  video: rules('video', VIDEO_TYPES, 2 * GB, 'MP4 or WebM'),
  audio: rules(
    'bonus audio file',
    AUDIO_TYPES,
    2 * GB,
    'WAV, FLAC, AIFF, or MP3',
  ),
  other: rules(
    'file',
    [...IMAGE_TYPES, ...DOCUMENT_TYPES, ...VIDEO_TYPES, ...AUDIO_TYPES],
    2 * GB,
    'an image, PDF, video, or audio file',
  ),
};

export const ARTIST_IMAGE_RULES = rules(
  'profile image',
  IMAGE_TYPES,
  5 * MB,
  IMAGE_LABEL,
);

export const PRODUCT_IMAGE_RULES = rules(
  'product photo',
  IMAGE_TYPES,
  20 * MB,
  IMAGE_LABEL,
);

export const DESIGN_SLOT_IMAGE_RULES = rules(
  'design image',
  IMAGE_TYPES,
  20 * MB,
  IMAGE_LABEL,
);

/** A design version is one self-contained HTML file. */
export const DESIGN_BUNDLE_RULES = rules(
  'design bundle',
  ['text/html'],
  10 * MB,
  'a single HTML file',
);
