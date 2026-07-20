import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid
} from 'drizzle-orm/pg-core';
import { authenticatedRole } from 'drizzle-orm/supabase';
import { tracks } from './tracks';

/**
 * What a stored audio file is for.
 *
 * `original` is the master the artist uploaded: what a buyer downloads, and
 * what an owner streams when they want full fidelity. `stream` is a lossy
 * transcode, so a listener hearing a preview does not pull a 300 MB master.
 *
 * A quality ladder would need more variants, but that only pays off with an
 * adaptive player choosing between them. Adding a value here later is a
 * one-line migration.
 */
export const audioVariantEnum = pgEnum('audio_variant', ['original', 'stream']);

export type AudioVariant = (typeof audioVariantEnum.enumValues)[number];

/**
 * Container or codec of a stored audio file.
 */
export const audioFormatEnum = pgEnum('audio_format', [
  'flac',
  'wav',
  'aiff',
  'alac',
  'aac',
  'mp3',
  'opus',
]);

export type AudioFormat = (typeof audioFormatEnum.enumValues)[number];

/**
 * Holds stored audio file for a track.
 *
 * Object storage is addressed as `bucket` plus `object_key` rather than a URL,
 * so in case we move cloud storage providers it's just a data migration.
 *
 * Most of the stuff here isn't client readable. Because a client could set
 * `object_key` and point a track at somebody else's audio.
 */
export const trackAudioFiles = pgTable(
  'track_audio_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),

    variant: audioVariantEnum('variant').notNull(),
    format: audioFormatEnum('format').notNull(),

    /** Cloud storage bucket holding the object. */
    bucket: text('bucket').notNull(),
    /** Path of the object within the bucket. */
    objectKey: text('object_key').notNull(),

    /** Serves `Content-Length` on download and the "FLAC (48.2 MB)" label. */
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),

    /**
     * Derived at upload so a release page can display sample rate and bit-depth
     * without having to re-read from cloud storage to find out. Null
     * on the `stream` variant, where neither figure means much.
     */
    sampleRateHz: integer('sample_rate_hz'),
    bitDepth: integer('bit_depth'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('track_audio_files_track_id_idx').on(table.trackId),
    // a track carries at most one file per variant, so the player and the
    // download link can each resolve to exactly one object
    unique('track_audio_files_track_id_variant_unique').on(
      table.trackId,
      table.variant,
    ),
    // two rows must never claim the same object, which would let deleting one
    // track strand or delete another's audio
    unique('track_audio_files_bucket_object_key_unique').on(
      table.bucket,
      table.objectKey,
    ),
    check('track_audio_files_byte_size_positive', sql`${table.byteSize} > 0`),
    check(
      'track_audio_files_sample_rate_positive',
      sql`${table.sampleRateHz} IS NULL OR ${table.sampleRateHz} > 0`,
    ),
    check(
      'track_audio_files_bit_depth_positive',
      sql`${table.bitDepth} IS NULL OR ${table.bitDepth} > 0`,
    ),
    /**
     * Managers can see which files exist for their own tracks so the artist
     * hub can show upload and transcode state.
     */
    pgPolicy('Managers can read audio files for their tracks', {
      for: 'select',
      to: authenticatedRole,
      using: sql`public.is_artist_manager((SELECT t.artist_id FROM public.tracks t WHERE t.id = ${table.trackId}))`,
    }),
  ],
);

/**
 * Represents one stored audio file for a track.
 * The type returned by a select query to the trackAudioFiles table.
 */
export type TrackAudioFile = typeof trackAudioFiles.$inferSelect;

/**
 * The type used to insert a new track audio file.
 */
export type NewTrackAudioFile = typeof trackAudioFiles.$inferInsert;
