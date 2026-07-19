import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '@ime/models';
import { AuthService } from './auth-service';

const SUPABASE_USER = {
  id: '5d2b7c9a-8e21-4b6f-8c3d-1a9e8f7b6222',
  email: 'artist@example.com',
  created_at: '2026-07-17T12:00:00.000000Z',
};

const SUPABASE_SESSION = {
  access_token: 'access123',
  refresh_token: 'refresh123',
  expires_at: 1800000000,
  expires_in: 3600,
  user: SUPABASE_USER,
};

/**
 * Build an AuthService over hand-made fake supabase clients.
 */
function makeService() {
  const anon = {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      getUser: vi.fn(),
    },
  };
  const admin = {
    auth: { admin: { signOut: vi.fn(), deleteUser: vi.fn() } },
  };
  const service = new AuthService(
    anon as unknown as SupabaseClient,
    admin as unknown as SupabaseClient,
  );
  return { anon, admin, service };
}

describe('AuthService', () => {
  it('signIn returns the supabase session as-is', async () => {
    const { anon, service } = makeService();
    anon.auth.signInWithPassword.mockResolvedValue({
      data: { session: SUPABASE_SESSION, user: SUPABASE_USER },
      error: null,
    });

    const session = await service.signIn('artist@example.com', 'password123');

    expect(session.access_token).toBe('access123');
    expect(session.user.email).toBe('artist@example.com');
  });

  it('signIn reads the same for any wrong credentials, blocking enumeration', async () => {
    const { anon, service } = makeService();
    anon.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { status: 400, message: 'Invalid login credentials' },
    });

    await expect(
      service.signIn('artist@example.com', 'wrong'),
    ).rejects.toMatchObject({
      status: 401,
      message: 'Invalid email or password.',
    });
  });

  it('signIn maps rate limiting to 429 with a friendly message', async () => {
    const { anon, service } = makeService();
    anon.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { status: 429, message: 'over_request_rate_limit' },
    });

    await expect(
      service.signIn('artist@example.com', 'password123'),
    ).rejects.toMatchObject({
      status: 429,
      message: 'Too many login attempts. Please try again later.',
    });
  });

  it('signUp fails loudly when no session is returned', async () => {
    const { anon, service } = makeService();
    anon.auth.signUp.mockResolvedValue({
      data: { session: null, user: SUPABASE_USER },
      error: null,
    });

    await expect(
      service.signUp('artist@example.com', 'password123'),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('signOut revokes the token through the admin client', async () => {
    const { admin, service } = makeService();
    admin.auth.admin.signOut.mockResolvedValue({ error: null });

    await service.signOut('access123');

    expect(admin.auth.admin.signOut).toHaveBeenCalledWith('access123');
  });

  it('returns the supabase user behind a valid token', async () => {
    const { anon, service } = makeService();
    anon.auth.getUser.mockResolvedValue({
      data: { user: SUPABASE_USER },
      error: null,
    });

    const user = await service.getUser('access123');

    expect(user.email).toBe('artist@example.com');
  });

  it('deletes users through the admin client', async () => {
    const { admin, service } = makeService();
    admin.auth.admin.deleteUser.mockResolvedValue({ data: {}, error: null });

    await service.deleteUser(SUPABASE_USER.id);

    expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith(SUPABASE_USER.id);
  });
});
