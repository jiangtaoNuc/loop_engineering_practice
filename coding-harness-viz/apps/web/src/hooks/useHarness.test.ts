import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  backoffInterval,
  classifyError,
  fetchWithRetry,
  fetchWithTimeout,
} from './useHarness';

function mockResponse(body: BodyInit | null, init: ResponseInit = {}): Response {
  return {
    ok: init.status === undefined || (init.status >= 200 && init.status < 300),
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: () => Promise.resolve(typeof body === 'string' ? JSON.parse(body) : body),
    text: () => Promise.resolve(typeof body === 'string' ? body : ''),
    headers: {},
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'basic',
    url: '',
    clone: function () { return this; },
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.reject(new Error('not implemented')),
    trailer: Promise.resolve({}),
  } as unknown as Response;
}

describe('backoffInterval', () => {
  it('returns base interval when failCount is 0', () => {
    expect(backoffInterval(0, 7000)).toBe(7000);
  });

  it('doubles on first failure', () => {
    expect(backoffInterval(1, 7000)).toBe(14000);
  });

  it('quadruples on second failure', () => {
    expect(backoffInterval(2, 7000)).toBe(28000);
  });

  it('caps at MAX_BACKOFF_MS', () => {
    expect(backoffInterval(5, 7000)).toBe(60000);
    expect(backoffInterval(10, 7000)).toBe(60000);
  });

  it('handles negative failCount as base', () => {
    expect(backoffInterval(-1, 7000)).toBe(7000);
  });
});

describe('classifyError', () => {
  it('classifies AbortError as timeout', () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    expect(classifyError(err)).toEqual({
      kind: 'timeout',
      message: 'Network timeout — request took too long',
    });
  });

  it('classifies TypeError as network', () => {
    const err = new TypeError('Failed to fetch');
    expect(classifyError(err)).toEqual({
      kind: 'network',
      message: 'Network request failed — check your connection and try again',
    });
  });

  it('classifies 504 as timeout', () => {
    const err = new Error('HTTP 504');
    expect(classifyError(err)).toEqual({
      kind: 'timeout',
      message: 'Server timeout — please try again',
    });
  });

  it('classifies 5xx as server', () => {
    const err = new Error('HTTP 500');
    expect(classifyError(err)).toEqual({
      kind: 'server',
      message: 'Server error 500 — please try again',
    });
  });

  it('classifies 4xx as client', () => {
    const err = new Error('HTTP 422');
    expect(classifyError(err)).toEqual({
      kind: 'client',
      message: 'Request failed (422)',
    });
  });

  it('classifies unknown errors as unknown', () => {
    expect(classifyError(new Error('boom'))).toEqual({
      kind: 'unknown',
      message: 'Request failed',
    });
  });
});

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('aborts the request when the timeout is reached', async () => {
    vi.stubGlobal('fetch', (_url: string, options: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        if (options.signal) {
          options.signal.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
        }
      });
    });

    const promise = fetchWithTimeout('/api/test', {}, 1000);
    vi.advanceTimersByTime(1000);

    await expect(promise).rejects.toThrow('The operation was aborted');
  });
});

describe('fetchWithRetry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries once on TypeError and then resolves', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(mockResponse(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('/api/test', {}, 1000);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);

  it('retries once on 5xx and then resolves', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse('error', { status: 502 }))
      .mockResolvedValueOnce(mockResponse(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('/api/test', {}, 1000);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);

  it('gives up after one retry and throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithRetry('/api/test', {}, 1000)).rejects.toThrow('Failed to fetch');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);

  it('does not retry 4xx errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse('error', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('/api/test', {}, 1000);
    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
