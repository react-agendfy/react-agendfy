/**
 * Claude adapter tests. The optional peer '@anthropic-ai/sdk' is NOT
 * installed in this repo, so it is mocked as a virtual module. No network
 * calls happen anywhere in this file.
 */
import { AIAdapterError } from '../types';

/* Mock SDK error hierarchy mirroring the real one (APIConnectionError is a
 * subclass of APIError, which is why the adapter must check it first). */
class APIError extends Error {}
class APIConnectionError extends APIError {}
class BadRequestError extends APIError {}
class AuthenticationError extends APIError {}
class RateLimitError extends APIError {}

const mockCreate = jest.fn();

// "mock"-prefixed so jest.mock's hoisted factory may reference it.
class MockAnthropic {
  static APIError = APIError;
  static APIConnectionError = APIConnectionError;
  static BadRequestError = BadRequestError;
  static AuthenticationError = AuthenticationError;
  static RateLimitError = RateLimitError;
  static lastConstructorArgs: unknown;
  messages = { create: mockCreate };
  constructor(opts: unknown) {
    MockAnthropic.lastConstructorArgs = opts;
  }
}

jest.mock(
  '@anthropic-ai/sdk',
  () => ({ __esModule: true, default: MockAnthropic }),
  { virtual: true }
);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  claudeAdapter,
  DEFAULT_CLAUDE_MODEL,
  __resetClaudeAdapterModuleCache,
} = require('../adapters/claude');

beforeEach(() => {
  mockCreate.mockReset();
  __resetClaudeAdapterModuleCache();
});

describe('claudeAdapter', () => {
  it('uses structured outputs (output_config.json_schema), the default model, and no sampling params', async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: 'thinking', thinking: 'should be ignored' },
        { type: 'text', text: '{"a":1}' },
      ],
      usage: { input_tokens: 12, output_tokens: 7 },
    });
    const adapter = claudeAdapter({ apiKey: 'k', dangerouslyAllowBrowser: true });
    const schema = { type: 'object', additionalProperties: false, required: [], properties: {} };
    const result = await adapter.complete({ system: 'sys', prompt: 'p', schema });

    const [params, opts] = mockCreate.mock.calls[0];
    expect(params.model).toBe(DEFAULT_CLAUDE_MODEL);
    expect(DEFAULT_CLAUDE_MODEL).toBe('claude-opus-4-8');
    expect(params.max_tokens).toBe(2048);
    expect(params.system).toBe('sys');
    expect(params.messages).toEqual([{ role: 'user', content: 'p' }]);
    expect(params.output_config).toEqual({ format: { type: 'json_schema', schema } });
    // Forbidden on opus-4-8 — must never be sent:
    expect(params).not.toHaveProperty('output_format');
    expect(params).not.toHaveProperty('temperature');
    expect(params).not.toHaveProperty('top_p');
    expect(params).not.toHaveProperty('top_k');
    expect(params).not.toHaveProperty('thinking');
    expect(opts).toEqual({ signal: undefined });

    expect(result.json).toEqual({ a: 1 });
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 7 });
    expect(MockAnthropic.lastConstructorArgs).toEqual({ apiKey: 'k', dangerouslyAllowBrowser: true });
  });

  it('returns plain text (no output_config) when no schema is given, narrowing text blocks', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use' }, { type: 'text', text: 'hello ' }, { type: 'text', text: 'world' }],
      usage: { input_tokens: 1, output_tokens: 2 },
    });
    const adapter = claudeAdapter({ model: 'claude-custom', defaultMaxTokens: 4096 });
    const result = await adapter.complete({ prompt: 'p' });
    const [params] = mockCreate.mock.calls[0];
    expect(params.model).toBe('claude-custom');
    expect(params.max_tokens).toBe(4096);
    expect(params).not.toHaveProperty('output_config');
    expect(result.text).toBe('hello world');
    expect(result.json).toBeUndefined();
  });

  it.each([
    ['BadRequestError', new BadRequestError('bad'), 'invalid_request'],
    ['AuthenticationError', new AuthenticationError('key'), 'auth'],
    ['RateLimitError', new RateLimitError('slow down'), 'rate_limit'],
    ['APIConnectionError (subclass of APIError)', new APIConnectionError('offline'), 'network'],
    ['APIError', new APIError('weird'), 'unknown'],
  ])('maps %s to AIAdapterError kind "%s"', async (_label, sdkError, kind) => {
    mockCreate.mockRejectedValue(sdkError);
    const adapter = claudeAdapter({ apiKey: 'k' });
    const err = await adapter.complete({ prompt: 'p' }).catch((e) => e);
    expect(err).toBeInstanceOf(AIAdapterError);
    expect(err.kind).toBe(kind);
    expect(err.cause).toBe(sdkError);
  });

  it('propagates AbortError untouched', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    mockCreate.mockRejectedValue(abortErr);
    const adapter = claudeAdapter({ apiKey: 'k' });
    await expect(adapter.complete({ prompt: 'p' })).rejects.toBe(abortErr);
  });

  it('wraps non-JSON structured output in an AIAdapterError', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] });
    const adapter = claudeAdapter({ apiKey: 'k' });
    const err = await adapter
      .complete({ prompt: 'p', schema: { type: 'object' } })
      .catch((e) => e);
    expect(err).toBeInstanceOf(AIAdapterError);
    expect(err.kind).toBe('unknown');
  });
});
