import { and, asc, eq, exists, ilike, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '../database-service';
import { type Artist, artistManagers, artists, users } from '../tables';

export interface CreateArtistParams {
  name: string;
  bio?: string | null;
  createdByUserId: string;
}

export interface UpdateArtistParams {
  name?: string;
  bio?: string | null;
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

const DEFAULT_SEARCH_LIMIT = 20;

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
   * Create an artist profile and record its creator as the first manager.
   *
   * @param params - The artist's name, optional bio, and the id of the user creating it.
   * @returns The newly created artist row.
   */
  public async create(params: CreateArtistParams): Promise<Artist> {
    return this.db.transaction(async (tx) => {
      const [artist] = await tx
        .insert(artists)
        .values({ name: params.name, bio: params.bio })
        .returning();

      // the on_artist_created trigger reads auth.uid(), which is null under
      // service_role, so the first manager is written here instead
      await tx
        .insert(artistManagers)
        .values({ userId: params.createdByUserId, artistId: artist.id })
        .onConflictDoNothing();

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
   * Find artists whose name contains the given text.
   *
   * @param query - The text to match against artist names, case-insensitive.
   * @param limit - The maximum number of artists to return.
   * @returns Matching artist rows in alphabetical order.
   */
  public async searchByName(
    query: string,
    limit: number = DEFAULT_SEARCH_LIMIT,
  ): Promise<Artist[]> {
    return this.db
      .select()
      .from(artists)
      .where(ilike(artists.name, `%${query}%`))
      .orderBy(asc(artists.name))
      .limit(limit);
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
      .select({
        id: artists.id,
        name: artists.name,
        bio: artists.bio,
        createdAt: artists.createdAt,
      })
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

    const removed = await this.db
      .delete(artistManagers)
      .where(
        and(
          eq(artistManagers.userId, userId),
          eq(artistManagers.artistId, artistId),
          // an artist is unmanageable with nobody on it, so the delete only
          // matches while another manager remains
          exists(
            this.db
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
  }
}
