import { ApiRoute } from '@ime/models';
import { DatabaseService } from '@ime/db';
import type { AuthService } from '@ime/services';
import { RootRouter } from './root-router';

const mockPing = vi.fn();

vi.mock('@ime/db', () => ({
  DatabaseService: { getInstance: vi.fn() },
  // Constructed eagerly down the router graph by ArtistPageService.
  DatabaseRepository: vi.fn(),
}));

const mockAuthService = {
  getUser: vi.fn(),
} as unknown as AuthService;

const createApp = () => new RootRouter(mockAuthService).router;

beforeEach(() => {
  vi.mocked(DatabaseService.getInstance).mockReturnValue({
    ping: mockPing,
  } as unknown as DatabaseService);
});

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
