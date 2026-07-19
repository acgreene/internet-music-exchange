import type { SupabaseClient } from '@supabase/supabase-js';
import { jsonResponse } from '@ime/testing';
import { ApiErrorKind, ApiRoute } from '@ime/models';
import { ApiTransport } from './api-transport';

/**
 * A body matching the contract declared for GET /api/health.
 */
const HEALTH_BODY = { status: 'ok', timestamp: '2026-07-17T12:00:00.000Z' };

/**
 * A body matching the contract declared for POST /api/auth/sign-up.
 */
const SESSION_BODY = { access_token: 'access123', refresh_token: 'refresh123' };

/**
 * Build a transport over a fake supabase client holding the given access token.
 */
function makeTransport(accessToken: string | null = null) {
  const session = accessToken ? { access_token: accessToken } : null;
  const supabase = {
    auth: { getSession: async () => ({ data: { session } }) },
  };
  return new ApiTransport(() => supabase as unknown as SupabaseClient);
}

/**
 * Replace the global fetch with a spy that responds using the given factory.
 */
function stubFetch(respond: () => Promise<Response>) {
  const spy = vi.fn<typeof fetch>(respond);
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('ApiTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns data when the response matches the route's contract", async () => {
    stubFetch(() => jsonResponse(HEALTH_BODY));

    const result = await makeTransport().get(ApiRoute.Health);

    expect(result).toEqual({ ok: true, data: HEALTH_BODY });
  });

  it('sends GET requests without a body', async () => {
    const fetchSpy = stubFetch(() => jsonResponse(HEALTH_BODY));

    await makeTransport().get(ApiRoute.Health);

    const [path, init] = fetchSpy.mock.calls[0];
    expect(String(path)).toContain(ApiRoute.Health);
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
  });

  it('sends POST bodies as JSON', async () => {
    const fetchSpy = stubFetch(() => jsonResponse(SESSION_BODY));

    await makeTransport().post(ApiRoute.SignUp, {
      email: 'artist@example.com',
      password: 'password123',
    });

    const [path, init] = fetchSpy.mock.calls[0];
    expect(String(path)).toContain(ApiRoute.SignUp);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init?.body).toBe(
      '{"email":"artist@example.com","password":"password123"}',
    );
  });

  it('omits the body for a POST route that declares no request schema', async () => {
    const fetchSpy = stubFetch(() => jsonResponse({ success: true }));

    await makeTransport().post(ApiRoute.SignOut);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeUndefined();
  });

  it('attaches the supabase access token as a bearer header', async () => {
    const fetchSpy = stubFetch(() => jsonResponse(HEALTH_BODY));

    await makeTransport('access123').get(ApiRoute.Health);

    const [, init] = fetchSpy.mock.calls[0];
    expect((init?.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer access123',
    );
  });

  it('returns the server message for an http error', async () => {
    stubFetch(() => jsonResponse({ error: 'boom' }, 500));

    const result = await makeTransport().get(ApiRoute.Health);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.Http);
      expect(result.error.status).toBe(500);
      expect(result.error.message).toBe('boom');
    }
  });

  it("returns an invalid-response error when the body does not match the route's contract", async () => {
    stubFetch(() => jsonResponse({ wrong: true }));

    const result = await makeTransport().get(ApiRoute.Health);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.InvalidResponse);
    }
  });

  it('returns a network error when the request fails', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')));

    const result = await makeTransport().get(ApiRoute.Health);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.Network);
      expect(result.error.status).toBeNull();
    }
  });
});
