import { ApiError, ApiErrorKind, ApiRoute } from '@ime/models';
import type { AuthService } from '@ime/services';
import { AuthRouter } from './auth-router';

const mockAuthService = {
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
};

const authRoutes = new AuthRouter(
  mockAuthService as unknown as AuthService,
).router;

const mockSupabaseUser = {
  id: 'mock-user-id',
  email: 'user@example.com',
  created_at: '2026-07-17T12:00:00.000Z',
};

const mockSupabaseSession = {
  access_token: 'access123',
  refresh_token: 'refresh123',
  expires_at: 1800000000,
  expires_in: 3600,
  user: mockSupabaseUser,
};

describe('auth routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('signs up and returns the supabase session', async () => {
    mockAuthService.signUp.mockResolvedValue(mockSupabaseSession);

    const res = await authRoutes.request(ApiRoute.SignUp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'artist@example.com',
        password: 'password123',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockSupabaseSession);
  });

  it('rejects an invalid sign-up body', async () => {
    const res = await authRoutes.request(ApiRoute.SignUp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'short' }),
    });

    expect(res.status).toBe(400);
  });

  it('relays auth service failures with their status and message', async () => {
    mockAuthService.signIn.mockRejectedValue(
      new ApiError(ApiErrorKind.Http, 401, 'Invalid email or password.'),
    );

    const res = await authRoutes.request(ApiRoute.SignIn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'artist@example.com', password: 'wrong' }),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid email or password.');
  });

  it('requires a bearer token to sign out', async () => {
    const res = await authRoutes.request(ApiRoute.SignOut, { method: 'POST' });

    expect(res.status).toBe(401);
  });

  it('signs out the session behind the bearer token', async () => {
    mockAuthService.getUser.mockResolvedValue(mockSupabaseUser);
    mockAuthService.signOut.mockResolvedValue(undefined);

    const res = await authRoutes.request(ApiRoute.SignOut, {
      method: 'POST',
      headers: { Authorization: 'Bearer access123' },
    });

    expect(res.status).toBe(200);
    expect(mockAuthService.signOut).toHaveBeenCalledWith('access123');
  });
});
