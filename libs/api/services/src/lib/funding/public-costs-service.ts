import {
  type BillingPeriod,
  DatabaseRepository,
  type PlatformCostCategory,
} from '@ime/db';
import { monthSpan } from './month-span';

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

export interface PublicCosts {
  months: PublicCostMonth[];
  reserveBalance: number;
}

/**
 * The public costs page: what running IME costs each month, how it was
 * shared between sellers, and the reserve, in the open.
 */
export class PublicCostsService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
  ) {}

  /**
   * What each recent closed month cost and how it was shared, and the
   * reserve. Gifts to the developers are private and never shown.
   *
   * @param months - How many recent closed months to show.
   */
  public async getPublicCosts(months = 12): Promise<PublicCosts> {
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
