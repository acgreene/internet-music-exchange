import Stripe from 'stripe';
import {
  type CopyrightContest,
  type CopyrightContestOutcome,
  DatabaseRepository,
  type ModerationAction,
  type ModerationActionKind,
  type OpenReportGroup,
  type Report,
  type ReportReason,
  type TakenDownLine,
} from '@ime/db';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { Logger } from '@ime/utils';
import { AccessService } from '../access/access-service';
import { DesignMarketplaceService } from '../designs/design-marketplace-service';
import { type Email, EmailService, moderationEmails } from '../email';
import { ReleaseFilesService } from '../releases/release-files-service';
import { CONTEST_DAYS, type ModerationTargetRef } from './report-service';

/** Final copyright takedowns that make an artist a repeat infringer. */
export const REPEAT_INFRINGER_TAKEDOWNS = 3;

const NOTE_MAX_LENGTH = 2000;

/**
 * Why an admin acted: the rule broken, and an optional explanation that is
 * sent to the people affected.
 */
export interface ModerationDecision {
  reason: ReportReason;
  note?: string | null;
}

export interface CopyrightClaimInput {
  claimantName: string;
  claimantEmail: string;
  releaseId: string;
  note?: string | null;
}

/**
 * What a reported item is, for an admin to recognize it.
 */
export interface ModerationSubject {
  /** Its name or title, or an excerpt of a comment. */
  label: string;
  /** Who it belongs to or where it appears, when that helps. */
  context: string | null;
  /** Where it lives in the web app, while it can be seen. */
  path: string | null;
  /** Taken down or suspended. */
  down: boolean;
}

/**
 * One item in the queue, with what it is.
 */
export interface QueueEntry extends OpenReportGroup {
  subject: ModerationSubject | null;
}

/**
 * Everything on record about one reported item.
 */
export interface ModerationCase {
  /** Null once the item is gone for good, as a deleted comment is. */
  subject: ModerationSubject | null;
  reports: Report[];
  actions: ModerationAction[];
  /** The artist's contest waiting on a copyright takedown, if any. */
  openContest: CopyrightContest | null;
}

/**
 * What a takedown refunded. A refund Stripe refused is listed for an admin
 * to follow up by hand.
 */
export interface ModerationOutcome {
  refunded: number;
  failedRefunds: string[];
}

const NOTHING_REFUNDED: ModerationOutcome = { refunded: 0, failedRefunds: [] };

/**
 * Moderation for platform admins: the queue of open reports, dismissing
 * them, taking content down and restoring it, suspensions, cleared profiles,
 * and copyright claims and contests. Every action is logged with who took it
 * and why, and the people affected are emailed.
 *
 * A release taken down for copyright stays restorable while its artist can
 * contest. Once the takedown is final, its buyers are refunded from the
 * artist's account and its files are deleted. Takedowns refund only what
 * was taken down, never the rest of an order.
 */
export class ModerationService {
  private readonly log = new Logger('api').child('moderation');

  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly stripe: Stripe = new Stripe(env.STRIPE_SECRET_KEY),
    private readonly access: AccessService = new AccessService(db),
    private readonly designMarketplace: DesignMarketplaceService = new DesignMarketplaceService(
      db,
      stripe,
    ),
    private readonly releaseFiles: ReleaseFilesService = new ReleaseFilesService(
      db,
    ),
    private readonly email: EmailService = new EmailService(),
    private readonly webAppUrl: string = env.WEB_APP_URL,
  ) {}

  /**
   * The queue: every item with open reports, longest waiting first, with
   * what each item is.
   */
  public async listQueue(
    adminUserId: string,
    limit?: number,
  ): Promise<QueueEntry[]> {
    await this.access.requireAdmin(adminUserId);
    const groups = await this.db.moderation.listOpenReportGroups(limit);
    return Promise.all(
      groups.map(async (group) => ({
        ...group,
        subject: await this.describe({
          type: group.targetType,
          id: group.targetId,
        }),
      })),
    );
  }

  /**
   * One item's reports, the actions taken on it, and any open contest.
   */
  public async getCase(
    adminUserId: string,
    target: ModerationTargetRef,
  ): Promise<ModerationCase> {
    await this.access.requireAdmin(adminUserId);
    const [subject, reports, actions, openContest] = await Promise.all([
      this.describe(target),
      this.db.moderation.listReportsForTarget(target.type, target.id),
      this.db.moderation.listActionsForTarget(target.type, target.id),
      target.type === 'release'
        ? this.db.moderation.getOpenContest(target.id)
        : null,
    ]);
    return { subject, reports, actions, openContest };
  }

  /**
   * Record a copyright claim a rights holder sent to IME's contact address.
   * It is reviewed like any other report.
   *
   * @throws ApiError 400 for a missing name or email, 404 for an unknown
   * release.
   */
  public async recordCopyrightClaim(
    adminUserId: string,
    input: CopyrightClaimInput,
  ): Promise<Report> {
    await this.access.requireAdmin(adminUserId);
    const claimantName = input.claimantName.trim();
    const claimantEmail = input.claimantEmail.trim();
    if (!claimantName || !/^[^\s@]+@[^\s@]+$/.test(claimantEmail)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        "A claim needs the claimant's name and email.",
      );
    }
    if (!(await this.db.releases.getById(input.releaseId))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'Release not found.',
      );
    }
    return this.db.moderation.recordCopyrightClaim({
      claimantName,
      claimantEmail,
      releaseId: input.releaseId,
      note: this.validNote(input.note),
    });
  }

  /**
   * Close an item's open reports without acting on it.
   */
  public async dismiss(
    adminUserId: string,
    target: ModerationTargetRef,
    note?: string | null,
  ): Promise<void> {
    await this.access.requireAdmin(adminUserId);
    await this.db.transaction((repos) =>
      this.record(repos, adminUserId, 'dismiss', target, {
        reason: null,
        note: this.validNote(note),
        resolve: 'dismissed',
      }),
    );
  }

  /**
   * Take an item down and close its reports. A release leaves the catalog and
   * every library; a product leaves the store and its unshipped orders are
   * refunded; a comment is deleted; a design leaves the marketplace and every
   * release using it, and its buyers are refunded; an artist or user is
   * suspended.
   *
   * @throws ApiError 400 for an overlong note, 404 when the item does not
   * exist, 409 when it is already down.
   */
  public async takeDown(
    adminUserId: string,
    target: ModerationTargetRef,
    decision: ModerationDecision,
  ): Promise<ModerationOutcome> {
    await this.access.requireAdmin(adminUserId);
    const reason = decision.reason;
    const note = this.validNote(decision.note);

    switch (target.type) {
      case 'release':
        return this.takeDownRelease(adminUserId, target.id, reason, note);
      case 'product':
        return this.takeDownProduct(adminUserId, target.id, reason, note);
      case 'comment':
        await this.takeDownComment(adminUserId, target.id, reason, note);
        return NOTHING_REFUNDED;
      case 'design':
        return this.takeDownDesign(adminUserId, target.id, reason, note);
      case 'artist':
        await this.suspendArtist(adminUserId, target.id, reason, note);
        return NOTHING_REFUNDED;
      case 'user':
        await this.suspendUser(adminUserId, target.id, reason, note);
        return NOTHING_REFUNDED;
    }
  }

  /**
   * Undo a takedown or suspension. A release can only come back while its
   * takedown is not final; a deleted comment cannot come back.
   *
   * @throws ApiError 404 when the item does not exist, 409 when there is
   * nothing to undo.
   */
  public async restore(
    adminUserId: string,
    target: ModerationTargetRef,
    note?: string | null,
  ): Promise<void> {
    await this.access.requireAdmin(adminUserId);
    const details = { reason: null, note: this.validNote(note) };

    switch (target.type) {
      case 'release':
        return this.restoreRelease(adminUserId, target.id, details.note);
      case 'product': {
        const product = await this.db.products.getById(target.id);
        this.requireDown(product?.status === 'taken_down');
        await this.db.transaction(async (repos) => {
          await repos.moderation.restoreProduct(target.id);
          await this.record(repos, adminUserId, 'restore', target, details);
        });
        await this.emailManagers(product?.artistId, (to) =>
          moderationEmails.restored(to, `"${product?.name}"`),
        );
        return;
      }
      case 'design': {
        const design = await this.db.designs.getById(target.id);
        this.requireDown(design?.status === 'taken_down');
        await this.db.transaction(async (repos) => {
          await repos.moderation.restoreDesign(target.id);
          await this.record(repos, adminUserId, 'restore', target, details);
        });
        await this.emailUser(design?.designerUserId, (to) =>
          moderationEmails.restored(to, `Your design "${design?.name}"`),
        );
        return;
      }
      case 'artist': {
        const artist = await this.db.artists.getById(target.id);
        this.requireDown(Boolean(artist?.suspendedAt));
        await this.db.transaction(async (repos) => {
          await repos.moderation.unsuspendArtist(target.id);
          await this.record(repos, adminUserId, 'unsuspend', target, details);
        });
        await this.emailManagers(target.id, (to) =>
          moderationEmails.restored(to, artist?.name ?? 'Your artist'),
        );
        return;
      }
      case 'user': {
        const user = await this.db.users.getById(target.id);
        this.requireDown(Boolean(user?.suspendedAt));
        await this.db.transaction(async (repos) => {
          await repos.moderation.unsuspendUser(target.id);
          await this.record(repos, adminUserId, 'unsuspend', target, details);
        });
        await this.emailUser(target.id, (to) =>
          moderationEmails.restored(to, 'Your account'),
        );
        return;
      }
      case 'comment':
        throw new ApiError(
          ApiErrorKind.Http,
          HttpStatus.Conflict,
          'A deleted comment cannot be restored.',
        );
    }
  }

  /**
   * Clear an offensive username and display name. The user picks new ones.
   *
   * @throws ApiError 404 when the user does not exist.
   */
  public async clearProfile(
    adminUserId: string,
    userId: string,
    decision: ModerationDecision,
  ): Promise<void> {
    await this.access.requireAdmin(adminUserId);
    const note = this.validNote(decision.note);
    if (!(await this.db.users.getById(userId))) this.notFound('User');

    await this.db.transaction(async (repos) => {
      await repos.moderation.clearUserProfile(userId);
      await this.record(
        repos,
        adminUserId,
        'clear_profile',
        { type: 'user', id: userId },
        { reason: decision.reason, note, resolve: 'actioned' },
      );
    });
    await this.emailUser(userId, (to) =>
      moderationEmails.profileCleared(to, decision.reason, note),
    );
  }

  /**
   * Decide an artist's contest of a copyright takedown: upheld restores the
   * release, rejected makes the takedown final.
   *
   * @throws ApiError 404 when no contest is waiting on the release.
   */
  public async resolveContest(
    adminUserId: string,
    releaseId: string,
    outcome: CopyrightContestOutcome,
    note?: string | null,
  ): Promise<ModerationOutcome> {
    await this.access.requireAdmin(adminUserId);
    const contest = await this.db.moderation.getOpenContest(releaseId);
    if (
      !contest ||
      !(await this.db.moderation.resolveContest(
        contest.id,
        outcome,
        adminUserId,
      ))
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'No contest is waiting on this release.',
      );
    }

    if (outcome === 'upheld') {
      await this.restoreRelease(adminUserId, releaseId, this.validNote(note));
      return NOTHING_REFUNDED;
    }

    const release = await this.db.releases.getById(releaseId);
    await this.emailManagers(release?.artistId, (to) =>
      moderationEmails.contestRejected(to, release?.title ?? 'your release'),
    );
    return this.finalizeTakedown(releaseId, adminUserId);
  }

  /**
   * Make a release takedown final: its buyers are refunded from the artist's
   * account and emailed, and its files are deleted. An artist with repeated
   * final copyright takedowns is suspended. Does nothing for a takedown that
   * is already final. The worker calls this when the window to contest ends.
   *
   * @param adminUserId - The admin deciding it, or null when IME does.
   */
  public async finalizeTakedown(
    releaseId: string,
    adminUserId: string | null,
  ): Promise<ModerationOutcome> {
    const release = await this.db.releases.getById(releaseId);
    if (!release) return NOTHING_REFUNDED;

    const finalized = await this.db.transaction(async (repos) => {
      if (!(await repos.moderation.finalizeReleaseTakedown(releaseId))) {
        return false;
      }
      await this.record(
        repos,
        adminUserId,
        'finalize_takedown',
        { type: 'release', id: releaseId },
        { reason: null, note: null },
      );
      return true;
    });
    if (!finalized) return NOTHING_REFUNDED;

    const artist = await this.db.artists.getById(release.artistId);
    const lines = await this.db.orders.listPaidReleaseLines(releaseId);
    const outcome = await this.refundLines(
      lines,
      `takedown-release-${releaseId}`,
      async (line) => {
        if (line.buyerUserId) {
          await this.db.entitlements.revoke(line.buyerUserId, releaseId);
        }
        await this.emailUser(line.buyerUserId, (to) =>
          moderationEmails.releaseRemovedFromLibrary(
            to,
            release.title,
            artist?.name ?? 'the artist',
            { amount: line.amount, currency: line.currency },
          ),
        );
      },
    );

    await this.releaseFiles.deleteAll(releaseId);
    await this.suspendRepeatInfringer(release.artistId);
    return outcome;
  }

  private async describe(
    target: ModerationTargetRef,
  ): Promise<ModerationSubject | null> {
    switch (target.type) {
      case 'release': {
        const release = await this.db.releases.getById(target.id);
        if (!release) return null;
        const artist = await this.db.artists.getById(release.artistId);
        return {
          label: release.title,
          context: artist ? `by ${artist.name}` : null,
          path:
            artist && release.status === 'published'
              ? `/artists/${artist.handle}/${release.slug}`
              : null,
          down: release.status === 'taken_down',
        };
      }
      case 'product': {
        const product = await this.db.products.getById(target.id);
        if (!product) return null;
        const artist = await this.db.artists.getById(product.artistId);
        return {
          label: product.name,
          context: artist ? `merch by ${artist.name}` : null,
          path:
            artist && product.status === 'published'
              ? `/artists/${artist.handle}/merch/${product.id}`
              : null,
          down: product.status === 'taken_down',
        };
      }
      case 'comment': {
        const comment = await this.db.social.getCommentById(target.id);
        if (!comment) return null;
        const [author, release] = await Promise.all([
          this.db.users.getById(comment.userId),
          this.db.releases.getById(comment.releaseId),
        ]);
        const artist = release
          ? await this.db.artists.getById(release.artistId)
          : null;
        return {
          label: comment.comment,
          context: `@${author?.username ?? 'unknown'} on ${release?.title ?? 'a release'}`,
          path:
            artist && release?.status === 'published'
              ? `/artists/${artist.handle}/${release.slug}`
              : null,
          down: false,
        };
      }
      case 'design': {
        const design = await this.db.designs.getById(target.id);
        if (!design) return null;
        const designer = design.designerUserId
          ? await this.db.users.getById(design.designerUserId)
          : null;
        return {
          label: design.name,
          context: designer?.username
            ? `design by @${designer.username}`
            : null,
          path: `/studio/marketplace/${design.id}`,
          down: design.status === 'taken_down',
        };
      }
      case 'artist': {
        const artist = await this.db.artists.getById(target.id);
        if (!artist) return null;
        return {
          label: artist.name,
          context: `@${artist.handle}`,
          path: artist.suspendedAt ? null : `/artists/${artist.handle}`,
          down: Boolean(artist.suspendedAt),
        };
      }
      case 'user': {
        const user = await this.db.users.getById(target.id);
        if (!user) return null;
        return {
          label: user.name ?? user.username ?? 'A user with no name',
          context: user.username ? `@${user.username}` : null,
          path: user.username ? `/users/${user.username}` : null,
          down: Boolean(user.suspendedAt),
        };
      }
    }
  }

  private async takeDownRelease(
    adminUserId: string,
    releaseId: string,
    reason: ReportReason,
    note: string | null,
  ): Promise<ModerationOutcome> {
    const release = await this.db.releases.getById(releaseId);
    if (!release) this.notFound('Release');
    this.requireUp(release.status !== 'taken_down');

    await this.db.transaction(async (repos) => {
      await repos.moderation.takeDownRelease(releaseId);
      await this.record(
        repos,
        adminUserId,
        'take_down',
        { type: 'release', id: releaseId },
        { reason, note, resolve: 'actioned' },
      );
    });

    // only a copyright claim can be contested; anything else is final now
    const contestable = reason === 'copyright';
    await this.emailManagers(release.artistId, (to) =>
      moderationEmails.takenDown(
        to,
        `"${release.title}"`,
        reason,
        note,
        contestable
          ? {
              url: `${this.webAppUrl}/studio/releases/${releaseId}`,
              days: CONTEST_DAYS,
            }
          : null,
      ),
    );
    return contestable
      ? NOTHING_REFUNDED
      : this.finalizeTakedown(releaseId, adminUserId);
  }

  private async restoreRelease(
    adminUserId: string,
    releaseId: string,
    note: string | null,
  ): Promise<void> {
    const release = await this.db.releases.getById(releaseId);
    if (!release) this.notFound('Release');

    const restored = await this.db.transaction(async (repos) => {
      if (!(await repos.moderation.restoreRelease(releaseId))) return false;
      await this.record(
        repos,
        adminUserId,
        'restore',
        { type: 'release', id: releaseId },
        { reason: null, note },
      );
      return true;
    });
    if (!restored) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Only a release whose takedown is not final can be restored.',
      );
    }
    await this.emailManagers(release.artistId, (to) =>
      moderationEmails.restored(to, `"${release.title}"`),
    );
  }

  private async takeDownProduct(
    adminUserId: string,
    productId: string,
    reason: ReportReason,
    note: string | null,
  ): Promise<ModerationOutcome> {
    const product = await this.db.products.getById(productId);
    if (!product) this.notFound('Product');
    this.requireUp(product.status !== 'taken_down');

    await this.db.transaction(async (repos) => {
      await repos.moderation.takeDownProduct(productId);
      await this.record(
        repos,
        adminUserId,
        'take_down',
        { type: 'product', id: productId },
        { reason, note, resolve: 'actioned' },
      );
    });
    await this.emailManagers(product.artistId, (to) =>
      moderationEmails.takenDown(to, `"${product.name}"`, reason, note, null),
    );

    const lines = await this.db.orders.listUnshippedProductLines(productId);
    return this.refundLines(lines, `takedown-product-${productId}`, (line) =>
      this.emailUser(line.buyerUserId, (to) =>
        moderationEmails.orderLineRefunded(
          to,
          product.name,
          line.amount,
          line.currency,
        ),
      ),
    );
  }

  private async takeDownComment(
    adminUserId: string,
    commentId: string,
    reason: ReportReason,
    note: string | null,
  ): Promise<void> {
    if (!(await this.db.social.getCommentById(commentId))) {
      this.notFound('Comment');
    }
    await this.db.transaction(async (repos) => {
      await repos.social.deleteComment(commentId);
      await this.record(
        repos,
        adminUserId,
        'take_down',
        { type: 'comment', id: commentId },
        { reason, note, resolve: 'actioned' },
      );
    });
  }

  private async takeDownDesign(
    adminUserId: string,
    designId: string,
    reason: ReportReason,
    note: string | null,
  ): Promise<ModerationOutcome> {
    const design = await this.db.designs.getById(designId);
    if (!design) this.notFound('Design');
    this.requireUp(design.status !== 'taken_down');

    await this.db.transaction(async (repos) => {
      await repos.moderation.takeDownDesign(designId);
      await this.record(
        repos,
        adminUserId,
        'take_down',
        { type: 'design', id: designId },
        { reason, note, resolve: 'actioned' },
      );
    });
    await this.emailUser(design.designerUserId, (to) =>
      moderationEmails.takenDown(
        to,
        `Your design "${design.name}"`,
        reason,
        note,
        null,
      ),
    );

    // releases using it fall back to the default layout; tell their managers
    const titlesByArtist = new Map<string, string[]>();
    for (const release of await this.db.designs.listReleasesUsingDesign(
      designId,
    )) {
      titlesByArtist.set(release.artistId, [
        ...(titlesByArtist.get(release.artistId) ?? []),
        release.title,
      ]);
    }
    for (const [artistId, titles] of titlesByArtist) {
      await this.emailManagers(artistId, (to) =>
        moderationEmails.designRemoved(to, design.name, titles),
      );
    }

    const outcome = { refunded: 0, failedRefunds: [] as string[] };
    for (const license of await this.db.designs.listPaidLicenses(designId)) {
      try {
        await this.designMarketplace.refundPurchase(license);
        outcome.refunded++;
      } catch (error) {
        this.log.error(
          `could not refund design purchase ${license.stripePaymentIntentId}`,
          error,
        );
        outcome.failedRefunds.push(license.stripePaymentIntentId as string);
      }
    }
    return outcome;
  }

  private async suspendArtist(
    adminUserId: string | null,
    artistId: string,
    reason: ReportReason,
    note: string | null,
  ): Promise<void> {
    const artist = await this.db.artists.getById(artistId);
    if (!artist) this.notFound('Artist');
    this.requireUp(!artist.suspendedAt);

    await this.db.transaction(async (repos) => {
      await repos.moderation.suspendArtist(artistId);
      await this.record(
        repos,
        adminUserId,
        'suspend',
        { type: 'artist', id: artistId },
        { reason, note, resolve: adminUserId ? 'actioned' : undefined },
      );
    });
    await this.emailManagers(artistId, (to) =>
      moderationEmails.suspended(to, artist.name, reason, note),
    );
  }

  private async suspendUser(
    adminUserId: string,
    userId: string,
    reason: ReportReason,
    note: string | null,
  ): Promise<void> {
    const user = await this.db.users.getById(userId);
    if (!user) this.notFound('User');
    this.requireUp(!user.suspendedAt);

    await this.db.transaction(async (repos) => {
      await repos.moderation.suspendUser(userId);
      await this.record(
        repos,
        adminUserId,
        'suspend',
        { type: 'user', id: userId },
        { reason, note, resolve: 'actioned' },
      );
    });
    await this.emailUser(userId, (to) =>
      moderationEmails.suspended(to, 'Your account', reason, note),
    );
  }

  /**
   * Suspend an artist once enough of its releases are finally taken down for
   * copyright.
   */
  private async suspendRepeatInfringer(artistId: string): Promise<void> {
    const artist = await this.db.artists.getById(artistId);
    if (
      !artist ||
      artist.suspendedAt ||
      (await this.db.moderation.countCopyrightTakedowns(artistId)) <
        REPEAT_INFRINGER_TAKEDOWNS
    ) {
      return;
    }
    await this.suspendArtist(
      null,
      artistId,
      'copyright',
      `${REPEAT_INFRINGER_TAKEDOWNS} or more releases were taken down for copyright.`,
    );
  }

  /**
   * Refund each line from its artist's Stripe account, then run `after` for
   * it. A refund Stripe refuses is logged and listed, and the rest go ahead.
   *
   * @param key - Makes each refund happen once, even when run again.
   */
  private async refundLines(
    lines: TakenDownLine[],
    key: string,
    after: (line: TakenDownLine) => Promise<void>,
  ): Promise<ModerationOutcome> {
    const outcome = { refunded: 0, failedRefunds: [] as string[] };
    for (const line of lines) {
      try {
        const payout = await this.db.payments.getAccountByArtistId(
          line.artistId,
        );
        if (!payout) throw new Error('the artist has no payment account');
        await this.stripe.refunds.create(
          { payment_intent: line.stripePaymentIntentId, amount: line.amount },
          {
            stripeAccount: payout.stripeAccountId,
            idempotencyKey: `${key}-${line.artistOrderId}`,
          },
        );
        outcome.refunded++;
      } catch (error) {
        this.log.error(`could not refund sale ${line.artistOrderId}`, error);
        outcome.failedRefunds.push(line.artistOrderId);
        continue;
      }
      await after(line);
    }
    return outcome;
  }

  /**
   * Log an admin action, and close the item's open reports when it settles
   * them.
   */
  private async record(
    repos: DatabaseRepository,
    adminUserId: string | null,
    action: ModerationActionKind,
    target: ModerationTargetRef,
    details: {
      reason: ReportReason | null;
      note: string | null;
      resolve?: 'dismissed' | 'actioned';
    },
  ): Promise<void> {
    if (details.resolve && adminUserId) {
      await repos.moderation.resolveReports(
        target.type,
        target.id,
        details.resolve,
        adminUserId,
      );
    }
    await repos.moderation.logAction({
      adminUserId,
      action,
      targetType: target.type,
      targetId: target.id,
      reason: details.reason,
      note: details.note,
    });
  }

  /**
   * Email every manager of an artist. A failure is logged, since the action
   * it reports has already happened.
   */
  private async emailManagers(
    artistId: string | null | undefined,
    build: (to: string) => Email,
  ): Promise<void> {
    if (!artistId) return;
    for (const manager of await this.db.artists.listManagers(artistId)) {
      await this.emailUser(manager.userId, build);
    }
  }

  private async emailUser(
    userId: string | null | undefined,
    build: (to: string) => Email,
  ): Promise<void> {
    if (!userId) return;
    try {
      const address = await this.db.users.getEmail(userId);
      if (address) await this.email.send(build(address));
    } catch (error) {
      this.log.error(`could not email user ${userId}`, error);
    }
  }

  private validNote(note?: string | null): string | null {
    const trimmed = note?.trim() || null;
    if (trimmed && trimmed.length > NOTE_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Notes are up to ${NOTE_MAX_LENGTH} characters.`,
      );
    }
    return trimmed;
  }

  private requireUp(up: boolean): void {
    if (!up) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'This is already taken down.',
      );
    }
  }

  private requireDown(down: boolean): void {
    if (!down) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'There is no takedown or suspension to undo.',
      );
    }
  }

  private notFound(what: string): never {
    throw new ApiError(
      ApiErrorKind.Http,
      HttpStatus.NotFound,
      `${what} not found.`,
    );
  }
}
