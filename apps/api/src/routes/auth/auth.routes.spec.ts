import { ApiRoute } from '@ime/models';
import { AuthError } from '@ime/auth';
import { authRoutes } from './auth.routes';

const { fakeAuth } = vi.hoisted(() => ({
  fakeAuth: {
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock('@ime/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@ime/auth')>()),
  AuthService: class {
    constructor() {
      return fakeAuth;
    }
  },
}));

const SESSION = {
  accessToken: 'access123',
  refreshToken: 'refresh123',
  expiresAt: 1800000000,
  user: {
    id: '5d2b7c9a-8e21-4b6f-8c3d-1a9e8f7b6222',
    email: 'artist@example.com',
    createdAt: '2026-07-17T12:00:00.000Z',
  },
};

describe('auth routes', () => {
  it('signs up and returns the session', async () => {
    fakeAuth.signUp.mockResolvedValue(SESSION);

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
    expect(body.accessToken).toBe('access123');
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
    fakeAuth.signIn.mockRejectedValue(
      new AuthError(401, 'Invalid email or password.'),
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
});
