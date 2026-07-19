import { ApiRoute } from '@ime/models';
import { databaseService } from '@ime/db';
import type { AuthService } from '@ime/auth';
import { RootRouter } from './root-router';

vi.mock('@ime/db', () => ({
  databaseService: { ping: vi.fn() },
}));

const mockAuthService = {
  getUser: vi.fn(),
} as unknown as AuthService;

const createApp = () => new RootRouter(mockAuthService).router;

describe('api', () => {
  it('reports ok when the database is reachable', async () => {
    vi.mocked(databaseService.ping).mockResolvedValue(true);

    const res = await createApp().request(ApiRoute.Health);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('reports degraded when the database is unreachable', async () => {
    vi.mocked(databaseService.ping).mockResolvedValue(false);

    const res = await createApp().request(ApiRoute.Health);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('degraded');
  });
});
