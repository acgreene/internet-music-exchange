import { ApiError, ApiErrorKind, ApiRoute } from '@ime/models';
import type { AuthService } from '@ime/auth';
import { UsersRouter } from './users-router';

const mockAuthService = {
  getUser: vi.fn(),
  deleteUser: vi.fn(),
};

const usersRoutes = new UsersRouter(
  mockAuthService as unknown as AuthService,
).router;

const SUPABASE_USER = {
  id: '5d2b7c9a-8e21-4b6f-8c3d-1a9e8f7b6222',
  email: 'artist@example.com',
  created_at: '2026-07-17T12:00:00.000Z',
};

describe('user routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('requires a bearer token to delete the account', async () => {
    const res = await usersRoutes.request(ApiRoute.Users, { method: 'DELETE' });

    expect(res.status).toBe(401);
  });

  it('deletes the account behind the bearer token', async () => {
    mockAuthService.getUser.mockResolvedValue(SUPABASE_USER);
    mockAuthService.deleteUser.mockResolvedValue(undefined);

    const res = await usersRoutes.request(ApiRoute.Users, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer access123' },
    });

    expect(res.status).toBe(200);
    expect(mockAuthService.deleteUser).toHaveBeenCalledWith(SUPABASE_USER.id);
  });

  it('relays auth service failures with their status and message', async () => {
    mockAuthService.getUser.mockRejectedValue(
      new ApiError(ApiErrorKind.Http, 401, 'invalid JWT'),
    );

    const res = await usersRoutes.request(ApiRoute.Users, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer expired' },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid JWT');
  });
});
