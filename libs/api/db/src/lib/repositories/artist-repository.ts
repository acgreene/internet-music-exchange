import {
  and,
  asc,
  eq,
  exists,
  getTableColumns,
  ne,
  notExists,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '../database-service';
import {
  type Artist,
  type ArtistImage,
  artistImages,
  type ArtistImageKind,
  type ArtistLink,
  artistLinks,
  artistManagers,
  artists,
  costShares,
  users,
} from '../tables';

export interface CreateArtistParams {
  name: string;
  handle: string;
  bio?: string | null;
  createdByUserId: string;
}

export interface UpdateArtistParams {
  name?: string;
  handle?: string;
  bio?: string | null;
}

export interface SetArtistImageParams {
  artistId: string;
  kind: ArtistImageKind;
  bucket: string;
  objectKey: string;
  mimeType: string;
  byteSize: number;
}

export interface ArtistLinkInput {
  label: string;
  url: string;
}

/**
 * A user who manages an artist, with the profile fields needed to list them.
 */
export interface ArtistManagerProfile {
  userId: string;
  username: string | null;
  name: string | null;
  createdAt: Date;
}

/**
 * Queries for the artist profile and the users permitted to act on its behalf.
 */
export class ArtistRepository {
  constructor(private readonly db: Db) {}

  /**
   * Find an artist profile by its id.
   *
   * @param artistId - The id of the artist to look up.
   * @returns The artist row, or null when no artist has that id.
   */
  public async getById(artistId: string): Promise<Artist | null> {
    const [artist] = await this.db
      .select()
      .from(artists)
      .where(eq(artists.id, artistId))
      .limit(1);

    return artist ?? null;
  }

  /**
   * Find an artist profile by its handle, as when resolving `/artists/<handle>`.
   *
   * @param handle - The handle to look up.
   * @returns The artist row, or null when no artist has that handle.
   */
  public async getByHandle(handle: string): Promise<Artist | null> {
    const [artist] = await this.db
      .select()
      .from(artists)
      .where(eq(artists.handle, handle))
      .limit(1);

    return artist ?? null;
  }

  /**
   * Report whether a handle is free to take. The unique constraint on the
   * column is what actually settles it, since two managers can ask at once.
   *
   * @param handle - The handle being considered.
   * @param excludeArtistId - An artist to ignore, so re-saving an artist's own
   * profile does not report its handle as taken.
   * @returns True when no other artist holds that handle.
   */
  public async isHandleAvailable(
    handle: string,
    excludeArtistId?: string,
  ): Promise<boolean> {
    const [taken] = await this.db
      .select({ id: artists.id })
      .from(artists)
      .where(
        and(
          eq(artists.handle, handle),
          excludeArtistId ? ne(artists.id, excludeArtistId) : undefined,
        ),
      )
      .limit(1);

    return !taken;
  }

  /**
   * Create an artist profile and record its creator as the first manager.
   *
   * @param params - The artist's name, handle, optional bio, and the id of the user creating it.
   * @returns The newly created artist row.
   */
  public async create(params: CreateArtistParams): Promise<Artist> {
    return this.db.transaction(async (tx) => {
      const [artist] = await tx
        .insert(artists)
        .values({ name: params.name, handle: params.handle, bio: params.bio })
        .returning();

      // the on_artist_created trigger reads auth.uid(), which is null under
      // service_role, so the first manager is written here instead
      await tx
        .insert(artistManagers)
        .values({ userId: params.createdByUserId, artistId: artist.id })
        .onConflictDoNothing();

      // the creator pays all of the artist's hosting costs until the managers
      // agree on a split
      await tx.insert(costShares).values({
        artistId: artist.id,
        userId: params.createdByUserId,
        shareBasisPoints: 10000,
      });

      return artist;
    });
  }

  /**
   * Update an artist's editable profile fields.
   *
   * @param artistId - The id of the artist to update.
   * @param params - The fields to change; omitted fields are left as they are.
   */
  public async updateById(
    artistId: string,
    params: UpdateArtistParams,
  ): Promise<void> {
    await this.db.update(artists).set(params).where(eq(artists.id, artistId));
  }

  /**
   * Report whether a user is allowed to act on behalf of an artist.
   *
   * @param userId - The id of the user to check.
   * @param artistId - The id of the artist being acted on.
   * @returns True when the user manages that artist.
   */
  public async isManager(userId: string, artistId: string): Promise<boolean> {
    const [manager] = await this.db
      .select({ userId: artistManagers.userId })
      .from(artistManagers)
      .where(
        and(
          eq(artistManagers.userId, userId),
          eq(artistManagers.artistId, artistId),
        ),
      )
      .limit(1);

    return Boolean(manager);
  }

  /**
   * List the artists a user manages.
   *
   * @param userId - The id of the managing user.
   * @returns The artist rows that user manages, in alphabetical order.
   */
  public async listManagedArtists(userId: string): Promise<Artist[]> {
    return this.db
      .select(getTableColumns(artists))
      .from(artistManagers)
      .innerJoin(artists, eq(artists.id, artistManagers.artistId))
      .where(eq(artistManagers.userId, userId))
      .orderBy(asc(artists.name));
  }

  /**
   * List the users who manage an artist.
   *
   * @param artistId - The id of the artist.
   * @returns Each manager's user id, profile fields, and when they were added,
   * oldest first.
   */
  public async listManagers(artistId: string): Promise<ArtistManagerProfile[]> {
    return this.db
      .select({
        userId: users.id,
        username: users.username,
        name: users.name,
        createdAt: artistManagers.createdAt,
      })
      .from(artistManagers)
      .innerJoin(users, eq(users.id, artistManagers.userId))
      .where(eq(artistManagers.artistId, artistId))
      .orderBy(asc(artistManagers.createdAt));
  }

  /**
   * Grant a user permission to manage an artist.
   *
   * @param userId - The id of the user to add.
   * @param artistId - The id of the artist they will manage.
   */
  public async addManager(userId: string, artistId: string): Promise<void> {
    await this.db
      .insert(artistManagers)
      .values({ userId, artistId })
      .onConflictDoNothing();
  }

  /**
   * Revoke a user's permission to manage an artist, unless they are its last
   * manager.
   *
   * @param userId - The id of the user to remove.
   * @param artistId - The id of the artist they managed.
   * @returns True when the manager was removed, false when they were the
   * artist's only manager and were kept.
   */
  public async removeManager(
    userId: string,
    artistId: string,
  ): Promise<boolean> {
    const otherManagers = alias(artistManagers, 'other_managers');

    return this.db.transaction(async (tx) => {
      // locking the artist stops two managers removing each other at once
      await tx
        .select({ id: artists.id })
        .from(artists)
        .where(eq(artists.id, artistId))
        .for('update');

      const removed = await tx
        .delete(artistManagers)
        .where(
          and(
            eq(artistManagers.userId, userId),
            eq(artistManagers.artistId, artistId),
            // an artist is unmanageable with nobody on it, so the delete only
            // matches while another manager remains
            exists(
              tx
                .select({ userId: otherManagers.userId })
                .from(otherManagers)
                .where(
                  and(
                    eq(otherManagers.artistId, artistId),
                    ne(otherManagers.userId, userId),
                  ),
                ),
            ),
          ),
        )
        .returning({ userId: artistManagers.userId });

      return removed.length > 0;
    });
  }

  /**
   * List the artists a user is the only manager of. Their account cannot be
   * deleted until each has another manager or is deleted.
   *
   * @param userId - The id of the user.
   * @returns The artists only that user manages, in alphabetical order.
   */
  public async listSolelyManagedArtists(userId: string): Promise<Artist[]> {
    const otherManagers = alias(artistManagers, 'other_managers');

    return this.db
      .select(getTableColumns(artists))
      .from(artistManagers)
      .innerJoin(artists, eq(artists.id, artistManagers.artistId))
      .where(
        and(
          eq(artistManagers.userId, userId),
          notExists(
            this.db
              .select({ userId: otherManagers.userId })
              .from(otherManagers)
              .where(
                and(
                  eq(otherManagers.artistId, artistManagers.artistId),
                  ne(otherManagers.userId, userId),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(artists.name));
  }

  /**
   * Read an artist's avatar and header images.
   *
   * @param artistId - The id of the artist.
   * @returns Whichever of the two images the artist has.
   */
  public async listImages(artistId: string): Promise<ArtistImage[]> {
    return this.db
      .select()
      .from(artistImages)
      .where(eq(artistImages.artistId, artistId));
  }

  /**
   * Set an artist's avatar or header, replacing any existing one.
   *
   * @param params - The artist, which image it is, and the uploaded object.
   * @returns The image it replaced, so its object can be removed from storage,
   * or null when there was none.
   */
  public async setImage(
    params: SetArtistImageParams,
  ): Promise<ArtistImage | null> {
    return this.db.transaction(async (tx) => {
      const [previous] = await tx
        .delete(artistImages)
        .where(
          and(
            eq(artistImages.artistId, params.artistId),
            eq(artistImages.kind, params.kind),
          ),
        )
        .returning();

      await tx.insert(artistImages).values(params);

      return previous ?? null;
    });
  }

  /**
   * Remove an artist's avatar or header.
   *
   * @param artistId - The id of the artist.
   * @param kind - Which image to remove.
   * @returns The removed image, so its object can be removed from storage, or
   * null when there was none.
   */
  public async removeImage(
    artistId: string,
    kind: ArtistImageKind,
  ): Promise<ArtistImage | null> {
    const [removed] = await this.db
      .delete(artistImages)
      .where(
        and(eq(artistImages.artistId, artistId), eq(artistImages.kind, kind)),
      )
      .returning();

    return removed ?? null;
  }

  /**
   * Read the links on an artist's profile.
   *
   * @param artistId - The id of the artist.
   * @returns The artist's links in display order.
   */
  public async listLinks(artistId: string): Promise<ArtistLink[]> {
    return this.db
      .select()
      .from(artistLinks)
      .where(eq(artistLinks.artistId, artistId))
      .orderBy(asc(artistLinks.position));
  }

  /**
   * Replace every link on an artist's profile, as when a manager saves the
   * profile form.
   *
   * @param artistId - The id of the artist.
   * @param links - The new links, in display order.
   */
  public async replaceLinks(
    artistId: string,
    links: ArtistLinkInput[],
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.delete(artistLinks).where(eq(artistLinks.artistId, artistId));

      if (links.length === 0) return;

      await tx
        .insert(artistLinks)
        .values(
          links.map((link, position) => ({ artistId, ...link, position })),
        );
    });
  }
}
