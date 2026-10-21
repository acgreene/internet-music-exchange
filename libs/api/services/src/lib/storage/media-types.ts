import type { AudioFormat, ReleaseAssetKind } from '@ime/db';

const MB = 1024 * 1024;
const GB = 1024 * MB;

/**
 * The file extension each accepted upload type is stored with.
 */
export const FILE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
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

export const TRACK_AUDIO_MAX_BYTES = 2 * GB;

const DOCUMENT_TYPES = ['application/pdf'];
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
const AUDIO_TYPES = Object.keys(TRACK_AUDIO_FORMATS);

/**
 * What each kind of release asset may be uploaded as, and how large.
 */
export const RELEASE_ASSET_RULES: Record<
  ReleaseAssetKind,
  { types: string[]; maxBytes: number }
> = {
  cover: { types: IMAGE_TYPES, maxBytes: 20 * MB },
  back_cover: { types: IMAGE_TYPES, maxBytes: 20 * MB },
  photo: { types: IMAGE_TYPES, maxBytes: 20 * MB },
  liner_notes: {
    types: [...IMAGE_TYPES, ...DOCUMENT_TYPES],
    maxBytes: 50 * MB,
  },
  document: { types: DOCUMENT_TYPES, maxBytes: 50 * MB },
  video: { types: VIDEO_TYPES, maxBytes: 2 * GB },
  audio: { types: AUDIO_TYPES, maxBytes: 2 * GB },
  other: {
    types: [...IMAGE_TYPES, ...DOCUMENT_TYPES, ...VIDEO_TYPES, ...AUDIO_TYPES],
    maxBytes: 2 * GB,
  },
};
