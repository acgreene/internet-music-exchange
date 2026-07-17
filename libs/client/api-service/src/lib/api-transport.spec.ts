import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { jsonResponse } from '@ime/testing';
import { ApiErrorKind } from './api-error';
import { ApiTransport } from './api-transport';

const echoSchema = z.object({ id: z.string() });

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

  it('returns data when the response matches the schema', async () => {
    stubFetch(() => jsonResponse({ id: 'abc' }));

    const result = await makeTransport().get('/api/echo', echoSchema);

    expect(result).toEqual({ ok: true, data: { id: 'abc' } });
  });

  it('sends GET requests without a body', async () => {
    const fetchSpy = stubFetch(() => jsonResponse({ id: 'abc' }));

    await makeTransport().get('/api/echo', echoSchema);

    const [path, init] = fetchSpy.mock.calls[0];
    expect(path).toBe('/api/echo');
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
  });

  it('sends POST bodies as JSON', async () => {
    const fetchSpy = stubFetch(() => jsonResponse({ id: 'abc' }));

    await makeTransport().post('/api/echo', { name: 'x' }, echoSchema);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init?.body).toBe('{"name":"x"}');
  });

  it('attaches the supabase access token as a bearer header', async () => {
    const fetchSpy = stubFetch(() => jsonResponse({ id: 'abc' }));

    await makeTransport('access123').get('/api/echo', echoSchema);

    const [, init] = fetchSpy.mock.calls[0];
    expect((init?.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer access123',
    );
  });

  it('returns the server message for an http error', async () => {
    stubFetch(() => jsonResponse({ error: 'boom' }, 500));

    const result = await makeTransport().get('/api/echo', echoSchema);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.Http);
      expect(result.error.status).toBe(500);
      expect(result.error.message).toBe('boom');
    }
  });

  it('returns an invalid-response error when the body does not match the schema', async () => {
    stubFetch(() => jsonResponse({ wrong: true }));

    const result = await makeTransport().get('/api/echo', echoSchema);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.InvalidResponse);
    }
  });

  it('returns a network error when the request fails', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')));

    const result = await makeTransport().get('/api/echo', echoSchema);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.Network);
      expect(result.error.status).toBeNull();
    }
  });
});
