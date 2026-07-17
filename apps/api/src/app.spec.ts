import { ApiRoute } from '@ime/models';
import { pingDb } from '@ime/db';
import { createApp } from './app';

vi.mock('@ime/db', () => ({
  db: {},
  pingDb: vi.fn(),
}));

describe('api', () => {
  it('reports ok when the database is reachable', async () => {
    vi.mocked(pingDb).mockResolvedValue(true);

    const res = await createApp().request(ApiRoute.Health);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('reports degraded when the database is unreachable', async () => {
    vi.mocked(pingDb).mockResolvedValue(false);

    const res = await createApp().request(ApiRoute.Health);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('degraded');
  });
});
