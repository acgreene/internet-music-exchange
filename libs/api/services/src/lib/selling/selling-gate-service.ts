import { type Currency, DatabaseRepository } from '@ime/db';
import { FundingService } from '../funding/funding-service';

/**
 * What an artist needs before anything goes on sale: funded hosting, and for
 * anything paid, a payment account that can take charges in the item's
 * currency. Checked when publishing and again at checkout, since either can
 * change in between.
 */
export class SellingGateService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly funding: FundingService = new FundingService(db),
  ) {}

  /**
   * List what still stands in the way, in words for the artist's managers.
   *
   * @param currency - What the item is priced in, or null when it is free.
   * @returns Empty when the artist can sell it.
   */
  public async missingToSell(
    artistId: string,
    currency: Currency | null,
  ): Promise<string[]> {
    const missing: string[] = [];

    if (currency !== null) {
      const account = await this.db.payments.getAccountByArtistId(artistId);
      if (!account?.chargesEnabled) {
        missing.push('finish setting up your payment account');
      } else if (account.defaultCurrency !== currency) {
        missing.push('set prices again in your selling currency');
      }
    }

    if (!(await this.funding.isArtistFunded(artistId))) {
      missing.push("top up the artist's hosting balance");
    }

    return missing;
  }

  /**
   * Report whether an artist can sell an item right now.
   *
   * @param currency - What the item is priced in, or null when it is free.
   */
  public async canSell(
    artistId: string,
    currency: Currency | null,
  ): Promise<boolean> {
    return (await this.missingToSell(artistId, currency)).length === 0;
  }
}
