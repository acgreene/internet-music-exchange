import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { anonRole, authenticatedRole } from 'drizzle-orm/supabase';
import { designs } from './designs';

/**
 * A slot a design exposes for the artist to fill in.
 */
export interface DesignSlot {
  /** The key the artist's value is stored under in a release's customization. */
  name: string;
  kind: 'text' | 'image';
  /** What the slot is called in the artist's editor. */
  label: string;
}

/**
 * One uploaded version of a design. Versions never change once uploaded:
 * a designer improves a design by uploading a new one, and each release stays
 * on the version it chose until its managers switch.
 *
 * The bundle itself is untrusted third-party code in object storage, served to
 * the browser through a signed URL.
 */
export const designVersions = pgTable(
  'design_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    designId: uuid('design_id')
      .notNull()
      .references(() => designs.id, { onDelete: 'cascade' }),

    /** 1 for the first upload, counting up. */
    version: integer('version').notNull(),

    bucket: text('bucket').notNull(),
    objectKey: text('object_key').notNull(),
    /** Counted toward the designer's storage costs. */
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),

    /** The slots this version exposes, read from its bundle's manifest. */
    slots: jsonb('slots').$type<DesignSlot[]>().notNull().default([]),

    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('design_versions_design_id_version_unique').on(
      table.designId,
      table.version,
    ),
    unique('design_versions_bucket_object_key_unique').on(
      table.bucket,
      table.objectKey,
    ),
    check('design_versions_version_positive', sql`${table.version} >= 1`),
    check('design_versions_byte_size_positive', sql`${table.byteSize} > 0`),
    pgPolicy('Marketplace is publicly readable', {
      for: 'select',
      to: [anonRole, authenticatedRole],
      using: sql`EXISTS (SELECT 1 FROM public.designs d WHERE d.id = ${table.designId} AND d.status = 'published' AND d.visibility = 'public')`,
    }),
  ],
);

export type DesignVersion = typeof designVersions.$inferSelect;
export type NewDesignVersion = typeof designVersions.$inferInsert;
