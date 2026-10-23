import {
  DatabaseRepository,
  type MonthlyUsage,
  type PlatformCostCategory,
  type StatementLine,
} from '@ime/db';
import { env } from '@ime/env';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { Logger } from '@ime/utils';
import { AccessService } from '../access/access-service';
import { EmailService, fundingEmails } from '../email';
import { BillingService } from './billing-service';
import { FundingService, RESERVE_TARGET_MONTHS } from './funding-service';
import { monthSpan } from './month-span';

/** Days a lapsed seller has to top up before things come off sale. */
export const GRACE_DAYS = 14;

/** The most one funding entry can add to the reserve, in cents. */
const MAX_FUNDING = 1_000_000;
const NOTE_MAX_LENGTH = 200;
const BYTES_PER_GB = 1_000_000_000;
const REQUESTS_PER_MILLION = 1_000_000;
const MICRODOLLARS_PER_CENT = 10_000;
const WHOLE_SHARE = 10_000;

export interface PeriodRates {
  storageMicrodollarsPerGbMonth: number;
  requestMicrodollarsPerMillion: number;
}

/**
 * What closing a month did.
 */
export interface CloseSummary {
  sellers: number;
  sharedCostsTotal: number;
  sharedPerSeller: number;
  /** What the reserve paid toward sellers' shares. */
  coveredByReserve: number;
  autoTopUps: number;
  lapsed: number;
  /** Sellers whose follow-up (top-up, alert, lapse) failed and needs a look. */
  failures: string[];
}

/**
 * The monthly close: an admin opens a month with the provider's rates, enters
 * the platform's bills as they arrive, then closes it. Closing prices every
 * seller's usage, splits the shared costs, issues statements, and charges
 * balances, then runs auto top-ups and sends alerts.
 *
 * Closing is safe to run again if it stops partway: statements, the surplus,
 * and credits are each recorded once per month.
 */
export class MonthlyCloseService {
  private readonly log = new Logger('api').child('monthly-close');

  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly access: AccessService = new AccessService(db),
    private readonly funding: FundingService = new FundingService(db),
    private readonly billing: BillingService = new BillingService(db),
    private readonly email: EmailService = new EmailService(),
    private readonly webAppUrl: string = env.WEB_APP_URL,
  ) {}

  /**
   * Open a month for billing at the provider's rates.
   *
   * @param adminUserId
   * @param month - The first day of the month, `YYYY-MM-01`.
   * @param rates
   * @throws ApiError 400 for a date that is not the first of a month.
   */
  public async openMonth(
    adminUserId: string,
    month: string,
    rates: PeriodRates,
  ): Promise<void> {
    await this.access.requireAdmin(adminUserId);
    if (!/^\d{4}-\d{2}-01$/.test(month)) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'A billing month is written as its first day, like 2026-10-01.',
      );
    }
    await this.db.funding.openPeriod({ month, ...rates });
  }

  /**
   * Record one of the month's bills.
   *
   * @throws ApiError 409 when the month is not open.
   */
  public async addCost(
    adminUserId: string,
    month: string,
    category: PlatformCostCategory,
    description: string,
    amount: number,
  ): Promise<void> {
    await this.access.requireAdmin(adminUserId);
    await this.requireOpenPeriod(month);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'A bill is a whole number of cents above zero.',
      );
    }
    await this.db.funding.addPlatformCost(month, category, description, amount);
  }

  /**
   * Put IME's own money into the reserve, as at launch before sellers pay.
   * While the reserve holds more than its target, it pays sellers' shares.
   *
   * @param amount - How much, in cents.
   * @param note - Where it came from, optional.
   * @throws ApiError 400 for an amount out of range or an overlong note.
   */
  public async fundReserve(
    adminUserId: string,
    amount: number,
    note?: string,
  ): Promise<void> {
    await this.access.requireAdmin(adminUserId);
    const text = note?.trim() ?? '';
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_FUNDING) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Funding is a whole number of cents up to $${MAX_FUNDING / 100}.`,
      );
    }
    if (text.length > NOTE_MAX_LENGTH) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        `Notes are up to ${NOTE_MAX_LENGTH} characters.`,
      );
    }
    await this.db.funding.fundReserve(amount, text || null);
  }

  /**
   * Close a month: issue every seller's statement and charge it.
   *
   * @throws ApiError 409 when the month is not open.
   */
  public async closeMonth(
    adminUserId: string,
    month: string,
  ): Promise<CloseSummary> {
    await this.access.requireAdmin(adminUserId);
    const period = await this.requireOpenPeriod(month);
    const { start, end, days } = monthSpan(month);

    const [usage, costs, allShares] = await Promise.all([
      this.db.funding.listUsage(month),
      this.db.funding.listPlatformCosts(month),
      this.db.funding.listAllCostShares(),
    ]);

    const costOf = (row: MonthlyUsage) =>
      (row.storageByteDays / days / BYTES_PER_GB) *
        period.storageMicrodollarsPerGbMonth +
      (row.requests / REQUESTS_PER_MILLION) *
        period.requestMicrodollarsPerMillion;

    // every seller and the usage lines they pay for
    const linesBySeller = new Map<string, StatementLine[]>();
    const addLine = (userId: string, line: StatementLine) =>
      linesBySeller.set(userId, [...(linesBySeller.get(userId) ?? []), line]);

    const artistIds = new Set(allShares.map((share) => share.artistId));
    for (const artistId of artistIds) {
      const row = usage.find((u) => u.artistId === artistId);
      if (!row && !(await this.funding.isArtistActive(artistId))) continue;

      const artist = await this.db.artists.getById(artistId);
      for (const share of allShares.filter((s) => s.artistId === artistId)) {
        addLine(share.userId, {
          artistId,
          designerUserId: null,
          name: artist?.name ?? 'Artist',
          shareBasisPoints: share.shareBasisPoints,
          storageByteDays: row?.storageByteDays ?? 0,
          requests: row?.requests ?? 0,
          amount: row
            ? toCents((costOf(row) * share.shareBasisPoints) / WHOLE_SHARE)
            : 0,
        });
      }
    }
    // a designer with a published design is a seller even in a month their
    // designs used nothing
    const designers = new Set([
      ...usage.flatMap((u) => (u.designerUserId ? [u.designerUserId] : [])),
      ...(await this.db.designs.listPublishingDesigners()),
    ]);
    for (const designerUserId of designers) {
      const row = usage.find((u) => u.designerUserId === designerUserId);
      addLine(designerUserId, {
        artistId: null,
        designerUserId,
        name: 'Designs',
        shareBasisPoints: WHOLE_SHARE,
        storageByteDays: row?.storageByteDays ?? 0,
        requests: row?.requests ?? 0,
        amount: row ? toCents(costOf(row)) : 0,
      });
    }

    // storage and delivery is what usage pays for; every other bill is shared
    const sharedCostsTotal = costs
      .filter((cost) => cost.category !== 'storage_and_delivery')
      .reduce((total, cost) => total + cost.amount, 0);
    const monthCosts = costs.reduce((total, cost) => total + cost.amount, 0);
    const sellers = [...linesBySeller.keys()];
    const sharedPerSeller =
      sellers.length > 0 ? Math.ceil(sharedCostsTotal / sellers.length) : 0;
    const usageOf = (userId: string) =>
      (linesBySeller.get(userId) ?? []).reduce(
        (total, line) => total + line.amount,
        0,
      );
    const owed = new Map(
      sellers.map((userId) => [userId, usageOf(userId) + sharedPerSeller]),
    );
    const covered = await this.coverFromReserve(month, owed, monthCosts);

    for (const userId of sellers) {
      await this.db.funding.issueStatement({
        userId,
        month,
        usageAmount: usageOf(userId),
        sharedAmount: sharedPerSeller,
        subsidyAmount: covered.get(userId) ?? 0,
        cardFeesAmount: await this.db.funding.sumCardFees(userId, start, end),
        lines: linesBySeller.get(userId) ?? [],
      });
    }

    await this.keepRoundingSurplus(
      month,
      sellers.length,
      sharedCostsTotal,
      sharedPerSeller,
    );
    const coveredTotal = sum([...covered.values()]);
    await this.db.funding.closePeriod(month, {
      sellerCount: sellers.length,
      sharedCostsTotal,
      subsidyTotal: coveredTotal,
    });

    const summary: CloseSummary = {
      sellers: sellers.length,
      sharedCostsTotal,
      sharedPerSeller,
      coveredByReserve: coveredTotal,
      autoTopUps: 0,
      lapsed: 0,
      failures: [],
    };
    for (const userId of sellers) {
      // nothing came out of their balance, so there is nothing to top up
      const paidByReserve = covered.get(userId) === owed.get(userId);
      try {
        await this.followUp(userId, month, summary, paidByReserve);
      } catch (error) {
        this.log.error(`follow-up failed for seller ${userId}`, error);
        summary.failures.push(userId);
      }
    }
    await this.warnIfCoverageEnds(month, owed, coveredTotal, monthCosts);
    return summary;
  }

  /**
   * Pay sellers' shares from what the reserve holds past its target of
   * three months of costs: all of every share when it can, otherwise the
   * same part of each. Safe to repeat for the same month.
   *
   * @returns What the reserve paid toward each seller's share, in cents.
   */
  private async coverFromReserve(
    month: string,
    owed: Map<string, number>,
    monthCosts: number,
  ): Promise<Map<string, number>> {
    // a repeated close sees the balance from before its own payment
    const paid = (await this.db.funding.sumReserveForMonth(month))
      .covered_costs;
    const balance = (await this.db.funding.getReserveBalance()) - (paid ?? 0);
    const spare = balance - RESERVE_TARGET_MONTHS * monthCosts;
    const need = sum([...owed.values()]);
    const part = need > 0 && spare > 0 ? Math.min(1, spare / need) : 0;

    const covered = new Map(
      [...owed].map(([userId, amount]) => [userId, Math.floor(amount * part)]),
    );
    const total = sum([...covered.values()]);
    if (
      total > 0 &&
      paid === undefined &&
      (await this.db.jobRuns.claim('close_coverage', month))
    ) {
      await this.db.funding.addReserveEntry('covered_costs', -total, month);
    }
    return covered;
  }

  /**
   * Once the reserve can no longer pay next month's shares, tell every
   * seller who will owe more than their balance holds, a month ahead.
   */
  private async warnIfCoverageEnds(
    month: string,
    owed: Map<string, number>,
    coveredTotal: number,
    monthCosts: number,
  ): Promise<void> {
    if (coveredTotal === 0) return;
    const spare =
      (await this.db.funding.getReserveBalance()) -
      RESERVE_TARGET_MONTHS * monthCosts;
    if (spare >= sum([...owed.values()])) return;
    if (!(await this.db.jobRuns.claim('coverage_ending', month))) return;

    const billingUrl = `${this.webAppUrl}/studio/billing`;
    for (const [userId, share] of owed) {
      if ((await this.db.funding.getBalance(userId)) >= share) continue;
      const address = await this.db.users.getEmail(userId);
      if (address) {
        await this.email.send(
          fundingEmails.coverageEnding(address, share, billingUrl),
        );
      }
    }
  }

  /** Put what rounding collected beyond the shared bills into the reserve. */
  private async keepRoundingSurplus(
    month: string,
    sellerCount: number,
    sharedCostsTotal: number,
    sharedPerSeller: number,
  ): Promise<void> {
    const surplus = sharedPerSeller * sellerCount - sharedCostsTotal;
    if (surplus > 0 && (await this.db.jobRuns.claim('close_surplus', month))) {
      await this.db.funding.addReserveEntry('surplus', surplus, month);
    }
  }

  /**
   * After a seller's statement is charged: top up automatically if they asked
   * to, warn them when the balance is low, and start the grace period when it
   * is below zero.
   */
  private async followUp(
    userId: string,
    month: string,
    summary: CloseSummary,
    paidByReserve: boolean,
  ): Promise<void> {
    let billing = await this.db.funding.getBilling(userId);
    if (!billing) {
      // a seller who sold while the reserve paid their share, and now owes
      if ((await this.db.funding.getBalance(userId)) >= 0) return;
      billing = await this.billing.setUp(userId);
    }

    const threshold = await this.alertThreshold(userId);
    let balance = await this.db.funding.getBalance(userId);

    const wantsTopUp =
      (billing.autoTopUpMode === 'monthly' && !paidByReserve) ||
      (billing.autoTopUpMode === 'below_threshold' &&
        threshold !== null &&
        balance < threshold);
    if (wantsTopUp && (await this.billing.autoTopUp(userId))) {
      summary.autoTopUps++;
      balance = await this.db.funding.getBalance(userId);
    }

    const address = await this.db.users.getEmail(userId);
    const billingUrl = `${this.webAppUrl}/studio/billing`;

    if (balance < 0) {
      await this.db.funding.markLapsed(userId);
      summary.lapsed++;
      if (
        address &&
        (await this.db.jobRuns.claim('lapse_started', `${userId}:${month}`))
      ) {
        await this.email.send(
          fundingEmails.balanceLapsed(address, balance, GRACE_DAYS, billingUrl),
        );
      }
      return;
    }

    if (
      threshold !== null &&
      balance < threshold &&
      address &&
      (await this.db.jobRuns.claim('low_balance', `${userId}:${month}`))
    ) {
      await this.email.send(
        fundingEmails.lowBalance(address, balance, billingUrl),
      );
    }
  }

  /**
   * A seller's alert threshold in cents: the amount they set, or a share of
   * their last top-up.
   */
  private async alertThreshold(userId: string): Promise<number | null> {
    const billing = await this.db.funding.getBilling(userId);
    if (billing?.alertThresholdAmount) return billing.alertThresholdAmount;
    if (!billing?.alertThresholdPercent) return null;

    const lastTopUp = await this.db.funding.getLastTopUp(userId);
    return lastTopUp
      ? Math.round((lastTopUp.amount * billing.alertThresholdPercent) / 100)
      : null;
  }

  private async requireOpenPeriod(month: string) {
    const period = await this.db.funding.getPeriod(month);
    if (!period || period.status !== 'open') {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        `${month} is not open for billing.`,
      );
    }
    return period;
  }
}

function toCents(microdollars: number): number {
  return Math.round(microdollars / MICRODOLLARS_PER_CENT);
}

const sum = (amounts: number[]) =>
  amounts.reduce((total, amount) => total + amount, 0);
