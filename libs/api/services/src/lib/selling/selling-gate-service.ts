import { type Currency, DatabaseRepository } from '@ime/db';
import { FundingService } from '../funding/funding-service';

/**
 * Who sells something: an artist, or a designer selling their designs.
 */
export type Seller = { artistId: string } | { designerUserId: string };

/**
 * What a seller needs before anything goes on sale: funded hosting, and for
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
   * List what still stands in the way, in words for the seller.
   *
   * @param currency - What the item is priced in, or null when it is free.
   * @returns Empty when the seller can sell it.
   */
  public async missingToSell(
    seller: Seller,
    currency: Currency | null,
  ): Promise<string[]> {
    const missing: string[] = [];
    const isArtist = 'artistId' in seller;

    if (currency !== null) {
      const account = isArtist
        ? await this.db.payments.getAccountByArtistId(seller.artistId)
        : await this.db.payments.getAccountByDesignerUserId(
            seller.designerUserId,
          );
      if (!account?.chargesEnabled) {
        missing.push('finish setting up your payment account');
      } else if (account.defaultCurrency !== currency) {
        missing.push('set prices again in your selling currency');
      }
    }

    const funded = isArtist
      ? await this.funding.isArtistFunded(seller.artistId)
      : await this.funding.isSellerFunded(seller.designerUserId);
    if (!funded) {
      missing.push(
        isArtist
          ? "top up the artist's hosting balance"
          : 'add a card and top up your hosting balance',
      );
    }

    return missing;
  }

  /**
   * Report whether a seller can sell an item right now.
   *
   * @param currency - What the item is priced in, or null when it is free.
   */
  public async canSell(
    seller: Seller,
    currency: Currency | null,
  ): Promise<boolean> {
    return (await this.missingToSell(seller, currency)).length === 0;
  }
}
