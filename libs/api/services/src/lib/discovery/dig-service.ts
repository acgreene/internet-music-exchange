import { DatabaseRepository } from '@ime/db';
import type { CrateItem, DigRecord, DigSession } from '@ime/models';
import { CrateService } from './crate-service';

const DEFAULT_DEPTH = 20;
const MAX_DEPTH = 30;

/**
 * Dig mode: a crate's records one at a time, as deep as the listener chose,
 * each with its whole tracklist and the tracks they may hear. The artist
 * chooses those tracks, and they play in full; IME never picks a highlight.
 */
export class DigService {
  constructor(
    private readonly db: DatabaseRepository,
    private readonly crates: CrateService,
  ) {}

  /**
   * Dig a crate someone made. Who may see the crate is the crate's rule.
   *
   * @throws ApiError 404 unless the crate is public or the viewer's own.
   */
  public async digCrate(
    crateId: string,
    depth?: number,
    viewerId?: string,
  ): Promise<DigSession> {
    const page = await this.crates.get(crateId, viewerId);
    const items = page.items.filter((item) => item.available);
    return {
      name: page.crate.name,
      reason: page.crate.note,
      crateId: page.crate.id,
      available: items.length,
      records: await this.records(items.slice(0, this.depth(depth)), viewerId),
    };
  }

  /**
   * Dig a crate IME builds from a genre or a tag.
   *
   * @throws ApiError 400 unless given a genre on IME's list or a tag.
   */
  public async digSound(
    sound: { genre?: string; tag?: string },
    depth?: number,
    viewerId?: string,
  ): Promise<DigSession> {
    const built = await this.crates.bySound(sound.genre, sound.tag);
    return {
      name: built.name,
      reason: built.reason,
      crateId: null,
      available: built.items.length,
      records: await this.records(
        built.items.slice(0, this.depth(depth)),
        viewerId,
      ),
    };
  }

  private depth(depth?: number): number {
    return Math.min(Math.max(depth ?? DEFAULT_DEPTH, 1), MAX_DEPTH);
  }

  private async records(
    items: CrateItem[],
    viewerId?: string,
  ): Promise<DigRecord[]> {
    const ids = items.map((item) => item.release.id);
    const [tracks, owned, designed, editions] = await Promise.all([
      this.db.releases.listTracksFor(ids),
      viewerId
        ? this.db.entitlements.filterOwned(viewerId, ids)
        : ([] as string[]),
      this.db.designs.filterDesigned(ids),
      this.db.search.listEditionVariants(ids),
    ]);
    return items.map((item) => {
      const id = item.release.id;
      return {
        release: item.release,
        pricing: item.pricing,
        note: item.note,
        tracks: tracks
          .filter((track) => track.releaseId === id)
          .map((track) => ({
            trackId: track.trackId,
            position: track.position,
            title: track.title,
            durationMs: track.durationMs,
            isPreview: track.isPreview,
          })),
        owned: owned.includes(id),
        designed: designed.includes(id),
        editions: editions
          .filter((edition) => edition.releaseId === id)
          .map((edition) => ({
            productId: edition.productId,
            productName: edition.productName,
            format: edition.type,
            currency: edition.currency,
            variantId: edition.variantId,
            variantLabel: edition.variantLabel,
            price: edition.price,
            stock: edition.stock,
          })),
      };
    });
  }
}
