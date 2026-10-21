import {
  type CostShare,
  type CostShareOffer,
  DatabaseRepository,
} from '@ime/db';
import { ApiError, ApiErrorKind, HttpStatus } from '@ime/models';
import { AccessService } from '../access/access-service';

/** A whole split, 100%, in hundredths of a percent. */
const WHOLE_SHARE = 10000;

export interface ShareInput {
  userId: string;
  /** Hundredths of a percent: 2500 is 25%. */
  shareBasisPoints: number;
}

/**
 * How an artist's hosting costs are split, and the proposal waiting to
 * replace it, if any.
 */
export interface ArtistCostSplit {
  shares: CostShare[];
  proposal: CostShareOffer[];
}

/**
 * How an artist's managers split its hosting costs. A manager proposes a new
 * split; it takes effect once every manager offered a share accepts. Until
 * then the current split stands.
 */
export class CostShareService {
  constructor(
    private readonly db: DatabaseRepository = new DatabaseRepository(),
    private readonly access: AccessService = new AccessService(db),
  ) {}

  /**
   * Read an artist's split and any pending proposal, for its managers.
   *
   * @throws ApiError 403 when the user does not manage the artist.
   */
  public async getSplit(
    userId: string,
    artistId: string,
  ): Promise<ArtistCostSplit> {
    await this.access.requireManager(userId, artistId);
    const [shares, proposal] = await Promise.all([
      this.db.funding.listCostShares(artistId),
      this.db.funding.listOffers(artistId),
    ]);
    return { shares, proposal };
  }

  /**
   * Propose a new split, replacing any earlier proposal. The proposer's own
   * share counts as accepted.
   *
   * @throws ApiError 400 when the shares do not add up to 100%, repeat a
   * manager, or name someone who does not manage the artist.
   */
  public async proposeSplit(
    userId: string,
    artistId: string,
    shares: ShareInput[],
  ): Promise<ArtistCostSplit> {
    await this.access.requireManager(userId, artistId);

    const managers = new Set(
      (await this.db.artists.listManagers(artistId)).map((m) => m.userId),
    );
    const named = new Set(shares.map((share) => share.userId));
    const total = shares.reduce(
      (sum, share) => sum + share.shareBasisPoints,
      0,
    );

    if (named.size !== shares.length) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Each manager can appear in a split only once.',
      );
    }
    if ([...named].some((id) => !managers.has(id))) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        "Only the artist's managers can share its costs.",
      );
    }
    if (
      shares.some(
        (share) =>
          !Number.isInteger(share.shareBasisPoints) ||
          share.shareBasisPoints < 1,
      ) ||
      total !== WHOLE_SHARE
    ) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.BadRequest,
        'Every share must be above zero, and together they must add up to 100%.',
      );
    }

    await this.db.funding.proposeSplit(artistId, userId, shares);
    return this.getSplit(userId, artistId);
  }

  /**
   * Accept the share a proposal offers you. Taking on a share needs a card on
   * file.
   *
   * @returns Whether the split now applies, or still waits on others.
   * @throws ApiError 404 when no share is offered to you, 409 without a card.
   */
  public async acceptShare(
    userId: string,
    artistId: string,
  ): Promise<'accepted' | 'applied'> {
    await this.access.requireManager(userId, artistId);

    const billing = await this.db.funding.getBilling(userId);
    if (!billing?.stripePaymentMethodId) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.Conflict,
        'Add a card before taking on a share of the costs.',
      );
    }

    const result = await this.db.funding.acceptOffer(artistId, userId);
    if (!result) {
      throw new ApiError(
        ApiErrorKind.Http,
        HttpStatus.NotFound,
        'No share of this artist is offered to you.',
      );
    }
    return result;
  }

  /**
   * Withdraw the pending proposal.
   *
   * @throws ApiError 403 when the user does not manage the artist.
   */
  public async withdrawProposal(
    userId: string,
    artistId: string,
  ): Promise<void> {
    await this.access.requireManager(userId, artistId);
    await this.db.funding.withdrawOffers(artistId);
  }
}
