import {
  type CopyrightContest,
  DatabaseRepository,
  type ModerationTarget,
  type Release,
  type Report,
  type ReportReason,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { AccessService } from '../access/access-service';

/** How long an artist has to contest a copyright takedown. */
export const CONTEST_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTE_MAX_LENGTH = 1000;
const STATEMENT_MAX_LENGTH = 5000;

/**
 * Something that can be reported or moderated, by kind and id.
 */
export interface ModerationTargetRef {
  type: ModerationTarget;
  id: string;
}

/**
 * Why a release was taken down, and whether its managers can still contest.
 */
export interface ReleaseTakedown {
  reason: ReportReason;
  note: string | null;
  takenDownAt: Date;
  /** The last day to contest a copyright takedown, while it can be. */
  contestBy: Date | null;
  contestPending: boolean;
}

/**
 * The community's side of moderation: reporting content, and an artist's
 * managers contesting a copyright takedown of one of their releases.
 */
export class ReportService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly access: AccessService = new AccessService(db),
  ) {}

  /**
   * Report something for an admin to review. A user reports an item once.
   *
   * @throws ApiError 400 for an overlong note, 403 when the user is
   * suspended, 404 when the item does not exist, 409 when the user already
   * reported it.
   */
  public async report(
    userId: string,
    target: ModerationTargetRef,
    reason: ReportReason,
    note?: string | null,
  ): Promise<Report> {
    await this.access.requireActiveUser(userId);
    await this.requireTarget(target);
    const trimmed = note?.trim() || null;
    if (trimmed && trimmed.length > NOTE_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Notes are up to ${NOTE_MAX_LENGTH} characters.`,
      );
    }

    const report = await this.db.moderation.createReport({
      reporterUserId: userId,
      targetType: target.type,
      targetId: target.id,
      reason,
      note: trimmed,
    });
    if (!report) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'You already reported this.',
      );
    }
    return report;
  }

  /**
   * Contest a copyright takedown of one of the artist's releases. Until an
   * admin decides, the release's files are kept.
   *
   * @throws ApiError 400 for an empty or overlong statement, 409 unless the
   * release is taken down for copyright and still open to contest, or when a
   * contest is already waiting.
   */
  public async contest(
    userId: string,
    releaseId: string,
    statement: string,
  ): Promise<CopyrightContest> {
    const release = await this.access.requireReleaseManager(userId, releaseId);
    const actions = await this.db.moderation.listActionsForTarget(
      'release',
      releaseId,
    );
    const takedown = actions.find((action) => action.action === 'take_down');
    if (
      release.status !== 'taken_down' ||
      release.takedownFinalAt ||
      takedown?.reason !== 'copyright'
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Only a copyright takedown still open to contest can be contested.',
      );
    }
    const trimmed = statement.trim();
    if (!trimmed || trimmed.length > STATEMENT_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Explain why in up to ${STATEMENT_MAX_LENGTH} characters.`,
      );
    }

    const contest = await this.db.moderation.fileContest({
      releaseId,
      contestedByUserId: userId,
      statement: trimmed,
    });
    if (!contest) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'This takedown is already being contested.',
      );
    }
    return contest;
  }

  /**
   * Why a release is taken down, for its managers, or null while it is up.
   * Callers check the user manages the release.
   */
  public async getTakedown(release: Release): Promise<ReleaseTakedown | null> {
    if (release.status !== 'taken_down') return null;
    const [actions, openContest] = await Promise.all([
      this.db.moderation.listActionsForTarget('release', release.id),
      this.db.moderation.getOpenContest(release.id),
    ]);
    // newest first, so the takedown in force
    const takedown = actions.find((action) => action.action === 'take_down');
    if (!takedown) return null;
    const contestable =
      takedown.reason === 'copyright' &&
      !release.takedownFinalAt &&
      !openContest;
    return {
      reason: takedown.reason ?? 'other',
      note: takedown.note,
      takenDownAt: takedown.createdAt,
      contestBy: contestable
        ? new Date(takedown.createdAt.getTime() + CONTEST_DAYS * DAY_MS)
        : null,
      contestPending: Boolean(openContest),
    };
  }

  private async requireTarget(target: ModerationTargetRef): Promise<void> {
    const lookups: Record<ModerationTarget, () => Promise<unknown>> = {
      release: () => this.db.releases.getById(target.id),
      product: () => this.db.products.getById(target.id),
      comment: () => this.db.social.getCommentById(target.id),
      design: () => this.db.designs.getById(target.id),
      artist: () => this.db.artists.getById(target.id),
      user: () => this.db.users.getById(target.id),
    };
    if (!(await lookups[target.type]())) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'There is nothing to report there.',
      );
    }
  }
}
