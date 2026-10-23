import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  sql,
} from 'drizzle-orm';
import type { Db } from '../database-service';
import {
  artists,
  type Currency,
  type PricingMode,
  type Release,
  type ReleaseKind,
  releasePricing,
  type ReleasePricing,
  releases,
  releaseTracks,
  type Track,
  tracks,
} from '../tables';

/**
 * A release together with the name and handle of the artist that made it.
 */
export interface ReleaseWithArtist extends Release {
  artistName: string;
  artistHandle: string;
}

export interface ReleaseTracklistItem {
  trackId: string;
  position: number;
  title: string;
  durationMs: number | null;
  lyrics: string | null;
  isPreview: boolean;
}

export interface CreateReleaseParams {
  artistId: string;
  title: string;
  slug: string;
  kind: ReleaseKind;
  releasedAt?: string | null;
}

export interface UpdateReleaseParams {
  title?: string;
  slug?: string;
  kind?: ReleaseKind;
  releasedAt?: string | null;
  genres?: string[];
  tags?: string[];
  sideStarts?: number[];
  description?: string | null;
  credits?: string | null;
}

export interface CreateTrackParams {
  artistId: string;
  title: string;
  durationMs?: number | null;
}

export interface UpdateTrackParams {
  title?: string;
  durationMs?: number | null;
  lyrics?: string | null;
}

export interface TrackPosition {
  trackId: string;
  position: number;
}

export interface UpsertPricingParams {
  mode: PricingMode;
  currency?: Currency | null;
  minimumPrice?: number;
  suggestedPrice?: number | null;
}

const DEFAULT_LIST_LIMIT = 24;

const releaseWithArtistColumns = {
  id: releases.id,
  title: releases.title,
  slug: releases.slug,
  artistId: releases.artistId,
  releasedAt: releases.releasedAt,
  createdAt: releases.createdAt,
  kind: releases.kind,
  status: releases.status,
  publishedAt: releases.publishedAt,
  takedownFinalAt: releases.takedownFinalAt,
  genres: releases.genres,
  tags: releases.tags,
  sideStarts: releases.sideStarts,
  description: releases.description,
  credits: releases.credits,
  artistName: artists.name,
  artistHandle: artists.handle,
};

/**
 * Queries for the release aggregate: the release, its tracklist and its
 * pricing. Callers get typed results instead of re-deriving the same SQL.
 */
export class ReleaseRepository {
  constructor(private readonly db: Db) {}

  /**
   * Find a release by its id.
   *
   * @param releaseId - The id of the release to look up.
   * @returns The release row, or null when no release has that id.
   */
  public async getById(releaseId: string): Promise<Release | null> {
    const [release] = await this.db
      .select()
      .from(releases)
      .where(eq(releases.id, releaseId))
      .limit(1);

    return release ?? null;
  }

  /**
   * Find a release along with the name of the artist that made it.
   *
   * @param releaseId - The id of the release to look up.
   * @returns The release row plus its artist name and handle, or null when no
   * release has that id.
   */
  public async getWithArtist(
    releaseId: string,
  ): Promise<ReleaseWithArtist | null> {
    const [release] = await this.db
      .select(releaseWithArtistColumns)
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .where(eq(releases.id, releaseId))
      .limit(1);

    return release ?? null;
  }

  /**
   * Find a release by its address, `/artists/<handle>/<slug>`.
   *
   * @param artistHandle - The handle of the artist that made it.
   * @param slug - The release's slug within that artist.
   * @returns The release plus its artist name and handle, or null when there
   * is no such release.
   */
  public async getBySlug(
    artistHandle: string,
    slug: string,
  ): Promise<ReleaseWithArtist | null> {
    const [release] = await this.db
      .select(releaseWithArtistColumns)
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .where(and(eq(artists.handle, artistHandle), eq(releases.slug, slug)))
      .limit(1);

    return release ?? null;
  }

  /**
   * Report whether a slug is free within an artist's releases.
   *
   * @param artistId - The id of the artist.
   * @param slug - The slug being considered.
   * @param excludeReleaseId - A release to ignore, so re-saving a release does
   * not report its own slug as taken.
   * @returns True when none of the artist's other releases use that slug.
   */
  public async isSlugAvailable(
    artistId: string,
    slug: string,
    excludeReleaseId?: string,
  ): Promise<boolean> {
    const [taken] = await this.db
      .select({ id: releases.id })
      .from(releases)
      .where(
        and(
          eq(releases.artistId, artistId),
          eq(releases.slug, slug),
          excludeReleaseId ? ne(releases.id, excludeReleaseId) : undefined,
        ),
      )
      .limit(1);

    return !taken;
  }

  /**
   * List an artist's public discography.
   *
   * @param artistId - The id of the artist whose releases to list.
   * @returns The artist's published releases, newest first.
   */
  public async listPublishedByArtist(artistId: string): Promise<Release[]> {
    return this.db
      .select()
      .from(releases)
      .where(
        and(eq(releases.artistId, artistId), eq(releases.status, 'published')),
      )
      .orderBy(desc(releases.publishedAt));
  }

  /**
   * List every release belonging to an artist, drafts and archived included.
   *
   * @param artistId - The id of the artist whose releases to list.
   * @returns The artist's releases, newest first.
   */
  public async listAllByArtist(artistId: string): Promise<Release[]> {
    return this.db
      .select()
      .from(releases)
      .where(eq(releases.artistId, artistId))
      .orderBy(desc(releases.createdAt));
  }

  /**
   * List the newest releases across the whole catalog.
   *
   * @param limit - The maximum number of releases to return.
   * @param offset - How many releases to skip, for paging.
   * @returns Published releases with their artist names, newest first.
   */
  public async listRecentlyPublished(
    limit: number = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<ReleaseWithArtist[]> {
    return this.db
      .select(releaseWithArtistColumns)
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .where(
        and(
          eq(releases.status, 'published'),
          isNull(artists.suspendedAt),
          isNull(artists.offSaleAt),
        ),
      )
      .orderBy(desc(releases.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * The tracklists of several releases at once, each in running order.
   */
  public async listTracksFor(
    releaseIds: string[],
  ): Promise<(ReleaseTracklistItem & { releaseId: string })[]> {
    if (releaseIds.length === 0) return [];
    return this.db
      .select({
        releaseId: releaseTracks.releaseId,
        trackId: tracks.id,
        position: releaseTracks.position,
        title: tracks.title,
        durationMs: tracks.durationMs,
        lyrics: tracks.lyrics,
        isPreview: releaseTracks.isPreview,
      })
      .from(releaseTracks)
      .innerJoin(tracks, eq(tracks.id, releaseTracks.trackId))
      .where(inArray(releaseTracks.releaseId, releaseIds))
      .orderBy(asc(releaseTracks.position));
  }

  /**
   * The genres and tags of some releases.
   */
  public async listSounds(
    releaseIds: string[],
  ): Promise<{ id: string; genres: string[]; tags: string[] }[]> {
    if (releaseIds.length === 0) return [];
    return this.db
      .select({ id: releases.id, genres: releases.genres, tags: releases.tags })
      .from(releases)
      .where(inArray(releases.id, releaseIds));
  }

  /**
   * Read a release's tracklist in running order.
   *
   * @param releaseId - The id of the release whose tracks to read.
   * @returns One entry per track with its id, slot, title, duration and whether
   * it streams without owning the release.
   */
  public async listTracks(releaseId: string): Promise<ReleaseTracklistItem[]> {
    return this.db
      .select({
        trackId: tracks.id,
        position: releaseTracks.position,
        title: tracks.title,
        durationMs: tracks.durationMs,
        lyrics: tracks.lyrics,
        isPreview: releaseTracks.isPreview,
      })
      .from(releaseTracks)
      .innerJoin(tracks, eq(tracks.id, releaseTracks.trackId))
      .where(eq(releaseTracks.releaseId, releaseId))
      .orderBy(asc(releaseTracks.position));
  }

  /**
   * Find a track by its id.
   *
   * @param trackId - The id of the track to look up.
   * @returns The track row, or null when no track has that id.
   */
  public async getTrackById(trackId: string): Promise<Track | null> {
    const [track] = await this.db
      .select()
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1);

    return track ?? null;
  }

  /**
   * Create a release. It starts as a draft until it is published.
   *
   * @param params - The owning artist, title, slug, kind and optional release date.
   * @returns The newly created release row.
   */
  public async create(params: CreateReleaseParams): Promise<Release> {
    const [release] = await this.db
      .insert(releases)
      .values({
        artistId: params.artistId,
        title: params.title,
        slug: params.slug,
        kind: params.kind,
        releasedAt: params.releasedAt,
      })
      .returning();

    return release;
  }

  /**
   * Update a release's editable fields. Status is changed through `publish` and
   * `archive` instead.
   *
   * @param releaseId - The id of the release to update.
   * @param params - The fields to change; omitted fields are left as they are.
   */
  public async updateById(
    releaseId: string,
    params: UpdateReleaseParams,
  ): Promise<void> {
    await this.db
      .update(releases)
      .set(params)
      .where(eq(releases.id, releaseId));
  }

  /**
   * Publish a release into the public catalog, provided it has been priced.
   *
   * @param releaseId - The id of the release to publish.
   * @returns True when the release was published, false when it has no pricing
   * row and cannot be sold.
   */
  public async publish(releaseId: string): Promise<boolean> {
    const published = await this.db
      .update(releases)
      .set({
        status: 'published',
        // republishing an archived release keeps the date it first went public
        publishedAt: sql`coalesce(${releases.publishedAt}, now())`,
      })
      .where(
        and(
          eq(releases.id, releaseId),
          exists(
            this.db
              .select({ releaseId: releasePricing.releaseId })
              .from(releasePricing)
              .where(eq(releasePricing.releaseId, releaseId)),
          ),
        ),
      )
      .returning({ id: releases.id });

    return published.length > 0;
  }

  /**
   * Withdraw a release from the public catalog. Users who already own it keep
   * their access.
   *
   * @param releaseId - The id of the release to archive.
   */
  public async archive(releaseId: string): Promise<void> {
    await this.db
      .update(releases)
      .set({ status: 'archived' })
      .where(eq(releases.id, releaseId));
  }

  /**
   * Delete a release. Fails when the release has already been sold, since order
   * items reference it.
   *
   * @param releaseId - The id of the release to delete.
   */
  public async deleteById(releaseId: string): Promise<void> {
    await this.db.delete(releases).where(eq(releases.id, releaseId));
  }

  /**
   * Create a track. It becomes public once it appears on a published release.
   *
   * @param params - The owning artist, title and optional duration.
   * @returns The newly created track row.
   */
  public async createTrack(params: CreateTrackParams): Promise<Track> {
    const [track] = await this.db
      .insert(tracks)
      .values({
        artistId: params.artistId,
        title: params.title,
        durationMs: params.durationMs,
      })
      .returning();

    return track;
  }

  /**
   * Update a track's editable fields, such as stamping the duration once its
   * audio has been probed.
   *
   * @param trackId - The id of the track to update.
   * @param params - The fields to change; omitted fields are left as they are.
   */
  public async updateTrackById(
    trackId: string,
    params: UpdateTrackParams,
  ): Promise<void> {
    await this.db.update(tracks).set(params).where(eq(tracks.id, trackId));
  }

  /**
   * Delete a track and its audio files, removing it from any release it sits on.
   *
   * @param trackId - The id of the track to delete.
   */
  public async deleteTrackById(trackId: string): Promise<void> {
    await this.db.delete(tracks).where(eq(tracks.id, trackId));
  }

  /**
   * Place a track on a release at a given slot.
   *
   * @param releaseId - The id of the release to add to.
   * @param trackId - The id of the track being added.
   * @param position - The 1-based slot the track occupies.
   * @param isPreview - Whether the track streams without owning the release.
   */
  public async addTrackToRelease(
    releaseId: string,
    trackId: string,
    position: number,
    isPreview = false,
  ): Promise<void> {
    await this.db
      .insert(releaseTracks)
      .values({ releaseId, trackId, position, isPreview })
      .onConflictDoNothing();
  }

  /**
   * Take a track off a release, leaving the track itself intact.
   *
   * @param releaseId - The id of the release to remove from.
   * @param trackId - The id of the track being removed.
   */
  public async removeTrackFromRelease(
    releaseId: string,
    trackId: string,
  ): Promise<void> {
    await this.db
      .delete(releaseTracks)
      .where(
        and(
          eq(releaseTracks.releaseId, releaseId),
          eq(releaseTracks.trackId, trackId),
        ),
      );
  }

  /**
   * Rewrite a release's running order.
   *
   * @param releaseId - The id of the release being reordered.
   * @param positions - The new slot for every track on the release.
   */
  public async reorderTracks(
    releaseId: string,
    positions: TrackPosition[],
  ): Promise<void> {
    if (positions.length === 0) return;

    await this.db.transaction(async (tx) => {
      const existing = await tx
        .select({
          trackId: releaseTracks.trackId,
          isPreview: releaseTracks.isPreview,
        })
        .from(releaseTracks)
        .where(eq(releaseTracks.releaseId, releaseId));

      const previewByTrackId = new Map(
        existing.map((row) => [row.trackId, row.isPreview]),
      );

      const reordered = positions.filter((entry) =>
        previewByTrackId.has(entry.trackId),
      );
      if (reordered.length === 0) return;

      // the slot uniqueness constraint is not deferrable, so shuffling in place
      // would collide part way through
      await tx
        .delete(releaseTracks)
        .where(eq(releaseTracks.releaseId, releaseId));

      await tx.insert(releaseTracks).values(
        reordered.map((entry) => ({
          releaseId,
          trackId: entry.trackId,
          position: entry.position,
          isPreview: previewByTrackId.get(entry.trackId) ?? false,
        })),
      );
    });
  }

  /**
   * Set whether a track streams to listeners who do not own the release.
   *
   * @param releaseId - The id of the release the track sits on.
   * @param trackId - The id of the track to change.
   * @param isPreview - Whether the track is streamable as a preview.
   */
  public async setTrackPreview(
    releaseId: string,
    trackId: string,
    isPreview: boolean,
  ): Promise<void> {
    await this.db
      .update(releaseTracks)
      .set({ isPreview })
      .where(
        and(
          eq(releaseTracks.releaseId, releaseId),
          eq(releaseTracks.trackId, trackId),
        ),
      );
  }

  /**
   * Read a release's price.
   *
   * @param releaseId - The id of the release whose pricing to read.
   * @returns The pricing row, or null when the release has not been priced.
   */
  public async getPricing(releaseId: string): Promise<ReleasePricing | null> {
    const [pricing] = await this.db
      .select()
      .from(releasePricing)
      .where(eq(releasePricing.releaseId, releaseId))
      .limit(1);

    return pricing ?? null;
  }

  /** The prices of several releases at once, for those that have one. */
  public async listPricing(releaseIds: string[]): Promise<ReleasePricing[]> {
    if (releaseIds.length === 0) return [];
    return this.db
      .select()
      .from(releasePricing)
      .where(inArray(releasePricing.releaseId, releaseIds));
  }

  /**
   * Set a release's price, replacing any price it already had.
   *
   * @param releaseId - The id of the release to price.
   * @param params - The pricing mode with the currency and amounts it requires.
   * @returns The stored pricing row.
   */
  public async upsertPricing(
    releaseId: string,
    params: UpsertPricingParams,
  ): Promise<ReleasePricing> {
    const values = {
      mode: params.mode,
      currency: params.currency ?? null,
      minimumPrice: params.minimumPrice ?? 0,
      suggestedPrice: params.suggestedPrice ?? null,
    };

    const [pricing] = await this.db
      .insert(releasePricing)
      .values({ releaseId, ...values })
      .onConflictDoUpdate({
        target: releasePricing.releaseId,
        set: values,
      })
      .returning();

    return pricing;
  }
}
