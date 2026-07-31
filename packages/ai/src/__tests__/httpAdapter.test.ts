import { httpAdapter } from '../adapters/http';
import { AIAdapterError } from '../types';

function mockFetchResponse(status: number, body: unknown): typeof fetch {
  return jest.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('httpAdapter', () => {
  it('POSTs {system, prompt, schema, maxTokens} and returns {text, json, usage}', async () => {
    const fetchMock = mockFetchResponse(200, {
      text: 'ok',
      json: { a: 1 },
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    const adapter = httpAdapter({
      endpoint: '/api/ai',
      headers: { 'X-Token': 't' },
      fetch: fetchMock,
    });
    const result = await adapter.complete({
      system: 'sys',
      prompt: 'hello',
      schema: { type: 'object' },
      maxTokens: 128,
    });

    expect(result).toEqual({ text: 'ok', json: { a: 1 }, usage: { inputTokens: 10, outputTokens: 5 } });
    expect(fetchMock).toHaveBeenCalledWith('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Token': 't' },
      body: JSON.stringify({ system: 'sys', prompt: 'hello', schema: { type: 'object' }, maxTokens: 128 }),
      signal: undefined,
    });
  });

  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'rate_limit'],
    [400, 'invalid_request'],
    [500, 'unknown'],
  ])('maps HTTP %i to AIAdapterError kind "%s"', async (status, kind) => {
    const adapter = httpAdapter({ endpoint: '/api/ai', fetch: mockFetchResponse(status, {}) });
    await expect(adapter.complete({ prompt: 'x' })).rejects.toMatchObject({
      name: 'AIAdapterError',
      kind,
    });
  });

  it('maps thrown fetch errors to kind "network"', async () => {
    const fetchMock = jest.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    const adapter = httpAdapter({ endpoint: '/api/ai', fetch: fetchMock });
    const err = await adapter.complete({ prompt: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(AIAdapterError);
    expect(err.kind).toBe('network');
  });

  it('propagates AbortError untouched and forwards the signal', async () => {
    const controller = new AbortController();
    const fetchMock = jest.fn(async (_url: unknown, init: any) => {
      expect(init.signal).toBe(controller.signal);
      const abortErr = new Error('The operation was aborted.');
      abortErr.name = 'AbortError';
      throw abortErr;
    }) as unknown as typeof fetch;
    const adapter = httpAdapter({ endpoint: '/api/ai', fetch: fetchMock });
    const err = await adapter
      .complete({ prompt: 'x', signal: controller.signal })
      .catch((e) => e);
    expect(err.name).toBe('AbortError');
  });

  it('maps an invalid JSON body to kind "unknown"', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    })) as unknown as typeof fetch;
    const adapter = httpAdapter({ endpoint: '/api/ai', fetch: fetchMock });
    await expect(adapter.complete({ prompt: 'x' })).rejects.toMatchObject({ kind: 'unknown' });
  });

  it('rejects construction without an endpoint', () => {
    expect(() => httpAdapter({ endpoint: '' })).toThrow(AIAdapterError);
  });
});
