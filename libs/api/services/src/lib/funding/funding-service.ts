import { DatabaseRepository } from '@ime/db';

/**
 * Community funding: who pays for hosting, and whether they are paid up.
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
}
