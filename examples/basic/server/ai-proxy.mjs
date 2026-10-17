/**
 * AI proxy for local testing of @react-agendfy/ai with GO4AI.
 *
 * Security model: the API credentials live HERE (server-side), never in
 * the browser. The calendar app talks to this proxy via httpAdapter — the
 * exact production pattern, shrunk to one file.
 *
 * Run:   GO4AI_API_KEY=sk-... node server/ai-proxy.mjs
 * Then:  VITE_AI_PROXY=http://localhost:8787/ai yarn dev
 *
 * Contract (matches httpAdapter in @react-agendfy/ai):
 *   POST /ai  { system?, prompt, schema?, maxTokens? }
 *   → 200     { text?, json?, usage: { inputTokens, outputTokens } }
 */
import http from 'node:http';

const PORT = process.env.AI_PROXY_PORT ? Number(process.env.AI_PROXY_PORT) : 8787;
const MODEL = process.env.AI_PROXY_MODEL || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
const BASE_URL = (process.env.GO4AI_BASE_URL || 'https://ai.go4ai.io/v1').replace(/\/+$/, '');
const API_KEY = process.env.GO4AI_API_KEY;

if (!API_KEY) {
  console.error('[ai-proxy] GO4AI_API_KEY is not set. Export it and restart.');
  process.exit(1);
}

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

  const messages = [];
  if (system) {
    messages.push({ role: 'system', content: system });
  }
  messages.push({ role: 'user', content: prompt });

  const body = {
    model: MODEL,
    messages,
    max_tokens: typeof maxTokens === 'number' ? maxTokens : 2048,
  };

  // For structured outputs, append schema instruction to the prompt
  if (schema) {
    const schemaInstruction = `\n\nYou MUST respond with valid JSON matching this exact schema:\n${JSON.stringify(schema, null, 2)}\n\nReturn ONLY the JSON object, no markdown, no explanation.`;
    messages[messages.length - 1].content += schemaInstruction;
  }

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[ai-proxy] GO4AI error ${response.status}:`, errorText);
      return send(res, response.status >= 400 && response.status < 500 ? response.status : 502, {
        error: `GO4AI responded with HTTP ${response.status}: ${errorText}`,
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';

    let json;
    if (schema) {
      try {
        // Try to extract JSON from the response (might be wrapped in markdown)
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
        json = JSON.parse(jsonStr);
      } catch {
        return send(res, 502, { error: 'Model output did not parse as JSON.' });
      }
    }

    return send(res, 200, {
      text,
      ...(json !== undefined ? { json } : {}),
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          }
        : undefined,
    });
  } catch (err) {
    console.error('[ai-proxy]', err);
    return send(res, 500, { error: 'Unexpected proxy error.' });
  }
});

server.listen(PORT, () => {
  console.log(`[ai-proxy] listening on http://localhost:${PORT}/ai`);
  console.log(`[ai-proxy] model: ${MODEL}`);
  console.log(`[ai-proxy] endpoint: ${BASE_URL}`);
  console.log(`[ai-proxy] credentials: GO4AI_API_KEY — first request will fail with 401 if not set.`);
});
