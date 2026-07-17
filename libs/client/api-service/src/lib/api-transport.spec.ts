import { z } from 'zod';
import { jsonResponse } from '@ime/testing';
import { ApiTransport } from './api-transport';

const echoSchema = z.object({ id: z.string() });

describe('ApiTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts a JSON body and validates the response', async () => {
    const fetchSpy = vi.fn(() => jsonResponse({ id: 'abc' }));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await new ApiTransport().post(
      '/api/echo',
      { name: 'x' },
      echoSchema,
    );

    expect(result.ok).toBe(true);
    const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).toBe(JSON.stringify({ name: 'x' }));
  });

  it('sends GET requests without a body or content type', async () => {
    const fetchSpy = vi.fn(() => jsonResponse({ id: 'abc' }));
    vi.stubGlobal('fetch', fetchSpy);

    const result = await new ApiTransport().get('/api/echo', echoSchema);

    expect(result.ok).toBe(true);
    const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit];
    expect(init.method).toBe('GET');
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
  });
});
