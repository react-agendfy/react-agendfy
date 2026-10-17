/**
 * NL Event Editing — parse natural-language edit/delete/reschedule requests.
 *
 * Examples:
 *   "muda a reunião das 15h para as 16h"
 *   "cancela a reunião de amanhã"
 *   "renomeia a reunião do projeto para Sprint Review"
 *   "move a reunião com Pedro para sexta"
 */
import {
  AIAdapter,
  AgendfyEvent,
  EditAction,
  EventEditResult,
  ParseConfidence,
} from '../types';

export interface ParseEditOptions {
  adapter?: AIAdapter;
  /** Existing events to match against. */
  events: AgendfyEvent[];
  referenceDate?: Date;
  timeZone?: string;
  locale?: string;
  signal?: AbortSignal;
}

const EDIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['action', 'eventId', 'confidence'],
  properties: {
    action: { type: 'string', enum: ['update', 'delete', 'reschedule', 'rename'] },
    eventId: { type: 'string', description: 'The id of the target event.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    updates: {
      type: 'object',
      description: 'Fields to change (only for update/reschedule/rename).',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'ISO 8601 datetime.' },
        end: { type: 'string', description: 'ISO 8601 datetime.' },
      },
    },
  },
};

function buildEditSystemPrompt(opts: ParseEditOptions): string {
  const now = (opts.referenceDate ?? new Date()).toISOString();
  const timeZone = opts.timeZone ?? 'UTC';
  const locale = opts.locale ?? 'pt-BR';

  const eventList = opts.events
    .map((e) => `- id="${e.id}" title="${e.title}" start="${new Date(e.start).toISOString()}" end="${new Date(e.end).toISOString()}"`)
    .join('\n');

  return [
    'You parse natural-language edit/delete/reschedule requests for calendar events.',
    `Current datetime: ${now}. User timezone: ${timeZone}. Language: ${locale}.`,
    '',
    'AVAILABLE EVENTS:',
    eventList || '(no events)',
    '',
    'ACTIONS:',
    '- "delete"/"cancel"/"remove"/"apaga"/"cancela"/"remove" → action: "delete"',
    '- "move"/"muda"/"troca"/"change" with new time → action: "reschedule"',
    '- "rename"/"renomeia"/"change name"/"muda o nome" → action: "rename"',
    '- "update"/"edit"/"edita" with other field changes → action: "update"',
    '',
    'Match the event by title fuzzy match or time reference.',
    'Return ONLY the JSON with the action, eventId, and any updates.',
    'For reschedule, compute the new start/end ISO datetimes.',
    'If no matching event is found, set confidence to "low" and explain in a "reason" field.',
  ].join('\n');
}

/** Fallback: simple keyword-based edit detection (no LLM). */
function localParseEdit(
  input: string,
  events: AgendfyEvent[]
): EventEditResult | null {
  const lower = input.toLowerCase();

  // Detect action
  let action: EditAction = 'update';
  if (/\b(delete|cancel|remove|apaga|cancela|remove)\b/i.test(lower)) {
    action = 'delete';
  } else if (/\b(move|muda|troca|change|shift)\b/i.test(lower)) {
    action = 'reschedule';
  } else if (/\b(rename|renomeia|muda o nome|change name)\b/i.test(lower)) {
    action = 'rename';
  }

  // Try to find a matching event by title fuzzy match
  let bestMatch: AgendfyEvent | null = null;
  let bestScore = 0;
  for (const event of events) {
    const titleLower = event.title.toLowerCase();
    const words = titleLower.split(/\s+/);
    let score = 0;
    for (const word of words) {
      if (word.length > 2 && lower.includes(word)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = event;
    }
  }

  if (!bestMatch || bestScore === 0) return null;

  return {
    action,
    eventId: bestMatch.id,
    confidence: 'low',
    raw: input,
  };
}

/**
 * Parse a natural-language edit request against existing events.
 * Falls back to keyword matching when no adapter is provided.
 */
export async function parseEditRequest(
  input: string,
  opts: ParseEditOptions
): Promise<EventEditResult | null> {
  // Local fallback when no adapter
  if (!opts.adapter) {
    return localParseEdit(input, opts.events);
  }

  try {
    const result = await opts.adapter.complete({
      system: buildEditSystemPrompt(opts),
      prompt: input,
      schema: EDIT_SCHEMA,
      maxTokens: 1024,
      signal: opts.signal,
    });

    const json = result.json as Record<string, unknown> | undefined;
    if (!json || typeof json.action !== 'string' || typeof json.eventId !== 'string') {
      return localParseEdit(input, opts.events);
    }

    const action = json.action as EditAction;
    const confidence: ParseConfidence =
      json.confidence === 'high' || json.confidence === 'medium' || json.confidence === 'low'
        ? json.confidence
        : 'medium';

    const updates = json.updates as Partial<AgendfyEvent> | undefined;

    return {
      action,
      eventId: json.eventId,
      ...(updates ? { updates } : {}),
      confidence,
      raw: input,
    };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return localParseEdit(input, opts.events);
  }
}
