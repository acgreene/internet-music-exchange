import type { Release } from './models';

describe('models', () => {
  it('describes a release with typed tracks', () => {
    const release: Release = {
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
      ],
    };

    expect(release.tracks).toHaveLength(1);
    expect(release.format).toBe('digital');
  });
});
