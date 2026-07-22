import { and, asc, eq, ilike, inArray, ne } from 'drizzle-orm';
import type { Db } from '../database-service';
import { type User, users } from '../tables';

export interface UpdateUserParams {
  username?: string | null;
  name?: string | null;
}

const DEFAULT_SEARCH_LIMIT = 20;

/**
 * Queries for public user profiles. Accounts themselves live in Supabase auth:
 * a trigger mirrors new ones in, and deleting the auth user removes the row.
 */
export class UserRepository {
  constructor(private readonly db: Db) {}

  /**
   * Find a user by their id.
   *
   * @param userId - The id of the user to look up.
   * @returns The user row, or null when no user has that id.
   */
  public async getById(userId: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user ?? null;
  }

  /**
   * Find a user by the handle they chose.
   *
   * @param username - The username to look up.
   * @returns The user row, or null when nobody has that username.
   */
  public async getByUsername(username: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user ?? null;
  }

  /**
   * Read many profiles at once, so a page crediting several users resolves them
   * in a single query.
   *
   * @param userIds - The ids of the users to read.
   * @returns One row per user that exists. Unknown ids are absent.
   */
  public async listByIds(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];

    return this.db.select().from(users).where(inArray(users.id, userIds));
  }

  /**
   * Find users whose handle contains the given text, as when naming somebody to
   * manage an artist.
   *
   * @param query - The text to match against usernames, case insensitive.
   * @param limit - The maximum number of users to return.
   * @returns Matching user rows in alphabetical order.
   */
  public async searchByUsername(
    query: string,
    limit: number = DEFAULT_SEARCH_LIMIT,
  ): Promise<User[]> {
    return this.db
      .select()
      .from(users)
      .where(ilike(users.username, `%${query}%`))
      .orderBy(asc(users.username))
      .limit(limit);
  }

  /**
   * Update a user's public profile.
   *
   * @param userId - The id of the user to update.
   * @param params - The fields to change; omitted fields are left as they are.
   */
  public async updateById(
    userId: string,
    params: UpdateUserParams,
  ): Promise<void> {
    await this.db.update(users).set(params).where(eq(users.id, userId));
  }

  /**
   * Report whether a handle is free to take. The unique constraint on the
   * column is what actually settles it, since two users can ask at once.
   *
   * @param username - The username being considered.
   * @param excludeUserId - A user to ignore, so somebody re-saving their own
   * profile is not told their handle is taken.
   * @returns True when no other user holds that username.
   */
  public async isUsernameAvailable(
    username: string,
    excludeUserId?: string,
  ): Promise<boolean> {
    const [taken] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.username, username),
          excludeUserId ? ne(users.id, excludeUserId) : undefined,
        ),
      )
      .limit(1);

    return !taken;
  }
}
