import { Hono } from 'hono';
import { ApiError, ApiErrorKind } from '@ime/models';
import type { AuthService } from '@ime/auth';
import { AuthMiddleware } from './auth-middleware';
import { RouteUtils } from '../utils';

const mockAuthService = {
  getUser: vi.fn(),
};

const SUPABASE_USER = {
  id: '5d2b7c9a-8e21-4b6f-8c3d-1a9e8f7b6222',
  email: 'artist@example.com',
  created_at: '2026-07-17T12:00:00.000Z',
};

const authMiddleware = new AuthMiddleware(
  mockAuthService as unknown as AuthService,
).middleware();

const app = new Hono().get('/protected', authMiddleware, (c) => {
  const routeUtils = new RouteUtils(c);
  return c.json(routeUtils.getAuthUser());
});
app.onError(RouteUtils.errorHandler);

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('responds 401 when the bearer token is missing', async () => {
    const res = await app.request('/protected');

    expect(res.status).toBe(401);
  });

  it('relays auth service failures for invalid tokens', async () => {
    mockAuthService.getUser.mockRejectedValue(
      new ApiError(ApiErrorKind.Http, 401, 'invalid JWT'),
    );

    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer expired' },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid JWT');
  });

  it('attaches the verified supabase user for downstream handlers', async () => {
    mockAuthService.getUser.mockResolvedValue(SUPABASE_USER);

    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer access123' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(SUPABASE_USER);
    expect(mockAuthService.getUser).toHaveBeenCalledWith('access123');
  });
});
