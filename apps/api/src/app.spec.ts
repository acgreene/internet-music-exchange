import { createApp } from './app';
import type { ApiHealth, Release } from '@ime/models';

describe('api', () => {
  const app = createApp();

  it('reports health', async () => {
    const res = await app.request('/api/health');

    expect(res.status).toBe(200);
    const body = (await res.json()) as ApiHealth;
    expect(body.status).toBe('ok');
    expect(body.service).toBe('api');
  });

  it('lists releases', async () => {
    const res = await app.request('/api/releases');

    expect(res.status).toBe(200);
    const body = (await res.json()) as Release[];
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].tracks.length).toBeGreaterThan(0);
  });

  it('filters releases by artist', async () => {
    const res = await app.request('/api/releases?artistId=art_missing');

    expect(res.status).toBe(200);
    const body = (await res.json()) as Release[];
    expect(body).toHaveLength(0);
  });
});
