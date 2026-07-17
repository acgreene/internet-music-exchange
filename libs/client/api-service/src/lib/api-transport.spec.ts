import { z } from 'zod';
import { jsonResponse } from '@ime/testing';
import { ApiErrorKind } from './api-error';
import { ApiTransport } from './api-transport';

const echoSchema = z.object({ id: z.string() });

/**
 * Replace the global fetch with a spy that responds using the given factory.
 */
function stubFetch(respond: () => Promise<Response>) {
  const spy = vi.fn<typeof fetch>(respond);
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('ApiTransport', () => {
  const transport = new ApiTransport();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns data when the response matches the schema', async () => {
    stubFetch(() => jsonResponse({ id: 'abc' }));

    const result = await transport.get('/api/echo', echoSchema);

    expect(result).toEqual({ ok: true, data: { id: 'abc' } });
  });

  it('sends GET requests without a body', async () => {
    const fetchSpy = stubFetch(() => jsonResponse({ id: 'abc' }));

    await transport.get('/api/echo', echoSchema);

    const [path, init] = fetchSpy.mock.calls[0];
    expect(path).toBe('/api/echo');
    expect(init?.method).toBe('GET');
    expect(init?.body).toBeUndefined();
  });

  it('sends POST bodies as JSON', async () => {
    const fetchSpy = stubFetch(() => jsonResponse({ id: 'abc' }));

    await transport.post('/api/echo', { name: 'x' }, echoSchema);

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init?.body).toBe('{"name":"x"}');
  });

  it('returns the server message for an http error', async () => {
    stubFetch(() => jsonResponse({ error: 'boom' }, 500));

    const result = await transport.get('/api/echo', echoSchema);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.Http);
      expect(result.error.status).toBe(500);
      expect(result.error.message).toBe('boom');
    }
  });

  it('returns an invalid-response error when the body does not match the schema', async () => {
    stubFetch(() => jsonResponse({ wrong: true }));

    const result = await transport.get('/api/echo', echoSchema);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.InvalidResponse);
    }
  });

  it('returns a network error when the request fails', async () => {
    stubFetch(() => Promise.reject(new TypeError('fetch failed')));

    const result = await transport.get('/api/echo', echoSchema);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.Network);
      expect(result.error.status).toBeNull();
    }
  });
});
