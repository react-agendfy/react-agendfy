/**
 * HTTP adapter — the RECOMMENDED production adapter.
 *
 * POSTs `{ system, prompt, schema, maxTokens }` as JSON to an endpoint YOU
 * control (typically your own backend proxy that holds the LLM API key and
 * calls the provider server-side), and expects `{ text?, json?, usage? }`
 * back. Zero dependencies; supports AbortSignal, custom headers and a
 * custom fetch implementation.
 */
import {
  AIAdapter,
  AIAdapterError,
  AIAdapterErrorKind,
  AICompletionRequest,
  AICompletionResult,
} from '../types';

export interface HttpAdapterOptions {
  /** Endpoint URL, e.g. "/api/ai". */
  endpoint: string;
  /** Extra request headers (merged over Content-Type: application/json). */
  headers?: Record<string, string>;
  /** Custom fetch implementation (defaults to globalThis.fetch). */
  fetch?: typeof fetch;
}

function kindFromStatus(status: number): AIAdapterErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status >= 400 && status < 500) return 'invalid_request';
  return 'unknown';
}

export function httpAdapter(options: HttpAdapterOptions): AIAdapter {
  if (!options?.endpoint) {
    throw new AIAdapterError('invalid_request', 'httpAdapter requires an endpoint.');
  }

  return {
    async complete(req: AICompletionRequest): Promise<AICompletionResult> {
      const fetchImpl = options.fetch ?? globalThis.fetch;
      if (typeof fetchImpl !== 'function') {
        throw new AIAdapterError('unknown', 'No fetch implementation available.');
      }

      let response: Response;
      try {
        response = await fetchImpl(options.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...options.headers },
          body: JSON.stringify({
            system: req.system,
            prompt: req.prompt,
            schema: req.schema,
            maxTokens: req.maxTokens,
          }),
          signal: req.signal,
        });
      } catch (err) {
        // Aborts propagate untouched; anything else is a network failure.
        if (err instanceof Error && err.name === 'AbortError') throw err;
        throw new AIAdapterError(
          'network',
          `Could not reach AI endpoint ${options.endpoint}.`,
          err
        );
      }

      if (!response.ok) {
        throw new AIAdapterError(
          kindFromStatus(response.status),
          `AI endpoint ${options.endpoint} responded with HTTP ${response.status}.`
        );
      }

      let data: { text?: string; json?: unknown; usage?: AICompletionResult['usage'] };
      try {
        data = await response.json();
      } catch (err) {
        throw new AIAdapterError('unknown', 'AI endpoint returned invalid JSON.', err);
      }

      return { text: data.text, json: data.json, usage: data.usage };
    },
  };
}
