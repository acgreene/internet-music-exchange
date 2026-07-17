import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { z } from 'zod';
import type { ApiHealth, Release } from '@ime/models';

const SAMPLE_RELEASES: Release[] = [
  {
    id: 'rel_001',
    artistId: 'art_001',
    slug: 'first-light',
    title: 'First Light',
    format: 'digital',
    priceCents: 700,
    currency: 'usd',
    releasedAt: '2026-05-01',
    tracks: [
      {
        id: 'trk_001',
        releaseId: 'rel_001',
        title: 'Overture',
        trackNumber: 1,
        durationSeconds: 214,
      },
      {
        id: 'trk_002',
        releaseId: 'rel_001',
        title: 'Signal Fire',
        trackNumber: 2,
        durationSeconds: 187,
      },
    ],
  },
];

const releasesQuerySchema = z.object({
  artistId: z.string().optional(),
});

export function createApp() {
  const app = new Hono();

  app.use(logger());

  app.get('/api/health', (c) => {
    const health: ApiHealth = {
      status: 'ok',
      service: 'api',
      timestamp: new Date().toISOString(),
    };
    return c.json(health);
  });

  app.get('/api/releases', (c) => {
    const query = releasesQuerySchema.safeParse(c.req.query());
    if (!query.success) {
      return c.json({ error: 'Invalid query parameters' }, 400);
    }

    const { artistId } = query.data;
    const releases = artistId
      ? SAMPLE_RELEASES.filter((release) => release.artistId === artistId)
      : SAMPLE_RELEASES;

    return c.json(releases);
  });

  return app;
}
