import { jsonResponse } from '@ime/testing';
import { ApiService } from './api-service';
import { ApiErrorKind } from './api-error';

describe('ApiService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns data for a valid response', async () => {
    vi.stubGlobal('fetch', () =>
      jsonResponse({
        status: 'ok',
        timestamp: '2026-07-17T12:00:00.000Z',
      }),
    );

    const result = await new ApiService().health();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe('ok');
    }
  });

  it('returns an http error for a non-2xx response', async () => {
    vi.stubGlobal('fetch', () => jsonResponse({ error: 'boom' }, 500));

    const result = await new ApiService().health();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.Http);
      expect(result.error.status).toBe(500);
      expect(result.error.message).toBe('boom');
    }
  });

  it('returns an invalid-response error when the body does not match the contract', async () => {
    vi.stubGlobal('fetch', () => jsonResponse({ status: 'down' }));

    const result = await new ApiService().health();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.InvalidResponse);
    }
  });

  it('returns a network error when fetch rejects', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('fetch failed')));

    const result = await new ApiService().health();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe(ApiErrorKind.Network);
      expect(result.error.status).toBeNull();
    }
  });
});
