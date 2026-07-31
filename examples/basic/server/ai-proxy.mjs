/**
 * Minimal AI proxy for local testing of @react-agendfy/ai.
 *
 * Security model: the Anthropic credentials live HERE (server-side), never in
 * the browser. The calendar app talks to this proxy via httpAdapter — the
 * exact production pattern, shrunk to one file.
 *
 * Run:   ANTHROPIC_API_KEY=sk-ant-... node server/ai-proxy.mjs
 *        (or with an active `ant auth login` profile, just: node server/ai-proxy.mjs)
 * Then:  VITE_AI_PROXY=http://localhost:8787/ai yarn dev
 *
 * Contract (matches httpAdapter in @react-agendfy/ai):
 *   POST /ai  { system?, prompt, schema?, maxTokens? }
 *   → 200     { text?, json?, usage: { inputTokens, outputTokens } }
 */
import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.AI_PROXY_PORT ? Number(process.env.AI_PROXY_PORT) : 8787;
const MODEL = process.env.AI_PROXY_MODEL || 'claude-opus-4-8';

// Zero-arg client: resolves ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an
// `ant auth login` profile from the environment.
const client = new Anthropic();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST' || !req.url?.startsWith('/ai')) {
    return send(res, 404, { error: 'POST /ai only' });
  }

  let payload;
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return send(res, 400, { error: 'Invalid JSON body' });
  }

  const { system, prompt, schema, maxTokens } = payload ?? {};
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return send(res, 400, { error: 'Missing "prompt"' });
  }

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: typeof maxTokens === 'number' ? maxTokens : 2048,
      ...(system ? { system } : {}),
      // Structured outputs when the adapter sends a JSON schema — the
      // response text is then guaranteed to parse against it.
      ...(schema
        ? { output_config: { format: { type: 'json_schema', schema } } }
        : {}),
      messages: [{ role: 'user', content: prompt }],
    });

    if (response.stop_reason === 'refusal') {
      return send(res, 502, { error: 'Model declined the request (refusal).' });
    }

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    let json;
    if (schema) {
      try {
        json = JSON.parse(text);
      } catch {
        return send(res, 502, { error: 'Model output did not parse as JSON.' });
      }
    }

    return send(res, 200, {
      text,
      ...(json !== undefined ? { json } : {}),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (err) {
    // Typed SDK errors → clean status codes for httpAdapter's error mapping.
    if (
      err instanceof Error &&
      /authentication method|apiKey or authToken/i.test(err.message)
    ) {
      // Client-side credential resolution failed (no key/profile at all).
      return send(res, 401, {
        error:
          'No Anthropic credentials found. Export ANTHROPIC_API_KEY (or run `ant auth login`) and restart the proxy.',
      });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return send(res, 401, {
        error:
          'No valid Anthropic credentials. Export ANTHROPIC_API_KEY or run `ant auth login`, then restart the proxy.',
      });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return send(res, 429, { error: 'Rate limited — retry shortly.' });
    }
    if (err instanceof Anthropic.BadRequestError) {
      return send(res, 400, { error: `Invalid request: ${err.message}` });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return send(res, 502, { error: 'Could not reach the Anthropic API.' });
    }
    console.error('[ai-proxy]', err);
    return send(res, 500, { error: 'Unexpected proxy error.' });
  }
});

server.listen(PORT, () => {
  console.log(`[ai-proxy] listening on http://localhost:${PORT}/ai (model: ${MODEL})`);
  console.log(
    '[ai-proxy] credentials: ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / ant profile — first request will fail with 401 if none is available.'
  );
});
