import { createApp } from './app';

describe('api', () => {
  const app = createApp();

  it('reports health', async () => {
    const res = await app.request('/api/health');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
