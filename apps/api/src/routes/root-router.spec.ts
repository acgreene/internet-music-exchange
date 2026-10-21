import { ApiRoute } from '@ime/models';
import type { AuthService, HealthService } from '@ime/services';
import { RootRouter } from './root-router';

const mockPing = vi.fn();

vi.mock('@ime/db', () => ({
  // Constructed eagerly down the router graph by ArtistPageService.
  DatabaseRepository: vi.fn(),
}));

const mockAuthService = {
  getUser: vi.fn(),
} as unknown as AuthService;

const mockHealthService = {
  isDatabaseReachable: mockPing,
} as unknown as HealthService;

const createApp = () =>
  new RootRouter(mockAuthService, mockHealthService).router;

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
