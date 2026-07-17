import { Hono } from 'hono';
import { AuthError } from '@ime/auth';
import { type AuthEnv, getAuthUser } from './auth-context';
import { authMiddleware } from './auth.middleware';

const { fakeAuth } = vi.hoisted(() => ({
  fakeAuth: {
    getUser: vi.fn(),
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

const USER = {
  id: '5d2b7c9a-8e21-4b6f-8c3d-1a9e8f7b6222',
  email: 'artist@example.com',
  createdAt: '2026-07-17T12:00:00.000Z',
};

/**
 * A minimal protected route that echoes the authenticated user.
 */
const app = new Hono<AuthEnv>().get('/protected', authMiddleware, (c) =>
  c.json(getAuthUser(c)),
);

describe('authMiddleware', () => {
  it('responds 401 when the bearer token is missing', async () => {
    const res = await app.request('/protected');

    expect(res.status).toBe(401);
  });

  it('relays auth service failures for invalid tokens', async () => {
    fakeAuth.getUser.mockRejectedValue(new AuthError(401, 'invalid JWT'));

    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer expired' },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid JWT');
  });

  it('attaches the verified user for downstream handlers', async () => {
    fakeAuth.getUser.mockResolvedValue(USER);

    const res = await app.request('/protected', {
      headers: { Authorization: 'Bearer access123' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(USER.id);
    expect(fakeAuth.getUser).toHaveBeenCalledWith('access123');
  });
});
