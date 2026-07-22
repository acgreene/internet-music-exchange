import { and, count, desc, eq, ilike } from 'drizzle-orm';
import type { Db } from '../database-service';
import {
  type ArtistPage,
  type artistPageKind,
  artistPages,
  type ReleaseArtistPage,
  releaseArtistPages,
} from '../tables';

/**
 * The design a release renders with, and the artist's values for its slots.
 */
export interface ReleasePageDesign {
  artistPageId: string;
  name: string;
  bucket: string;
  objectKey: string;
  customization: Record<string, string>;
}

export interface CreateArtistPageParams {
  name: string;
  kind: artistPageKind;
  bucket: string;
  objectKey: string;
  description?: string | null;
  createdByUserId?: string | null;
}

export interface UpdateArtistPageParams {
  name?: string;
  description?: string | null;
  bucket?: string;
  objectKey?: string;
}

const DEFAULT_LIST_LIMIT = 24;
const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Queries for the designs artists can dress their pages in: the marketplace of
 * designs themselves, and which design a given release renders with.
 */
export class ArtistPageRepository {
  constructor(private readonly db: Db) {}

  /**
   * Find a design by its id.
   *
   * @param artistPageId - The id of the design to look up.
   * @returns The design row, or null when no design has that id.
   */
  public async getById(artistPageId: string): Promise<ArtistPage | null> {
    const [artistPage] = await this.db
      .select()
      .from(artistPages)
      .where(eq(artistPages.id, artistPageId))
      .limit(1);

    return artistPage ?? null;
  }

  /**
   * Browse the designs on offer for one kind of page.
   *
   * @param kind - The surface the designs are built for.
   * @param limit - The maximum number of designs to return.
   * @param offset - How many designs to skip, for paging.
   * @returns Published designs for that surface, newest first.
   */
  public async listPublished(
    kind: artistPageKind,
    limit: number = DEFAULT_LIST_LIMIT,
    offset = 0,
  ): Promise<ArtistPage[]> {
    return this.db
      .select()
      .from(artistPages)
      .where(
        and(eq(artistPages.kind, kind), eq(artistPages.status, 'published')),
      )
      .orderBy(desc(artistPages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Find published designs whose name contains the given text.
   *
   * @param query - The text to match against design names, case insensitive.
   * @param kind - The surface to narrow to, or every surface when omitted.
   * @param limit - The maximum number of designs to return.
   * @returns Matching published designs, newest first.
   */
  public async searchByName(
    query: string,
    kind?: artistPageKind,
    limit: number = DEFAULT_SEARCH_LIMIT,
  ): Promise<ArtistPage[]> {
    return this.db
      .select()
      .from(artistPages)
      .where(
        and(
          eq(artistPages.status, 'published'),
          ilike(artistPages.name, `%${query}%`),
          kind ? eq(artistPages.kind, kind) : undefined,
        ),
      )
      .orderBy(desc(artistPages.createdAt))
      .limit(limit);
  }

  /**
   * List the designs a developer has built, drafts and archived included.
   *
   * @param userId - The id of the developer who created them.
   * @returns Their designs, newest first.
   */
  public async listByCreator(userId: string): Promise<ArtistPage[]> {
    return this.db
      .select()
      .from(artistPages)
      .where(eq(artistPages.createdByUserId, userId))
      .orderBy(desc(artistPages.createdAt));
  }

  /**
   * Count how many releases render with a design.
   *
   * @param artistPageId - The id of the design.
   * @returns The number of releases using it.
   */
  public async countReleasesUsing(artistPageId: string): Promise<number> {
    const [using] = await this.db
      .select({ value: count() })
      .from(releaseArtistPages)
      .where(eq(releaseArtistPages.artistPageId, artistPageId));

    return using?.value ?? 0;
  }

  /**
   * Record a design. It stays out of the marketplace until it is published.
   *
   * @param params - The design's name, the surface it is built for, and where
   * its bundle lives in object storage.
   * @returns The newly created design row.
   */
  public async create(params: CreateArtistPageParams): Promise<ArtistPage> {
    const [artistPage] = await this.db
      .insert(artistPages)
      .values(params)
      .returning();

    return artistPage;
  }

  /**
   * Update a design's details or point it at a revised bundle. Status is
   * changed through `publish` and `archive` instead.
   *
   * @param artistPageId - The id of the design to update.
   * @param params - The fields to change; omitted fields are left as they are.
   */
  public async updateById(
    artistPageId: string,
    params: UpdateArtistPageParams,
  ): Promise<void> {
    await this.db
      .update(artistPages)
      .set({ ...params, updatedAt: new Date() })
      .where(eq(artistPages.id, artistPageId));
  }

  /**
   * Offer a design in the marketplace.
   *
   * @param artistPageId - The id of the design to publish.
   */
  public async publish(artistPageId: string): Promise<void> {
    await this.db
      .update(artistPages)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(artistPages.id, artistPageId));
  }

  /**
   * Withdraw a design from the marketplace. Pages already using it keep
   * rendering with it.
   *
   * @param artistPageId - The id of the design to archive.
   */
  public async archive(artistPageId: string): Promise<void> {
    await this.db
      .update(artistPages)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(artistPages.id, artistPageId));
  }

  /**
   * Delete a design. Fails while any release still renders with it.
   *
   * @param artistPageId - The id of the design to delete.
   */
  public async deleteById(artistPageId: string): Promise<void> {
    await this.db.delete(artistPages).where(eq(artistPages.id, artistPageId));
  }

  /**
   * Read the design a release renders with, ready to be served.
   *
   * @param releaseId - The id of the release being rendered.
   * @returns Where the design's bundle lives and the artist's slot values, or
   * null when the release falls back to the default layout.
   */
  public async getReleasePage(
    releaseId: string,
  ): Promise<ReleasePageDesign | null> {
    const [design] = await this.db
      .select({
        artistPageId: artistPages.id,
        name: artistPages.name,
        bucket: artistPages.bucket,
        objectKey: artistPages.objectKey,
        customization: releaseArtistPages.customization,
      })
      .from(releaseArtistPages)
      .innerJoin(
        artistPages,
        eq(artistPages.id, releaseArtistPages.artistPageId),
      )
      .where(eq(releaseArtistPages.releaseId, releaseId))
      .limit(1);

    return design ?? null;
  }

  /**
   * Dress a release in a design, replacing whichever one it used before.
   *
   * @param releaseId - The id of the release to dress.
   * @param artistPageId - The id of the design to apply.
   * @param customization - The artist's values for the design's slots.
   * @returns The stored row, or null when no published release design has that
   * id.
   */
  public async setReleasePage(
    releaseId: string,
    artistPageId: string,
    customization: Record<string, string> = {},
  ): Promise<ReleaseArtistPage | null> {
    return this.db.transaction(async (tx) => {
      // a home page design on a release renders a broken page, so the surface
      // has to match before anything is stored
      const [eligible] = await tx
        .select({ id: artistPages.id })
        .from(artistPages)
        .where(
          and(
            eq(artistPages.id, artistPageId),
            eq(artistPages.kind, 'release'),
          ),
        )
        .limit(1);

      if (!eligible) return null;

      const [applied] = await tx
        .insert(releaseArtistPages)
        .values({ releaseId, artistPageId, customization })
        .onConflictDoUpdate({
          target: releaseArtistPages.releaseId,
          set: { artistPageId, customization, updatedAt: new Date() },
        })
        .returning();

      return applied;
    });
  }

  /**
   * Replace the artist's values for their design's slots.
   *
   * @param releaseId - The id of the release being customized.
   * @param customization - The new slot values, replacing the old set whole.
   */
  public async updateReleaseCustomization(
    releaseId: string,
    customization: Record<string, string>,
  ): Promise<void> {
    await this.db
      .update(releaseArtistPages)
      .set({ customization, updatedAt: new Date() })
      .where(eq(releaseArtistPages.releaseId, releaseId));
  }

  /**
   * Undress a release, returning it to the default layout.
   *
   * @param releaseId - The id of the release to reset.
   */
  public async clearReleasePage(releaseId: string): Promise<void> {
    await this.db
      .delete(releaseArtistPages)
      .where(eq(releaseArtistPages.releaseId, releaseId));
  }
}
