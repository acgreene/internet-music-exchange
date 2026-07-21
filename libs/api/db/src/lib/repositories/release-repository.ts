import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database-service';
import {
  artists,
  releasePricing,
  type ReleasePricing,
  releases,
  releaseTracks,
  tracks,
} from '../tables';

export interface ReleaseTitleAndArtist {
  id: string;
  title: string;
  artistName: string;
}

export interface ReleaseTracklistItem {
  position: number;
  title: string;
  durationMs: number | null;
}

/**
 * Queries for the release aggregate: the release, its tracklist and its
 * pricing. Callers get typed results instead of re-deriving the same SQL.
 */
export class ReleaseRepository {
  constructor(
    private readonly database: DatabaseService = DatabaseService.getInstance(),
  ) {}

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

  /** In running order. */
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

  public async getPricing(releaseId: string): Promise<ReleasePricing | null> {
    const [pricing] = await this.database.db
      .select()
      .from(releasePricing)
      .where(eq(releasePricing.releaseId, releaseId))
      .limit(1);

    return pricing ?? null;
  }
}
