import { DatabaseRepository } from '@ime/db';

/**
 * Community funding's shared checks: whether an artist's hosting is paid for,
 * and whether an artist or user counts as selling.
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
      if (!(await this.isSellerFunded(share.userId))) return false;
    }
    return true;
  }

  /**
   * Report whether a seller is paid up: a card on file, a positive balance,
   * and no lapse. A designer needs this to publish a design.
   */
  public async isSellerFunded(userId: string): Promise<boolean> {
    const billing = await this.db.funding.getBilling(userId);
    if (!billing?.stripePaymentMethodId || billing.lapsedAt) return false;
    return (await this.db.funding.getBalance(userId)) > 0;
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
}
