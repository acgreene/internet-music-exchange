import type { SupabaseClient } from '@supabase/supabase-js';
import { jsonResponse } from '@ime/testing';
import { ApiErrorKind } from '../api-error';
import { ApiTransport } from '../api-transport';
import { UserApi } from './user-api';

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

const SUPABASE_SESSION = {
  access_token: 'access123',
  user: {
    id: SESSION.user.id,
    email: SESSION.user.email,
    created_at: SESSION.user.createdAt,
  },
};

/**
 * Build a UserApi over a hand-made fake supabase client.
 */
function makeUserApi() {
  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      setSession: vi.fn(async () => ({ data: {}, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      updateUser: vi.fn(),
    },
  };
  const client = () => supabase as unknown as SupabaseClient;
  return { supabase, api: new UserApi(new ApiTransport(client), client) };
}

describe('UserApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('signIn calls the API and adopts the returned session into supabase', async () => {
    vi.stubGlobal('fetch', () => jsonResponse(SESSION));
    const { supabase, api } = makeUserApi();

    const result = await api.signIn('artist@example.com', 'password123');

    expect(result.ok).toBe(true);
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: 'access123',
      refresh_token: 'refresh123',
    });
  });

  it('relays API sign-in failures without adopting a session', async () => {
    vi.stubGlobal('fetch', () =>
      jsonResponse({ error: 'Invalid email or password.' }, 401),
    );
    const { supabase, api } = makeUserApi();

    const result = await api.signIn('artist@example.com', 'wrong');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.Http);
      expect(result.error.status).toBe(401);
      expect(result.error.message).toBe('Invalid email or password.');
    }
    expect(supabase.auth.setSession).not.toHaveBeenCalled();
  });

  it('signOut clears the local session even when the server call fails', async () => {
    vi.stubGlobal('fetch', () => jsonResponse({ error: 'boom' }, 500));
    const { supabase, api } = makeUserApi();

    const result = await api.signOut();

    expect(result.ok).toBe(false);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('reports the current user from the supabase session', async () => {
    const { supabase, api } = makeUserApi();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: SUPABASE_SESSION },
    });

    const user = await api.currentUser();

    expect(user?.email).toBe('artist@example.com');
  });

  it('deleteAccount calls the API with the bearer token and clears the local session', async () => {
    const fetchSpy = vi.fn<typeof fetch>(() => jsonResponse({ success: true }));
    vi.stubGlobal('fetch', fetchSpy);
    const { supabase, api } = makeUserApi();
    supabase.auth.getSession.mockResolvedValue({
      data: { session: SUPABASE_SESSION },
    });

    const result = await api.deleteAccount();

    expect(result.ok).toBe(true);
    const [, init] = fetchSpy.mock.calls[0];
    expect((init?.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer access123',
    );
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
