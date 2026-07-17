import { ApiRoute } from '@ime/models';
import { AuthError } from '@ime/auth';
import { usersRoutes } from './users.routes';

const { fakeAuth } = vi.hoisted(() => ({
  fakeAuth: {
    getUser: vi.fn(),
    deleteUser: vi.fn(),
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

describe('user routes', () => {
  it('requires a bearer token to delete the account', async () => {
    const res = await usersRoutes.request(ApiRoute.Users, { method: 'DELETE' });

    expect(res.status).toBe(401);
  });

  it('deletes the account behind the bearer token', async () => {
    fakeAuth.getUser.mockResolvedValue(USER);
    fakeAuth.deleteUser.mockResolvedValue(undefined);

    const res = await usersRoutes.request(ApiRoute.Users, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer access123' },
    });

    expect(res.status).toBe(200);
    expect(fakeAuth.deleteUser).toHaveBeenCalledWith(USER.id);
  });

  it('relays auth service failures with their status and message', async () => {
    fakeAuth.getUser.mockRejectedValue(new AuthError(401, 'invalid JWT'));

    const res = await usersRoutes.request(ApiRoute.Users, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer expired' },
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('invalid JWT');
  });
});
