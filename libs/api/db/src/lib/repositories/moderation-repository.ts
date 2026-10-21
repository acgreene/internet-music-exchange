import { eq } from 'drizzle-orm';
import type { Db } from '../database-service';
import { platformAdmins, users } from '../tables';

/**
 * Queries for platform admins and the moderation actions they take.
 */
export class ModerationRepository {
  constructor(private readonly db: Db) {}

  /**
   * Report whether a user is a platform admin.
   *
   * @param userId - The id of the user to check.
   * @returns True when the user can review reports and take content down.
   */
  public async isAdmin(userId: string): Promise<boolean> {
    const [admin] = await this.db
      .select({ userId: platformAdmins.userId })
      .from(platformAdmins)
      .where(eq(platformAdmins.userId, userId))
      .limit(1);

    return Boolean(admin);
  }

  /**
   * Make a user a platform admin.
   *
   * @param userId - The id of the user to promote.
   */
  public async addAdmin(userId: string): Promise<void> {
    await this.db
      .insert(platformAdmins)
      .values({ userId })
      .onConflictDoNothing();
  }

  /**
   * Remove a user's platform admin rights.
   *
   * @param userId - The id of the user to demote.
   */
  public async removeAdmin(userId: string): Promise<void> {
    await this.db
      .delete(platformAdmins)
      .where(eq(platformAdmins.userId, userId));
  }

  /**
   * Suspend a user. They keep their account and library but can no longer
   * post, publish, or sell.
   *
   * @param userId - The id of the user to suspend.
   */
  public async suspendUser(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ suspendedAt: new Date() })
      .where(eq(users.id, userId));
  }

  /**
   * Lift a user's suspension.
   *
   * @param userId - The id of the user to restore.
   */
  public async unsuspendUser(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ suspendedAt: null })
      .where(eq(users.id, userId));
  }
}
