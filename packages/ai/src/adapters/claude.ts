/**
 * Claude adapter — the ONLY file in this package that touches the official
 * `@anthropic-ai/sdk`. The SDK is an OPTIONAL peer dependency, loaded lazily
 * via a runtime dynamic import so consumers using other adapters never need
 * it installed.
 *
 * ⚠️ BROWSER USAGE WARNING ⚠️
 * Passing `dangerouslyAllowBrowser: true` ships your Anthropic API key to the
 * browser where anyone can read it. That mode is for local development/demos
 * ONLY. In production, use `httpAdapter` pointed at your own backend proxy —
 * the proxy holds the API key and calls Anthropic server-side.
 *
 * Current Anthropic API rules this adapter follows (claude-opus-4-8):
 *  - Structured outputs via `output_config: { format: { type: "json_schema",
 *    schema } }` — NOT the deprecated top-level `output_format`.
 *  - No assistant-message prefills (they 400 on current models).
 *  - No `temperature` / `top_p` / `top_k` (removed on opus-4-8; sending them
 *    400s).
 *  - No `thinking` parameter — omitted on purpose: these are short extraction
 *    calls and opus-4-8 runs without thinking when the field is absent. (If
 *    thinking were ever wanted, the only valid value is `{type: "adaptive"}`;
 *    `budget_tokens` is rejected.)
 *  - Content blocks are a discriminated union: narrow on `.type === "text"`
 *    before reading `.text`.
 */
import {
  AIAdapter,
  AIAdapterError,
  AICompletionRequest,
  AICompletionResult,
} from '../types';

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-4-8';
const DEFAULT_MAX_TOKENS = 2048;

export interface ClaudeAdapterOptions {
  /** API key. Falls back to the SDK's own env resolution when omitted. */
  apiKey?: string;
  /** Model id override. Default: `"claude-opus-4-8"`. */
  model?: string;
  /**
   * DEV ONLY — exposes the API key to the browser. Production should use
   * `httpAdapter` against a backend proxy instead. See file header.
   */
  dangerouslyAllowBrowser?: boolean;
  /** Default max_tokens when the request does not specify one (2048). */
  defaultMaxTokens?: number;
}

/* Minimal structural typing of the SDK surface we use. We deliberately do
 * NOT ship a `declare module '@anthropic-ai/sdk'` shim: it would collide
 * with the real SDK types for consumers that install it. The dynamic import
 * below uses a variable specifier, which TypeScript does not statically
 * check — so the package typechecks and builds with or without the SDK. */
interface AnthropicMessageResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}
interface AnthropicClientLike {
  messages: {
    create(
      params: Record<string, unknown>,
      opts?: { signal?: AbortSignal }
    ): Promise<AnthropicMessageResponse>;
  };
}
type AnthropicCtor = (new (opts: {
  apiKey?: string;
  dangerouslyAllowBrowser?: boolean;
}) => AnthropicClientLike) & {
  BadRequestError?: new (...args: any[]) => Error;
  AuthenticationError?: new (...args: any[]) => Error;
  RateLimitError?: new (...args: any[]) => Error;
  APIConnectionError?: new (...args: any[]) => Error;
  APIError?: new (...args: any[]) => Error;
};

let ctorPromise: Promise<AnthropicCtor> | null = null;

async function loadAnthropic(): Promise<AnthropicCtor> {
  if (!ctorPromise) {
    // Variable specifier: kept out of static analysis on purpose — the SDK
    // is optional and must never become a hard bundle/type dependency.
    const specifier = '@anthropic-ai/sdk';
    ctorPromise = import(/* @vite-ignore */ specifier)
      .then((mod: any) => (mod?.default ?? mod) as AnthropicCtor)
      .catch((err) => {
        ctorPromise = null;
        throw new AIAdapterError(
          'unknown',
          "claudeAdapter requires the optional peer dependency '@anthropic-ai/sdk'. " +
            'Install it (`npm i @anthropic-ai/sdk`) or use httpAdapter/customAdapter instead.',
          err
        );
      });
  }
  return ctorPromise;
}

/** Exposed for tests only. */
export function __resetClaudeAdapterModuleCache(): void {
  ctorPromise = null;
}

function isInstance(err: unknown, Ctor?: new (...args: any[]) => Error): boolean {
  return typeof Ctor === 'function' && err instanceof Ctor;
}

/**
 * Map SDK errors to the vendor-neutral {@link AIAdapterError}. Ordered
 * most-specific first; `APIConnectionError` is checked BEFORE `APIError`
 * because in the TS SDK it is a subclass of `APIError`.
 */
function mapError(err: unknown, Anthropic: AnthropicCtor): AIAdapterError {
  const message = err instanceof Error ? err.message : String(err);
  if (isInstance(err, Anthropic.BadRequestError)) {
    return new AIAdapterError('invalid_request', message, err);
  }
  if (isInstance(err, Anthropic.AuthenticationError)) {
    return new AIAdapterError('auth', message, err);
  }
  if (isInstance(err, Anthropic.RateLimitError)) {
    return new AIAdapterError('rate_limit', message, err);
  }
  if (isInstance(err, Anthropic.APIConnectionError)) {
    return new AIAdapterError('network', message, err);
  }
  if (isInstance(err, Anthropic.APIError)) {
    return new AIAdapterError('unknown', message, err);
  }
  return new AIAdapterError('unknown', message, err);
}

/**
 * Create an {@link AIAdapter} backed by the official Anthropic TypeScript SDK.
 */
export function claudeAdapter(options: ClaudeAdapterOptions = {}): AIAdapter {
  const model = options.model ?? DEFAULT_CLAUDE_MODEL;
  let client: AnthropicClientLike | null = null;

  return {
    async complete(req: AICompletionRequest): Promise<AICompletionResult> {
      const Anthropic = await loadAnthropic();
      if (!client) {
        client = new Anthropic({
          apiKey: options.apiKey,
          dangerouslyAllowBrowser: options.dangerouslyAllowBrowser,
        });
      }

      const params: Record<string, unknown> = {
        model,
        max_tokens: req.maxTokens ?? options.defaultMaxTokens ?? DEFAULT_MAX_TOKENS,
        messages: [{ role: 'user', content: req.prompt }],
      };
      if (req.system) params.system = req.system;
      if (req.schema) {
        // Structured outputs (current API): output_config.format.json_schema.
        params.output_config = {
          format: { type: 'json_schema', schema: req.schema },
        };
      }

      let response: AnthropicMessageResponse;
      try {
        response = await client.messages.create(params, { signal: req.signal });
      } catch (err) {
        // Let aborts propagate untouched so callers can distinguish them.
        if (err instanceof Error && err.name === 'AbortError') throw err;
        throw mapError(err, Anthropic);
      }

      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('');

      const usage = response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          }
        : undefined;

      if (req.schema) {
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch (err) {
          throw new AIAdapterError(
            'unknown',
            'Claude returned non-JSON output for a schema-constrained request.',
            err
          );
        }
        return { text, json, usage };
      }
      return { text, usage };
    },
  };
}
