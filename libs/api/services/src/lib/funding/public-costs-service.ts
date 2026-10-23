import {
  type BillingPeriod,
  DatabaseRepository,
  type PlatformCostCategory,
} from '@ime/db';
import { MIN_TOP_UP } from './billing-service';
import { monthSpan } from './month-span';
import { RESERVE_TARGET_MONTHS } from './monthly-close-service';

/**
 * One closed month on the public costs page: what it cost, and who paid.
 */
export interface PublicCostMonth {
  month: string;
  costsByCategory: Partial<Record<PlatformCostCategory, number>>;
  totalCosts: number;
  sellerCount: number;
  /** What every seller paid toward the shared bills, the same for all. */
  sharedShare: number;
  /** The middle seller's whole share, before card fees. */
  medianShare: number;
  /** Every seller's shares together, before card fees. */
  sellersPaid: number;
  /** Taken from the reserve to steady shares. */
  coveredFromReserve: number;
  /** Given back to sellers once the reserve was full. */
  creditedToSellers: number;
  platformDonations: number;
}

export interface PublicCosts {
  months: PublicCostMonth[];
  reserveBalance: number;
  /** The reserve is full at this, three months of shared bills. */
  reserveTarget: number;
  /** Who asked to be thanked by name for gifts this month. */
  thanks: { month: string; names: string[] };
  /** The smallest top-up a seller can make. */
  minimumTopUp: number;
  /** The provider's current rates, which a seller's own usage is billed at. */
  rates: {
    storageMicrodollarsPerGbMonth: number;
    requestMicrodollarsPerMillion: number;
  } | null;
}

/**
 * The public costs page: what running IME costs each month, who paid for
 * it, and the reserve, in the open.
 */
export class PublicCostsService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
  ) {}

  /**
   * What each recent closed month cost and who paid, the reserve, and what
   * a seller's share is made of. Gifts to the developers are private and
   * never shown.
   *
   * @param months - How many recent closed months to show.
   */
  public async getPublicCosts(months = 12): Promise<PublicCosts> {
    const periods = await this.db.funding.listClosedPeriods(months);
    const latest = periods[0];
    const now = new Date();
    const thisMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    return {
      months: await Promise.all(
        periods.map((period) => this.costMonth(period)),
      ),
      reserveBalance: await this.db.funding.getReserveBalance(),
      reserveTarget: RESERVE_TARGET_MONTHS * (latest?.sharedCostsTotal ?? 0),
      thanks: {
        month: thisMonth.toISOString().slice(0, 10),
        names: await this.db.funding.listThanksNames(thisMonth, now),
      },
      minimumTopUp: MIN_TOP_UP,
      rates: latest
        ? {
            storageMicrodollarsPerGbMonth: latest.storageMicrodollarsPerGbMonth,
            requestMicrodollarsPerMillion: latest.requestMicrodollarsPerMillion,
          }
        : null,
    };
  }

  private async costMonth(period: BillingPeriod): Promise<PublicCostMonth> {
    const { start, end } = monthSpan(period.month);

    const [costs, statements, platformDonations, reserve] = await Promise.all([
      this.db.funding.listPlatformCosts(period.month),
      this.db.funding.listStatementsForMonth(period.month),
      this.db.funding.sumContributions('platform', start, end),
      this.db.funding.sumReserveForMonth(period.month),
    ]);

    const costsByCategory: PublicCostMonth['costsByCategory'] = {};
    for (const cost of costs) {
      costsByCategory[cost.category] =
        (costsByCategory[cost.category] ?? 0) + cost.amount;
    }
    // card fees go to the card network, not to IME's bills
    const shares = statements.map(
      (statement) => statement.usageAmount + statement.sharedAmount,
    );

    return {
      month: period.month,
      costsByCategory,
      totalCosts: costs.reduce((total, cost) => total + cost.amount, 0),
      sellerCount: period.sellerCount ?? 0,
      sharedShare: statements[0] ? statements[0].sharedAmount : 0,
      medianShare: median(shares),
      sellersPaid: shares.reduce((total, share) => total + share, 0),
      coveredFromReserve: -(reserve.covered_costs ?? 0),
      creditedToSellers: -(reserve.credited_to_sellers ?? 0),
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
