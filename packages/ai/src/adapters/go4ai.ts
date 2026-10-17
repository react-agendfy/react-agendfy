/**
 * GO4AI adapter — connects to any OpenAI-compatible API endpoint.
 *
 * GO4AI (https://ai.go4ai.io) provides a unified gateway to multiple LLM
 * providers using the OpenAI chat completions API format.
 *
 * ⚠️ BROWSER USAGE WARNING ⚠️
 * Passing `dangerouslyAllowBrowser: true` ships your API key to the
 * browser where anyone can read it. That mode is for local development/demos
 * ONLY. In production, use `httpAdapter` pointed at your own backend proxy.
 */
import {
  AIAdapter,
  AIAdapterError,
  AICompletionRequest,
  AICompletionResult,
} from '../types';

export const DEFAULT_GO4AI_MODEL = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
const DEFAULT_MAX_TOKENS = 2048;

export interface Go4AIAdapterOptions {
  /** API key for GO4AI. */
  apiKey: string;
  /** Base URL override. Default: `"https://ai.go4ai.io/v1"`. */
  baseUrl?: string;
  /** Model id override. */
  model?: string;
  /**
   * DEV ONLY — exposes the API key to the browser. Production should use
   * `httpAdapter` against a backend proxy instead.
   */
  dangerouslyAllowBrowser?: boolean;
  /** Default max_tokens when the request does not specify one (2048). */
  defaultMaxTokens?: number;
}

interface OpenAIChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

function kindFromStatus(status: number): 'auth' | 'rate_limit' | 'invalid_request' | 'unknown' {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (status >= 400 && status < 500) return 'invalid_request';
  return 'unknown';
}

/**
 * Create an {@link AIAdapter} backed by any OpenAI-compatible API (GO4AI, OpenAI, etc.).
 */
export function go4aiAdapter(options: Go4AIAdapterOptions): AIAdapter {
  if (!options?.apiKey) {
    throw new AIAdapterError('invalid_request', 'go4aiAdapter requires an apiKey.');
  }

  const baseUrl = (options.baseUrl ?? 'https://ai.go4ai.io/v1').replace(/\/+$/, '');
  const model = options.model ?? DEFAULT_GO4AI_MODEL;

  return {
    async complete(req: AICompletionRequest): Promise<AICompletionResult> {
      const messages: Array<{ role: string; content: string }> = [];

      if (req.system) {
        messages.push({ role: 'system', content: req.system });
      }
      messages.push({ role: 'user', content: req.prompt });

      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: req.maxTokens ?? options.defaultMaxTokens ?? DEFAULT_MAX_TOKENS,
      };

      // For structured outputs, append the schema instruction to the prompt
      // (OpenAI-compatible APIs use response_format or tool_choice, but GO4AI
      // may not support those — safest is to instruct the model in the prompt)
      if (req.schema) {
        const schemaInstruction = `\n\nYou MUST respond with valid JSON matching this exact schema:\n${JSON.stringify(req.schema, null, 2)}\n\nReturn ONLY the JSON object, no markdown, no explanation.`;
        messages[messages.length - 1].content += schemaInstruction;
      }

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${options.apiKey}`,
          },
          body: JSON.stringify(body),
          signal: req.signal,
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        throw new AIAdapterError(
          'network',
          `Could not reach GO4AI endpoint at ${baseUrl}.`,
          err
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new AIAdapterError(
          kindFromStatus(response.status),
          `GO4AI responded with HTTP ${response.status}: ${errorText}`
        );
      }

      let data: OpenAIChatResponse;
      try {
        data = await response.json();
      } catch (err) {
        throw new AIAdapterError('unknown', 'GO4AI returned invalid JSON.', err);
      }

      const text = data.choices?.[0]?.message?.content ?? '';

      const usage = data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          }
        : undefined;

      if (req.schema) {
        let json: unknown;
        try {
          // Try to extract JSON from the response (might be wrapped in markdown)
          const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
          const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
          json = JSON.parse(jsonStr);
        } catch (err) {
          throw new AIAdapterError(
            'unknown',
            'GO4AI returned non-JSON output for a schema-constrained request.',
            err
          );
        }
        return { text, json, usage };
      }
      return { text, usage };
    },
  };
}
