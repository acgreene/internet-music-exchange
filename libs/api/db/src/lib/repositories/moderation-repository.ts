import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNull,
  min,
  sql,
} from 'drizzle-orm';
import type { Db } from '../database-service';
import {
  artists,
  type CopyrightContest,
  copyrightContests,
  type CopyrightContestOutcome,
  designs,
  type ModerationAction,
  moderationActions,
  type ModerationActionKind,
  type ModerationTarget,
  platformAdmins,
  products,
  releases,
  type Report,
  type ReportReason,
  reports,
  users,
} from '../tables';

/**
 * Every open report about one item, as the admin queue shows it.
 */
export interface OpenReportGroup {
  targetType: ModerationTarget;
  targetId: string;
  reports: number;
  reasons: ReportReason[];
  firstReportedAt: Date;
}

export interface CreateReportParams {
  reporterUserId: string;
  targetType: ModerationTarget;
  targetId: string;
  reason: ReportReason;
  note?: string | null;
}

export interface RecordCopyrightClaimParams {
  claimantName: string;
  claimantEmail: string;
  releaseId: string;
  note?: string | null;
}

export interface LogActionParams {
  adminUserId: string;
  action: ModerationActionKind;
  targetType: ModerationTarget;
  targetId: string;
  reason?: ReportReason | null;
  note?: string | null;
}

export interface FileContestParams {
  releaseId: string;
  contestedByUserId: string;
  statement: string;
}

const DEFAULT_QUEUE_LIMIT = 50;

/**
 * Queries for platform admins and the moderation they do: reports, the action
 * log, takedowns, suspensions, and copyright contests.
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
   * File a user's report.
   *
   * @param params - The reporter, what they are reporting, why, and an
   * optional note.
   * @returns The new report, or null when that user already reported that
   * item.
   */
  public async createReport(
    params: CreateReportParams,
  ): Promise<Report | null> {
    const [report] = await this.db
      .insert(reports)
      .values(params)
      .onConflictDoNothing()
      .returning();

    return report ?? null;
  }

  /**
   * Record a copyright claim a rights holder sent without an account.
   *
   * @param params - The claimant's name and email, the release, and the claim.
   * @returns The new report.
   */
  public async recordCopyrightClaim(
    params: RecordCopyrightClaimParams,
  ): Promise<Report> {
    const [report] = await this.db
      .insert(reports)
      .values({
        claimantName: params.claimantName,
        claimantEmail: params.claimantEmail,
        targetType: 'release',
        targetId: params.releaseId,
        reason: 'copyright',
        note: params.note,
      })
      .returning();

    return report;
  }

  /**
   * Read the admin queue: every item with open reports, longest waiting first.
   *
   * @param limit - The maximum number of items to return.
   * @returns One entry per reported item with how many open reports it has and
   * why.
   */
  public async listOpenReportGroups(
    limit: number = DEFAULT_QUEUE_LIMIT,
  ): Promise<OpenReportGroup[]> {
    const firstReportedAt = min(reports.createdAt);

    const groups = await this.db
      .select({
        targetType: reports.targetType,
        targetId: reports.targetId,
        reports: count(),
        reasons: sql<ReportReason[]>`array_agg(DISTINCT ${reports.reason})`,
        firstReportedAt,
      })
      .from(reports)
      .where(eq(reports.status, 'open'))
      .groupBy(reports.targetType, reports.targetId)
      .orderBy(asc(firstReportedAt))
      .limit(limit);

    // min() is nullable in general, but every group here has at least one row
    return groups.map((group) => ({
      ...group,
      firstReportedAt: group.firstReportedAt as Date,
    }));
  }

  /**
   * List every report about one item, open or resolved.
   *
   * @param targetType - The kind of item.
   * @param targetId - The id of the item.
   * @returns Its reports, oldest first.
   */
  public async listReportsForTarget(
    targetType: ModerationTarget,
    targetId: string,
  ): Promise<Report[]> {
    return this.db
      .select()
      .from(reports)
      .where(
        and(eq(reports.targetType, targetType), eq(reports.targetId, targetId)),
      )
      .orderBy(asc(reports.createdAt));
  }

  /**
   * Close every open report about one item.
   *
   * @param targetType - The kind of item.
   * @param targetId - The id of the item.
   * @param status - Whether the reports were dismissed or acted on.
   * @param adminUserId - The admin who reviewed them.
   * @returns How many reports were closed.
   */
  public async resolveReports(
    targetType: ModerationTarget,
    targetId: string,
    status: 'dismissed' | 'actioned',
    adminUserId: string,
  ): Promise<number> {
    const resolved = await this.db
      .update(reports)
      .set({ status, resolvedByUserId: adminUserId, resolvedAt: new Date() })
      .where(
        and(
          eq(reports.targetType, targetType),
          eq(reports.targetId, targetId),
          eq(reports.status, 'open'),
        ),
      )
      .returning({ id: reports.id });

    return resolved.length;
  }

  /**
   * Record an admin action in the log.
   *
   * @param params - The admin, what they did to which item, and why.
   * @returns The logged action.
   */
  public async logAction(params: LogActionParams): Promise<ModerationAction> {
    const [action] = await this.db
      .insert(moderationActions)
      .values(params)
      .returning();

    return action;
  }

  /**
   * Read the history of admin actions on one item.
   *
   * @param targetType - The kind of item.
   * @param targetId - The id of the item.
   * @returns Its actions, newest first.
   */
  public async listActionsForTarget(
    targetType: ModerationTarget,
    targetId: string,
  ): Promise<ModerationAction[]> {
    return this.db
      .select()
      .from(moderationActions)
      .where(
        and(
          eq(moderationActions.targetType, targetType),
          eq(moderationActions.targetId, targetId),
        ),
      )
      .orderBy(desc(moderationActions.createdAt));
  }

  /**
   * Count how many of an artist's releases have been taken down for copyright,
   * to spot repeat infringers.
   *
   * @param artistId - The id of the artist.
   * @returns The number of copyright takedowns.
   */
  public async countCopyrightTakedowns(artistId: string): Promise<number> {
    const [takedowns] = await this.db
      .select({ value: count() })
      .from(moderationActions)
      .where(
        and(
          eq(moderationActions.action, 'take_down'),
          eq(moderationActions.reason, 'copyright'),
          eq(moderationActions.targetType, 'release'),
          inArray(
            moderationActions.targetId,
            this.db
              .select({ id: releases.id })
              .from(releases)
              .where(eq(releases.artistId, artistId)),
          ),
        ),
      );

    return takedowns?.value ?? 0;
  }

  /**
   * Take a release down: out of the catalog and every library at once. It can
   * be restored until the takedown is made final.
   *
   * @param releaseId - The id of the release.
   */
  public async takeDownRelease(releaseId: string): Promise<void> {
    await this.db
      .update(releases)
      .set({ status: 'taken_down', takedownFinalAt: null })
      .where(eq(releases.id, releaseId));
  }

  /**
   * Make a release takedown final, once it can no longer be contested.
   *
   * @param releaseId - The id of the release.
   * @returns True when the takedown was made final, false when the release is
   * not taken down or already final.
   */
  public async finalizeReleaseTakedown(releaseId: string): Promise<boolean> {
    const finalized = await this.db
      .update(releases)
      .set({ takedownFinalAt: new Date() })
      .where(
        and(
          eq(releases.id, releaseId),
          eq(releases.status, 'taken_down'),
          isNull(releases.takedownFinalAt),
        ),
      )
      .returning({ id: releases.id });

    return finalized.length > 0;
  }

  /**
   * Put a taken-down release back in the catalog and its owners' libraries.
   *
   * @param releaseId - The id of the release.
   * @returns True when it was restored, false when it is not taken down or the
   * takedown is already final.
   */
  public async restoreRelease(releaseId: string): Promise<boolean> {
    const restored = await this.db
      .update(releases)
      .set({ status: 'published' })
      .where(
        and(
          eq(releases.id, releaseId),
          eq(releases.status, 'taken_down'),
          isNull(releases.takedownFinalAt),
        ),
      )
      .returning({ id: releases.id });

    return restored.length > 0;
  }

  /**
   * Take a product out of the store.
   *
   * @param productId - The id of the product.
   */
  public async takeDownProduct(productId: string): Promise<void> {
    await this.db
      .update(products)
      .set({ status: 'taken_down' })
      .where(eq(products.id, productId));
  }

  /**
   * Put a taken-down product back in the store.
   *
   * @param productId - The id of the product.
   */
  public async restoreProduct(productId: string): Promise<void> {
    await this.db
      .update(products)
      .set({ status: 'published' })
      .where(
        and(eq(products.id, productId), eq(products.status, 'taken_down')),
      );
  }

  /**
   * Take a design off the marketplace and off every release using it.
   *
   * @param designId - The id of the design.
   */
  public async takeDownDesign(designId: string): Promise<void> {
    await this.db
      .update(designs)
      .set({ status: 'taken_down', updatedAt: new Date() })
      .where(eq(designs.id, designId));
  }

  /**
   * Put a taken-down design back.
   *
   * @param designId - The id of the design.
   */
  public async restoreDesign(designId: string): Promise<void> {
    await this.db
      .update(designs)
      .set({ status: 'published', updatedAt: new Date() })
      .where(and(eq(designs.id, designId), eq(designs.status, 'taken_down')));
  }

  /**
   * Suspend an artist: hidden from the catalog, and unable to sell or upload.
   * Listeners keep the releases they own.
   *
   * @param artistId - The id of the artist.
   */
  public async suspendArtist(artistId: string): Promise<void> {
    await this.db
      .update(artists)
      .set({ suspendedAt: new Date() })
      .where(eq(artists.id, artistId));
  }

  /**
   * Lift an artist's suspension.
   *
   * @param artistId - The id of the artist.
   */
  public async unsuspendArtist(artistId: string): Promise<void> {
    await this.db
      .update(artists)
      .set({ suspendedAt: null })
      .where(eq(artists.id, artistId));
  }

  /**
   * Suspend a user. They keep their account and library but can no longer
   * post, report, publish, or sell.
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

  /**
   * Clear an offensive username and display name. The user picks new ones.
   *
   * @param userId - The id of the user.
   */
  public async clearUserProfile(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ username: null, name: null })
      .where(eq(users.id, userId));
  }

  /**
   * File an artist's contest of a copyright takedown.
   *
   * @param params - The release, the manager contesting, and their statement.
   * @returns The new contest, or null when one is already open for that
   * release.
   */
  public async fileContest(
    params: FileContestParams,
  ): Promise<CopyrightContest | null> {
    const [contest] = await this.db
      .insert(copyrightContests)
      .values(params)
      .onConflictDoNothing()
      .returning();

    return contest ?? null;
  }

  /**
   * Read the contest still waiting on a release, if any.
   *
   * @param releaseId - The id of the release.
   * @returns The open contest, or null when there is none.
   */
  public async getOpenContest(
    releaseId: string,
  ): Promise<CopyrightContest | null> {
    const [contest] = await this.db
      .select()
      .from(copyrightContests)
      .where(
        and(
          eq(copyrightContests.releaseId, releaseId),
          isNull(copyrightContests.resolvedAt),
        ),
      )
      .limit(1);

    return contest ?? null;
  }

  /**
   * Decide a copyright contest.
   *
   * @param contestId - The id of the contest.
   * @param outcome - Whether the artist's contest was upheld or rejected.
   * @param adminUserId - The admin deciding it.
   * @returns The decided contest, or null when it was already decided.
   */
  public async resolveContest(
    contestId: string,
    outcome: CopyrightContestOutcome,
    adminUserId: string,
  ): Promise<CopyrightContest | null> {
    const [contest] = await this.db
      .update(copyrightContests)
      .set({ outcome, resolvedByUserId: adminUserId, resolvedAt: new Date() })
      .where(
        and(
          eq(copyrightContests.id, contestId),
          isNull(copyrightContests.resolvedAt),
        ),
      )
      .returning();

    return contest ?? null;
  }
}
