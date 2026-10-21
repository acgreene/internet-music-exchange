import {
  type BillingPeriod,
  DatabaseRepository,
  type PlatformCostCategory,
} from '@ime/db';

/**
 * One closed month on the public costs page.
 */
export interface PublicCostMonth {
  month: string;
  costsByCategory: Partial<Record<PlatformCostCategory, number>>;
  totalCosts: number;
  sellerCount: number;
  medianShare: number;
  subsidy: number;
  platformDonations: number;
}

/**
 * Community funding: who pays for hosting, whether they are paid up, and what
 * the platform costs, in the open.
 */
export class FundingService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
  ) {}

  /**
   * Report whether an artist's hosting is covered: everyone paying a share of
   * its costs has a card on file, a positive balance, and has not lapsed.
   * Nothing goes on sale until this is true.
   */
  public async isArtistFunded(artistId: string): Promise<boolean> {
    const shares = await this.db.funding.listCostShares(artistId);
    if (shares.length === 0) return false;

    for (const share of shares) {
      const billing = await this.db.funding.getBilling(share.userId);
      if (!billing?.stripePaymentMethodId || billing.lapsedAt) return false;
      if ((await this.db.funding.getBalance(share.userId)) <= 0) return false;
    }

    return true;
  }

  /**
   * Report whether an artist is active for funding: it has a release or
   * product published for sale.
   */
  public async isArtistActive(artistId: string): Promise<boolean> {
    const [releases, products] = await Promise.all([
      this.db.releases.listPublishedByArtist(artistId),
      this.db.products.listPublishedByArtist(artistId),
    ]);
    return releases.length > 0 || products.length > 0;
  }

  /**
   * Report whether a user is a seller: they pay a share of an active artist,
   * or have a design published.
   */
  public async isSellerActive(userId: string): Promise<boolean> {
    const designs = await this.db.designs.listByDesigner(userId);
    if (designs.some((design) => design.status === 'published')) return true;

    for (const share of await this.db.funding.listSharesPaidBy(userId)) {
      if (await this.isArtistActive(share.artistId)) return true;
    }
    return false;
  }

  /**
   * The public costs page: what each recent month cost, how it was shared,
   * and the reserve. Gifts to the developers are private and never shown.
   *
   * @param months - How many recent closed months to show.
   */
  public async getPublicCosts(months = 12): Promise<{
    months: PublicCostMonth[];
    reserveBalance: number;
  }> {
    const periods = await this.db.funding.listClosedPeriods(months);
    return {
      months: await Promise.all(
        periods.map((period) => this.costMonth(period)),
      ),
      reserveBalance: await this.db.funding.getReserveBalance(),
    };
  }

  private async costMonth(period: BillingPeriod): Promise<PublicCostMonth> {
    const { start, end } = monthSpan(period.month);

    const [costs, statements, platformDonations] = await Promise.all([
      this.db.funding.listPlatformCosts(period.month),
      this.db.funding.listStatementsForMonth(period.month),
      this.db.funding.sumContributions('platform', start, end),
    ]);

    const costsByCategory: PublicCostMonth['costsByCategory'] = {};
    for (const cost of costs) {
      costsByCategory[cost.category] =
        (costsByCategory[cost.category] ?? 0) + cost.amount;
    }

    return {
      month: period.month,
      costsByCategory,
      totalCosts: costs.reduce((total, cost) => total + cost.amount, 0),
      sellerCount: period.sellerCount ?? 0,
      medianShare: median(statements.map((statement) => statement.totalAmount)),
      subsidy: period.subsidyTotal ?? 0,
      platformDonations,
    };
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/**
 * When a billing month starts and ends, and how many days it has.
 *
 * @param month - The first day of the month, `YYYY-MM-01`.
 */
export function monthSpan(month: string): {
  start: Date;
  end: Date;
  days: number;
} {
  const start = new Date(`${month}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return {
    start,
    end,
    days: Math.round((end.getTime() - start.getTime()) / 86_400_000),
  };
}
