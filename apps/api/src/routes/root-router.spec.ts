import { ApiRoute } from '@ime/models';
import type { ImeServices } from '@ime/services';
import { RootRouter } from './root-router';

const mockPing = vi.fn();

const mockServices = {
  auth: { getUser: vi.fn() },
  health: { isDatabaseReachable: mockPing },
  artistPages: { renderRelease: vi.fn() },
} as unknown as ImeServices;

const createApp = () => new RootRouter(mockServices).router;

afterEach(() => {
  vi.resetAllMocks();
});

describe('api', () => {
  it('reports ok when the database is reachable', async () => {
    mockPing.mockResolvedValue(true);

    const res = await createApp().request(ApiRoute.Health);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  it('reports degraded when the database is unreachable', async () => {
    mockPing.mockResolvedValue(false);

    const res = await createApp().request(ApiRoute.Health);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('degraded');
  });
});
