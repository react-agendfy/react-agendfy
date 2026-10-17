/**
 * Batch Event Parsing — parse multiple events from a single NL input.
 *
 * Examples:
 *   "standup diário às 9h, 1:1 com Pedro quarta às 14h"
 *   "reunião de projeto segunda às 10h, review de código terça às 15h"
 */
import {
  AIAdapter,
  BatchParseResult,
  ParseConfidence,
  ParsedEventResult,
} from '../types';
import { parseNaturalEvent, parseNaturalEventLocal } from '../nl/parseEvent';
import { ParseEventOptions } from '../nl/parseEvent';

export interface BatchParseOptions extends ParseEventOptions {
  adapter?: AIAdapter;
}

const BATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['events'],
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'string',
        description: 'Each individual event description extracted from the input.',
      },
    },
  },
};

function buildBatchSystemPrompt(opts: ParseEventOptions): string {
  const now = (opts.referenceDate ?? new Date()).toISOString();
  const timeZone = opts.timeZone ?? 'UTC';
  const locale = opts.locale ?? 'pt-BR';
  return [
    'You split a natural-language input into multiple individual event descriptions.',
    `Current datetime: ${now}. Timezone: ${timeZone}. Language: ${locale}.`,
    '',
    'RULES:',
    '- Extract each distinct event as a separate string.',
    '- Preserve all details (time, date, duration, title) in each string.',
    '- If the input describes only one event, return it as a single-item array.',
    '- Do NOT merge or combine events.',
    '- Each string should be a complete, self-contained event description.',
    '',
    'EXAMPLES:',
    '- "standup às 9h e 1:1 com Pedro às 14h" → ["standup às 9h", "1:1 com Pedro às 14h"]',
    '- "reunião segunda às 10h, review terça às 15h" → ["reunião segunda às 10h", "review terça às 15h"]',
  ].join('\n');
}

/** Local fallback: split by common separators. */
function localBatchSplit(input: string): string[] {
  // Split by commas, "e"/"and", semicolons
  const parts = input
    .split(/[,;]\s*|\s+e\s+|\s+and\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
  return parts.length > 0 ? parts : [input];
}

/**
 * Parse multiple events from a single NL input.
 * Splits the input first, then parses each part individually.
 */
export async function parseMultipleEvents(
  input: string,
  opts: BatchParseOptions = {}
): Promise<BatchParseResult> {
  let parts: string[];

  if (opts.adapter) {
    try {
      const result = await opts.adapter.complete({
        system: buildBatchSystemPrompt(opts),
        prompt: input,
        schema: BATCH_SCHEMA,
        maxTokens: 1024,
        signal: opts.signal,
      });
      const json = result.json as { events?: string[] } | undefined;
      parts = json?.events?.length ? json.events : localBatchSplit(input);
    } catch {
      parts = localBatchSplit(input);
    }
  } else {
    parts = localBatchSplit(input);
  }

  const events: ParsedEventResult[] = [];
  const failed: Array<{ input: string; error: string }> = [];

  for (const part of parts) {
    try {
      const result = await parseNaturalEvent(part, opts);
      events.push(result);
    } catch (err) {
      failed.push({
        input: part,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { events, failed };
}
