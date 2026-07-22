import type { ApiTransport } from '../api-transport';
import { ApiRoute, ArtistPageRenderResponse } from '@ime/models';
import { ApiResult } from '../api-result';
import { SupabaseClient } from '@supabase/supabase-js';

export class ArtistPagesClient {
  constructor(
    private readonly transport: ApiTransport,
    private readonly supabase: SupabaseClient,
  ) {}

  public async getArtistReleasePageData(
    releaseId: string,
  ): Promise<ApiResult<ArtistPageRenderResponse>> {
    return this.transport.get(ApiRoute.ArtistReleasePage, { releaseId });
  }
}
