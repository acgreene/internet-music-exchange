import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database-service';
import { artists, releasePricing, type ReleasePricing, releases, releaseTracks, tracks } from '../tables';

/**
 * A release together with the name of the artist who made it.
 */
export interface ReleaseTitleAndArtist {
  id: string;
  title: string;
  artistName: string;
}

/**
 * One entry of a release's tracklist, in running order.
 */
export interface ReleaseTracklistItem {
  position: number;
  title: string;
  durationMs: number | null;
}

/**
 * Reads and writes for the release aggregate — the release itself, its
 * tracklist and its pricing. Callers get typed results and never write their
 * own SQL, so the same query is not re-derived in every service that needs it.
 */
export class ReleaseRepository {
  constructor(
    private readonly database: DatabaseService = DatabaseService.getInstance(),
  ) {}

  /**
   * A single release with its artist's name, or null when no such release
   * exists.
   */
  public async getTitleAndArtistName(
    releaseId: string,
  ): Promise<ReleaseTitleAndArtist | null> {
    const [release] = await this.database.db
      .select({
        id: releases.id,
        title: releases.title,
        artistName: artists.name,
      })
      .from(releases)
      .innerJoin(artists, eq(artists.id, releases.artistId))
      .where(eq(releases.id, releaseId))
      .limit(1);

    return release ?? null;
  }

  /**
   * A release's tracklist in running order. Empty when the release has no
   * tracks yet.
   */
  public async getTrackList(
    releaseId: string,
  ): Promise<ReleaseTracklistItem[]> {
    return this.database.db
      .select({
        position: releaseTracks.position,
        title: tracks.title,
        durationMs: tracks.durationMs,
      })
      .from(releaseTracks)
      .innerJoin(tracks, eq(tracks.id, releaseTracks.trackId))
      .where(eq(releaseTracks.releaseId, releaseId))
      .orderBy(releaseTracks.position);
  }

  /**
   * A release's pricing, or null when it has not been priced yet.
   */
  public async getPricing(releaseId: string): Promise<ReleasePricing | null> {
    const [pricing] = await this.database.db
      .select()
      .from(releasePricing)
      .where(eq(releasePricing.releaseId, releaseId))
      .limit(1);

    return pricing ?? null;
  }
}
