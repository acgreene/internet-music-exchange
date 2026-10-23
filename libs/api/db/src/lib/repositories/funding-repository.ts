import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  sql,
  sum,
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import type { Db } from '../database-service';
import {
  artistImages,
  designVersions,
  productImages,
  products,
  releaseAssets,
  releaseDesignImages,
  releases,
  trackAudioFiles,
  tracks,
  type AutoTopUpMode,
  type BalanceEntry,
  balanceEntries,
  type BillingPeriod,
  billingPeriods,
  type Contribution,
  contributions,
  type CostShare,
  type CostShareOffer,
  costShareOffers,
  costShares,
  type ContributionSource,
  artists,
  designs,
  type GivingCadence,
  type GivingDestination,
  type MonthlyUsage,
  monthlyUsage,
  type PlatformCost,
  type PlatformCostCategory,
  platformCosts,
  type ReserveEntryKind,
  reserveEntries,
  type SellerBilling,
  sellerBilling,
  type Statement,
  type StatementLine,
  statements,
} from '../tables';

/**
 * Whose usage a row counts: one artist, or one designer's designs.
 */
export type UsageOwner = { artistId: string } | { designerUserId: string };

export interface BillingSettings {
  alertThresholdAmount?: number | null;
  alertThresholdPercent?: number | null;
  autoTopUpMode?: AutoTopUpMode;
  autoTopUpAmount?: number | null;
  autoTopUpExtraAmount?: number;
  autoTopUpExtraDestination?: GivingDestination | null;
}

export interface RecordTopUpParams {
  userId: string;
  amount: number;
  /** Null while Stripe has not worked out the fee yet. */
  cardFee: number | null;
  stripePaymentIntentId: string;
}

export interface ProposedShare {
  userId: string;
  shareBasisPoints: number;
}

export interface OpenPeriodParams {
  month: string;
  storageMicrodollarsPerGbMonth: number;
  requestMicrodollarsPerMillion: number;
}

export interface ClosePeriodParams {
  sellerCount: number;
  sharedCostsTotal: number;
  subsidyTotal: number;
}

export interface IssueStatementParams {
  userId: string;
  month: string;
  usageAmount: number;
  sharedAmount: number;
  subsidyAmount: number;
  cardFeesAmount: number;
  lines: StatementLine[];
}

export interface RecordContributionParams {
  userId?: string | null;
  /** The name to thank them by publicly, or null to leave them off. */
  thanksName?: string | null;
  destination: GivingDestination;
  cadence: GivingCadence;
  source: ContributionSource;
  amount: number;
  stripePaymentIntentId: string;
  stripeSubscriptionId?: string | null;
}

/**
 * What acting on a cost share offer led to.
 * `accepted` - recorded; others still have to accept.
 * `applied` - everyone has accepted, and the offer is now the artist's split.
 */
export type OfferAcceptance = 'accepted' | 'applied';

/** A full split, in hundredths of a percent. */
export const WHOLE_SHARE = 10000;

const DEFAULT_ENTRY_LIMIT = 50;

/**
 * Queries for community funding: sellers' prepaid balances and settings, how
 * artists' costs are split, usage, monthly periods and statements, gifts, and
 * the reserve. All amounts are USD cents.
 */
export class FundingRepository {
  constructor(private readonly db: Db) {}

  /**
   * Read a seller's billing settings.
   *
   * @param userId - The id of the seller.
   * @returns Their settings, or null when they have never set up billing.
   */
  public async getBilling(userId: string): Promise<SellerBilling | null> {
    const [billing] = await this.db
      .select()
      .from(sellerBilling)
      .where(eq(sellerBilling.userId, userId))
      .limit(1);

    return billing ?? null;
  }

  /**
   * Set a user up to pay hosting costs, once their Stripe customer exists.
   * Doing it again keeps the existing row.
   *
   * @param userId - The id of the seller.
   * @param stripeCustomerId - Their customer on the platform's Stripe account.
   * @returns Their billing row.
   */
  public async createBilling(
    userId: string,
    stripeCustomerId: string,
  ): Promise<SellerBilling> {
    await this.db
      .insert(sellerBilling)
      .values({ userId, stripeCustomerId })
      .onConflictDoNothing();

    return (await this.getBilling(userId)) as SellerBilling;
  }

  /**
   * Record the card a seller pays with, or clear it.
   *
   * @param userId - The id of the seller.
   * @param stripePaymentMethodId - The card, or null to remove it.
   */
  public async setPaymentMethod(
    userId: string,
    stripePaymentMethodId: string | null,
  ): Promise<void> {
    await this.db
      .update(sellerBilling)
      .set({ stripePaymentMethodId, updatedAt: new Date() })
      .where(eq(sellerBilling.userId, userId));
  }

  /**
   * Change a seller's alert threshold and auto top-up settings.
   *
   * @param userId - The id of the seller.
   * @param settings - The fields to change; omitted fields are left as they are.
   */
  public async updateSettings(
    userId: string,
    settings: BillingSettings,
  ): Promise<void> {
    await this.db
      .update(sellerBilling)
      .set({ ...settings, updatedAt: new Date() })
      .where(eq(sellerBilling.userId, userId));
  }

  /**
   * Start a seller's grace period, unless it has already started.
   *
   * @param userId - The id of the seller.
   */
  public async markLapsed(userId: string): Promise<void> {
    await this.db
      .update(sellerBilling)
      .set({ lapsedAt: new Date(), updatedAt: new Date() })
      .where(
        and(eq(sellerBilling.userId, userId), isNull(sellerBilling.lapsedAt)),
      );
  }

  /**
   * End a seller's lapse once they are paid up.
   *
   * @param userId - The id of the seller.
   */
  public async clearLapse(userId: string): Promise<void> {
    await this.db
      .update(sellerBilling)
      .set({ lapsedAt: null, updatedAt: new Date() })
      .where(eq(sellerBilling.userId, userId));
  }

  /**
   * List sellers who lapsed at or before a moment, as when finding everyone
   * whose grace period is over.
   *
   * @param cutoff - The latest lapse to include.
   * @returns Their billing rows, longest lapsed first.
   */
  public async listLapsedSince(cutoff: Date): Promise<SellerBilling[]> {
    return this.db
      .select()
      .from(sellerBilling)
      .where(
        and(
          isNotNull(sellerBilling.lapsedAt),
          lte(sellerBilling.lapsedAt, cutoff),
        ),
      )
      .orderBy(asc(sellerBilling.lapsedAt));
  }

  /**
   * Read a seller's prepaid balance.
   *
   * @param userId - The id of the seller.
   * @returns The sum of their balance entries; zero when they have none.
   */
  public async getBalance(userId: string): Promise<number> {
    const [balance] = await this.db
      .select({ value: sum(balanceEntries.amount).mapWith(Number) })
      .from(balanceEntries)
      .where(eq(balanceEntries.userId, userId));

    return balance?.value ?? 0;
  }

  /**
   * Record a top-up once its payment settles. Safe to repeat for the same
   * payment, as when a webhook is delivered twice.
   *
   * @param params - The seller, the amount added, the card fee, and the payment.
   * @returns The new entry, or null when that payment was already recorded.
   */
  public async recordTopUp(
    params: RecordTopUpParams,
  ): Promise<BalanceEntry | null> {
    const [entry] = await this.db
      .insert(balanceEntries)
      .values({ ...params, kind: 'top_up' })
      .onConflictDoNothing()
      .returning();

    return entry ?? null;
  }

  /**
   * Fill in the card fee of a top-up once Stripe has worked it out. A fee
   * already on file is left alone.
   *
   * @param stripePaymentIntentId - The top-up's payment.
   * @param cardFee - What the card processor kept, in cents.
   */
  public async setTopUpCardFee(
    stripePaymentIntentId: string,
    cardFee: number,
  ): Promise<void> {
    await this.db
      .update(balanceEntries)
      .set({ cardFee })
      .where(
        and(
          eq(balanceEntries.stripePaymentIntentId, stripePaymentIntentId),
          eq(balanceEntries.kind, 'top_up'),
          isNull(balanceEntries.cardFee),
        ),
      );
  }

  /**
   * Read a seller's most recent top-up, for a percentage alert threshold.
   *
   * @param userId - The id of the seller.
   * @returns Their last top-up, or null when they have none.
   */
  public async getLastTopUp(userId: string): Promise<BalanceEntry | null> {
    const [entry] = await this.db
      .select()
      .from(balanceEntries)
      .where(
        and(
          eq(balanceEntries.userId, userId),
          eq(balanceEntries.kind, 'top_up'),
        ),
      )
      .orderBy(desc(balanceEntries.createdAt))
      .limit(1);

    return entry ?? null;
  }

  /**
   * Hand surplus back to a seller once the reserve is full.
   *
   * @param userId - The id of the seller.
   * @param amount - The credit, in cents.
   * @param note - What it was for.
   */
  public async recordCredit(
    userId: string,
    amount: number,
    note?: string,
  ): Promise<BalanceEntry> {
    const [entry] = await this.db
      .insert(balanceEntries)
      .values({ userId, kind: 'credit', amount, note })
      .returning();

    return entry;
  }

  /**
   * Record unused balance refunded to a seller's card.
   *
   * @param userId - The id of the seller.
   * @param amount - How much was refunded, in cents.
   * @param stripeRefundId - The refund.
   */
  public async recordWithdrawal(
    userId: string,
    amount: number,
    stripeRefundId: string,
  ): Promise<BalanceEntry> {
    const [entry] = await this.db
      .insert(balanceEntries)
      .values({ userId, kind: 'withdrawal', amount: -amount, stripeRefundId })
      .returning();

    return entry;
  }

  /**
   * Record an admin's correction to a seller's balance.
   *
   * @param userId - The id of the seller.
   * @param amount - The signed change, in cents.
   * @param note - Why the correction was made.
   */
  public async recordAdjustment(
    userId: string,
    amount: number,
    note: string,
  ): Promise<BalanceEntry> {
    const [entry] = await this.db
      .insert(balanceEntries)
      .values({ userId, kind: 'adjustment', amount, note })
      .returning();

    return entry;
  }

  /**
   * List a seller's balance history.
   *
   * @param userId - The id of the seller.
   * @param limit - The maximum number of entries to return.
   * @returns Their entries, newest first.
   */
  public async listBalanceEntries(
    userId: string,
    limit: number = DEFAULT_ENTRY_LIMIT,
  ): Promise<BalanceEntry[]> {
    return this.db
      .select()
      .from(balanceEntries)
      .where(eq(balanceEntries.userId, userId))
      .orderBy(desc(balanceEntries.createdAt))
      .limit(limit);
  }

  /**
   * Read how an artist's costs are split.
   *
   * @param artistId - The id of the artist.
   * @returns Each paying manager's share.
   */
  public async listCostShares(artistId: string): Promise<CostShare[]> {
    return this.db
      .select()
      .from(costShares)
      .where(eq(costShares.artistId, artistId));
  }

  /**
   * List the artists a seller pays toward.
   *
   * @param userId - The id of the seller.
   * @returns Their share of each artist.
   */
  public async listSharesPaidBy(userId: string): Promise<CostShare[]> {
    return this.db
      .select()
      .from(costShares)
      .where(eq(costShares.userId, userId));
  }

  /**
   * Propose a new split of an artist's costs, replacing any earlier proposal.
   * The proposer's own share counts as accepted.
   *
   * @param artistId - The id of the artist.
   * @param offeredByUserId - The manager proposing it.
   * @param shares - The new split, which must add up to the whole.
   * @throws Error when the shares do not add up to the whole.
   */
  public async proposeSplit(
    artistId: string,
    offeredByUserId: string,
    shares: ProposedShare[],
  ): Promise<void> {
    const total = shares.reduce(
      (sum, share) => sum + share.shareBasisPoints,
      0,
    );
    if (total !== WHOLE_SHARE) {
      throw new Error(`A split must add up to ${WHOLE_SHARE}, not ${total}.`);
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(costShareOffers)
        .where(eq(costShareOffers.artistId, artistId));
      await tx.insert(costShareOffers).values(
        shares.map((share) => ({
          artistId,
          ...share,
          offeredByUserId,
          acceptedAt: share.userId === offeredByUserId ? new Date() : null,
        })),
      );
    });
  }

  /**
   * Read an artist's pending split proposal.
   *
   * @param artistId - The id of the artist.
   * @returns The proposed shares, empty when there is no proposal.
   */
  public async listOffers(artistId: string): Promise<CostShareOffer[]> {
    return this.db
      .select()
      .from(costShareOffers)
      .where(eq(costShareOffers.artistId, artistId));
  }

  /**
   * Accept a share offered to a manager. When every offered share has been
   * accepted, the proposal becomes the artist's split.
   *
   * @param artistId - The id of the artist.
   * @param userId - The manager accepting.
   * @returns Whether the offer was only accepted or the split was applied, or
   * null when there is no offer for that manager.
   */
  public async acceptOffer(
    artistId: string,
    userId: string,
  ): Promise<OfferAcceptance | null> {
    return this.db.transaction(async (tx) => {
      // locking the artist keeps two last acceptances from both applying
      await tx
        .select({ id: artists.id })
        .from(artists)
        .where(eq(artists.id, artistId))
        .for('update');

      const [accepted] = await tx
        .update(costShareOffers)
        .set({ acceptedAt: new Date() })
        .where(
          and(
            eq(costShareOffers.artistId, artistId),
            eq(costShareOffers.userId, userId),
          ),
        )
        .returning();

      if (!accepted) return null;

      const offers = await tx
        .select()
        .from(costShareOffers)
        .where(eq(costShareOffers.artistId, artistId));

      if (offers.some((offer) => offer.acceptedAt === null)) return 'accepted';

      await tx.delete(costShares).where(eq(costShares.artistId, artistId));
      await tx.insert(costShares).values(
        offers.map((offer) => ({
          artistId,
          userId: offer.userId,
          shareBasisPoints: offer.shareBasisPoints,
        })),
      );
      await tx
        .delete(costShareOffers)
        .where(eq(costShareOffers.artistId, artistId));

      return 'applied';
    });
  }

  /**
   * Drop an artist's pending split proposal.
   *
   * @param artistId - The id of the artist.
   */
  public async withdrawOffers(artistId: string): Promise<void> {
    await this.db
      .delete(costShareOffers)
      .where(eq(costShareOffers.artistId, artistId));
  }

  /**
   * Add a day's stored bytes to an owner's usage for the month.
   *
   * @param month - The first day of the month.
   * @param owner - The artist or designer.
   * @param bytes - What they had stored that day.
   */
  public async addStoredBytes(
    month: string,
    owner: UsageOwner,
    bytes: number,
  ): Promise<void> {
    await this.db
      .insert(monthlyUsage)
      .values({ month, ...owner, storageByteDays: bytes })
      .onConflictDoUpdate({
        target: [
          monthlyUsage.month,
          monthlyUsage.artistId,
          monthlyUsage.designerUserId,
        ],
        set: {
          storageByteDays: sql`${monthlyUsage.storageByteDays} + ${bytes}`,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Count files served for an owner this month.
   *
   * @param month - The first day of the month.
   * @param owner - The artist or designer whose files were served.
   * @param requests - How many were served.
   */
  public async addRequests(
    month: string,
    owner: UsageOwner,
    requests = 1,
  ): Promise<void> {
    await this.db
      .insert(monthlyUsage)
      .values({ month, ...owner, requests })
      .onConflictDoUpdate({
        target: [
          monthlyUsage.month,
          monthlyUsage.artistId,
          monthlyUsage.designerUserId,
        ],
        set: {
          requests: sql`${monthlyUsage.requests} + ${requests}`,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Read every owner's usage for a month.
   *
   * @param month - The first day of the month.
   * @returns One row per artist or designer with usage that month.
   */
  public async listUsage(month: string): Promise<MonthlyUsage[]> {
    return this.db
      .select()
      .from(monthlyUsage)
      .where(eq(monthlyUsage.month, month));
  }

  /**
   * Open a month for billing at the provider's current rates. Opening it again
   * changes nothing.
   *
   * @param params - The month and its rates.
   */
  public async openPeriod(params: OpenPeriodParams): Promise<void> {
    await this.db.insert(billingPeriods).values(params).onConflictDoNothing();
  }

  /**
   * Read a billing month.
   *
   * @param month - The first day of the month.
   * @returns The period, or null when it was never opened.
   */
  public async getPeriod(month: string): Promise<BillingPeriod | null> {
    const [period] = await this.db
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.month, month))
      .limit(1);

    return period ?? null;
  }

  /**
   * List closed months for the public costs page.
   *
   * @param limit - The maximum number of months to return.
   * @returns Closed periods, newest first.
   */
  public async listClosedPeriods(limit = 12): Promise<BillingPeriod[]> {
    return this.db
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.status, 'closed'))
      .orderBy(desc(billingPeriods.month))
      .limit(limit);
  }

  /**
   * Record a bill the platform paid in a month.
   *
   * @param month - The first day of the month.
   * @param category - The group it is shown under.
   * @param description - What the bill was for.
   * @param amount - What it cost, in cents.
   */
  public async addPlatformCost(
    month: string,
    category: PlatformCostCategory,
    description: string,
    amount: number,
  ): Promise<PlatformCost> {
    const [cost] = await this.db
      .insert(platformCosts)
      .values({ month, category, description, amount })
      .returning();

    return cost;
  }

  /**
   * List a month's bills.
   *
   * @param month - The first day of the month.
   * @returns The month's bills, grouped by category.
   */
  public async listPlatformCosts(month: string): Promise<PlatformCost[]> {
    return this.db
      .select()
      .from(platformCosts)
      .where(eq(platformCosts.month, month))
      .orderBy(asc(platformCosts.category));
  }

  /**
   * Close a month once its statements are out.
   *
   * @param month - The first day of the month.
   * @param params - How many sellers shared the costs, the shared total, and
   * the creators' subsidy.
   * @returns True when the period was closed, false when it was not open.
   */
  public async closePeriod(
    month: string,
    params: ClosePeriodParams,
  ): Promise<boolean> {
    const closed = await this.db
      .update(billingPeriods)
      .set({ ...params, status: 'closed', closedAt: new Date() })
      .where(
        and(eq(billingPeriods.month, month), eq(billingPeriods.status, 'open')),
      )
      .returning({ month: billingPeriods.month });

    return closed.length > 0;
  }

  /**
   * Issue a seller's statement for a month and deduct it from their balance,
   * together, so neither happens without the other.
   *
   * @param params - The seller, the month, the amounts, and the lines behind
   * them.
   * @returns The statement, or null when the seller already has one for that
   * month.
   */
  public async issueStatement(
    params: IssueStatementParams,
  ): Promise<Statement | null> {
    const totalAmount =
      params.usageAmount +
      params.sharedAmount -
      params.subsidyAmount +
      params.cardFeesAmount;

    return this.db.transaction(async (tx) => {
      const [statement] = await tx
        .insert(statements)
        .values({ ...params, totalAmount })
        .onConflictDoNothing()
        .returning();

      if (!statement) return null;

      await tx.insert(balanceEntries).values({
        userId: params.userId,
        kind: 'monthly_charge',
        amount: -totalAmount,
        statementId: statement.id,
      });

      return statement;
    });
  }

  /**
   * List a seller's statements.
   *
   * @param userId - The id of the seller.
   * @returns Their statements, newest month first.
   */
  public async listStatements(userId: string): Promise<Statement[]> {
    return this.db
      .select()
      .from(statements)
      .where(eq(statements.userId, userId))
      .orderBy(desc(statements.month));
  }

  /**
   * Record a gift once its payment settles. A gift to the platform goes into
   * the reserve in the same step. Safe to repeat for the same payment.
   *
   * @param params - The giver, where it goes, how often, where it came from,
   * the amount, and the payment.
   * @returns The new contribution, or null when that payment was already
   * recorded.
   */
  public async recordContribution(
    params: RecordContributionParams,
  ): Promise<Contribution | null> {
    return this.db.transaction(async (tx) => {
      const [contribution] = await tx
        .insert(contributions)
        .values(params)
        .onConflictDoNothing()
        .returning();

      if (!contribution) return null;

      if (contribution.destination === 'platform') {
        await tx.insert(reserveEntries).values({
          kind: 'donation',
          amount: contribution.amount,
          contributionId: contribution.id,
        });
      }

      return contribution;
    });
  }

  /**
   * The names donors asked to be thanked by for gifts in a span of time,
   * each once, alphabetically. Amounts and destinations stay private.
   *
   * @param from - The start, inclusive.
   * @param to - The end, exclusive.
   */
  public async listThanksNames(from: Date, to: Date): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ name: contributions.thanksName })
      .from(contributions)
      .where(
        and(
          isNotNull(contributions.thanksName),
          gte(contributions.createdAt, from),
          lt(contributions.createdAt, to),
        ),
      );
    return rows
      .map((row) => row.name as string)
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * Total what was given to one destination in a span of time.
   *
   * @param destination - The platform or the developers.
   * @param from - The start, inclusive.
   * @param to - The end, exclusive.
   * @returns The total, in cents.
   */
  public async sumContributions(
    destination: GivingDestination,
    from: Date,
    to: Date,
  ): Promise<number> {
    const [total] = await this.db
      .select({ value: sum(contributions.amount).mapWith(Number) })
      .from(contributions)
      .where(
        and(
          eq(contributions.destination, destination),
          gte(contributions.createdAt, from),
          lt(contributions.createdAt, to),
        ),
      );

    return total?.value ?? 0;
  }

  /**
   * Read the reserve's balance.
   *
   * @returns The sum of every reserve entry, in cents.
   */
  public async getReserveBalance(): Promise<number> {
    const [balance] = await this.db
      .select({ value: sum(reserveEntries.amount).mapWith(Number) })
      .from(reserveEntries);

    return balance?.value ?? 0;
  }

  /**
   * What moved through the reserve for one billing month, by kind. Donations
   * are dated rather than tied to a month, so they are not counted here.
   *
   * @param month - The first day of the month.
   * @returns Each kind's signed total, in cents.
   */
  public async sumReserveForMonth(
    month: string,
  ): Promise<Partial<Record<ReserveEntryKind, number>>> {
    const rows = await this.db
      .select({
        kind: reserveEntries.kind,
        total: sum(reserveEntries.amount).mapWith(Number),
      })
      .from(reserveEntries)
      .where(eq(reserveEntries.month, month))
      .groupBy(reserveEntries.kind);
    return Object.fromEntries(rows.map((row) => [row.kind, row.total]));
  }

  /**
   * Move money into or out of the reserve for a billing month. Donations are
   * recorded through `recordContribution` instead.
   *
   * @param kind - Surplus in, or money spent on costs or credited to sellers.
   * @param amount - The signed amount, in cents.
   * @param month - The first day of the month it belongs to.
   * @param note - Optional detail.
   */
  public async addReserveEntry(
    kind: Exclude<ReserveEntryKind, 'donation'>,
    amount: number,
    month: string,
    note?: string,
  ): Promise<void> {
    await this.db.insert(reserveEntries).values({ kind, amount, month, note });
  }

  /**
   * Take artists off sale, as when the seller paying for them lapses.
   *
   * @param artistIds - The artists.
   */
  public async takeArtistsOffSale(artistIds: string[]): Promise<void> {
    if (artistIds.length === 0) return;

    await this.db
      .update(artists)
      .set({ offSaleAt: new Date() })
      .where(and(inArray(artists.id, artistIds), isNull(artists.offSaleAt)));
  }

  /**
   * Put artists back on sale once their costs are paid.
   *
   * @param artistIds - The artists.
   */
  public async putArtistsOnSale(artistIds: string[]): Promise<void> {
    if (artistIds.length === 0) return;

    await this.db
      .update(artists)
      .set({ offSaleAt: null })
      .where(inArray(artists.id, artistIds));
  }

  /**
   * Take every design a designer has made off sale.
   *
   * @param designerUserId - The id of the designer.
   */
  public async takeDesignsOffSale(designerUserId: string): Promise<void> {
    await this.db
      .update(designs)
      .set({ offSaleAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(designs.designerUserId, designerUserId),
          isNull(designs.offSaleAt),
        ),
      );
  }

  /**
   * Put a designer's designs back on sale.
   *
   * @param designerUserId - The id of the designer.
   */
  public async putDesignsOnSale(designerUserId: string): Promise<void> {
    await this.db
      .update(designs)
      .set({ offSaleAt: null, updatedAt: new Date() })
      .where(eq(designs.designerUserId, designerUserId));
  }

  /**
   * List artists that have been off sale since at or before a moment, as when
   * finding files nobody owns that are due for deletion.
   *
   * @param cutoff - The latest time they came off sale.
   * @returns Their ids, longest off sale first.
   */
  public async listArtistsOffSaleSince(cutoff: Date): Promise<string[]> {
    const rows = await this.db
      .select({ id: artists.id })
      .from(artists)
      .where(and(isNotNull(artists.offSaleAt), lte(artists.offSaleAt, cutoff)))
      .orderBy(asc(artists.offSaleAt));

    return rows.map((row) => row.id);
  }

  /**
   * Total the bytes each artist stores right now: audio, release assets and
   * design images, merch photos, and profile images.
   *
   * @returns One entry per artist storing anything.
   */
  public async listStoredBytesByArtist(): Promise<StoredBytes[]> {
    const byArtist = (owner: PgColumn, byteSize: PgColumn) => ({
      owner: sql<string>`${owner}`,
      bytes: sum(byteSize).mapWith(Number),
    });

    const totals = await Promise.all([
      this.db
        .select(byArtist(tracks.artistId, trackAudioFiles.byteSize))
        .from(trackAudioFiles)
        .innerJoin(tracks, eq(tracks.id, trackAudioFiles.trackId))
        .groupBy(tracks.artistId),
      this.db
        .select(byArtist(releases.artistId, releaseAssets.byteSize))
        .from(releaseAssets)
        .innerJoin(releases, eq(releases.id, releaseAssets.releaseId))
        .groupBy(releases.artistId),
      this.db
        .select(byArtist(releases.artistId, releaseDesignImages.byteSize))
        .from(releaseDesignImages)
        .innerJoin(releases, eq(releases.id, releaseDesignImages.releaseId))
        .groupBy(releases.artistId),
      this.db
        .select(byArtist(products.artistId, productImages.byteSize))
        .from(productImages)
        .innerJoin(products, eq(products.id, productImages.productId))
        .groupBy(products.artistId),
      this.db
        .select(byArtist(artistImages.artistId, artistImages.byteSize))
        .from(artistImages)
        .groupBy(artistImages.artistId),
    ]);

    return addUp(totals.flat());
  }

  /**
   * Total the bytes of each designer's design versions.
   *
   * @returns One entry per designer storing anything.
   */
  public async listStoredBytesByDesigner(): Promise<StoredBytes[]> {
    const totals = await this.db
      .select({
        owner: designs.designerUserId,
        bytes: sum(designVersions.byteSize).mapWith(Number),
      })
      .from(designVersions)
      .innerJoin(designs, eq(designs.id, designVersions.designId))
      .where(isNotNull(designs.designerUserId))
      .groupBy(designs.designerUserId);

    return addUp(totals as { owner: string; bytes: number }[]);
  }

  /**
   * Total the card fees on a seller's top-ups in a span of time.
   *
   * @param userId - The id of the seller.
   * @param from - The start, inclusive.
   * @param to - The end, exclusive.
   * @returns The total, in cents. Fees Stripe has not reported yet count as
   * zero.
   */
  public async sumCardFees(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const [total] = await this.db
      .select({ value: sum(balanceEntries.cardFee).mapWith(Number) })
      .from(balanceEntries)
      .where(
        and(
          eq(balanceEntries.userId, userId),
          eq(balanceEntries.kind, 'top_up'),
          gte(balanceEntries.createdAt, from),
          lt(balanceEntries.createdAt, to),
        ),
      );

    return total?.value ?? 0;
  }

  /**
   * List every seller's statement for a month, for the public costs page.
   *
   * @param month - The first day of the month.
   */
  public async listStatementsForMonth(month: string): Promise<Statement[]> {
    return this.db.select().from(statements).where(eq(statements.month, month));
  }

  /**
   * List every artist's cost split, for the monthly close.
   */
  public async listAllCostShares(): Promise<CostShare[]> {
    return this.db.select().from(costShares);
  }
}

/**
 * The bytes one owner stores, as an artist id or a designer's user id.
 */
export interface StoredBytes {
  owner: string;
  bytes: number;
}

function addUp(rows: StoredBytes[]): StoredBytes[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.owner, (totals.get(row.owner) ?? 0) + (row.bytes ?? 0));
  }
  return [...totals].map(([owner, bytes]) => ({ owner, bytes }));
}
