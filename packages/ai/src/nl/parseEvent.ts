/**
 * NL → event parsing. LLM path (schema-constrained via the adapter) with an
 * automatic deterministic fallback (`parseNaturalEventLocal`) when no adapter
 * is provided or the adapter call fails.
 */
import {
  AIAdapter,
  JSONSchema,
  ParseConfidence,
  ParsedEventResult,
} from '../types';
import { parseNaturalEventLocal } from './localParser';

export interface ParseEventOptions {
  adapter?: AIAdapter;
  /** "Now" used to resolve relative dates ("tomorrow", "terça"). */
  referenceDate?: Date;
  /** IANA timezone the user speaks in, e.g. "Europe/Lisbon". */
  timeZone?: string;
  /** BCP-47 locale of the input, e.g. "pt-BR". */
  locale?: string;
  signal?: AbortSignal;
}

/**
 * Structured-outputs friendly schema: every object carries
 * `additionalProperties: false` + a full `required` list, and there are no
 * min/max/length constraints (unsupported by structured outputs).
 */
export const PARSED_EVENT_SCHEMA: JSONSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'start', 'end', 'allDay', 'confidence', 'missing'],
  properties: {
    title: { type: 'string', description: 'Event title extracted from the input.' },
    start: { type: 'string', description: 'ISO 8601 datetime with timezone offset.' },
    end: { type: 'string', description: 'ISO 8601 datetime with timezone offset.' },
    allDay: { type: 'boolean' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    missing: {
      type: 'array',
      description: "Fields absent from the input, e.g. 'time'.",
      items: { type: 'string' },
    },
  },
};

export function buildParseSystemPrompt(opts: ParseEventOptions): string {
  const now = (opts.referenceDate ?? new Date()).toISOString();
  const timeZone = opts.timeZone ?? 'UTC';
  const locale = opts.locale ?? 'en';
  return [
    'You convert one natural-language sentence into a single calendar event.',
    `Current datetime ("now"): ${now}.`,
    `User timezone: ${timeZone}.`,
    '',
    'CRITICAL DATE RULES:',
    `- "dia 24 de dezembro" = December 24th of the CURRENT year (${new Date().getFullYear()}).`,
    `- "dia 1 de janeiro" = January 1st of the current year.`,
    `- "24/12" or "24-12" = December 24th of the current year.`,
    `- "amanhã"/"tomorrow" = the day after today.`,
    `- "terça"/"terça-feira"/"Tuesday" = next occurrence of that weekday.`,
    `- "hoje"/"today" = today.`,
    '',
    'CRITICAL TIME RULES:',
    `- "às 15h" or "15:00" or "3pm" = 15:00 in 24h format.`,
    `- "dia inteiro"/"all day" = set allDay: true, start at 00:00, end at 23:59.`,
    `- If NO time is mentioned, default to 09:00 and add "time" to missing array.`,
    `- If duration is not mentioned, assume 60 minutes.`,
    '',
    'OUTPUT: Return ISO 8601 datetimes with timezone offset for the user timezone.',
    'The input language is likely "' + locale + '", but detect it if different.',
    'Never invent attendees or locations.',
    '',
    'EXAMPLES:',
    `- "vamos para a praia dia 24 de dezembro" → start: ${new Date().getFullYear()}-12-24T09:00:00, end: ${new Date().getFullYear()}-12-24T10:00:00, allDay: false, missing: ["time"]`,
    `- "reunião amanhã às 14h30" → start: tomorrow at 14:30, end: tomorrow at 15:30, allDay: false, missing: []`,
    `- "dia todo de confraternização" → start: today 00:00, end: today 23:59, allDay: true, missing: []`,
  ].join('\n');
}

interface LLMParsedEvent {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  confidence: ParseConfidence;
  missing: string[];
}

function isValidLLMEvent(json: unknown): json is LLMParsedEvent {
  if (!json || typeof json !== 'object') return false;
  const j = json as Record<string, unknown>;
  return (
    typeof j.title === 'string' &&
    typeof j.start === 'string' &&
    typeof j.end === 'string' &&
    !Number.isNaN(Date.parse(j.start)) &&
    !Number.isNaN(Date.parse(j.end))
  );
}

export async function parseNaturalEvent(
  input: string,
  opts: ParseEventOptions = {}
): Promise<ParsedEventResult> {
  const { adapter } = opts;
  if (!adapter) return parseNaturalEventLocal(input, opts);

  try {
    const result = await adapter.complete({
      system: buildParseSystemPrompt(opts),
      prompt: input,
      schema: PARSED_EVENT_SCHEMA,
      maxTokens: 2048,
      signal: opts.signal,
    });
    const json = result.json;
    if (!isValidLLMEvent(json)) {
      return parseNaturalEventLocal(input, opts);
    }
    const missing = Array.isArray(json.missing)
      ? json.missing.filter((m): m is string => typeof m === 'string')
      : [];
    const confidence: ParseConfidence =
      json.confidence === 'high' || json.confidence === 'medium' || json.confidence === 'low'
        ? json.confidence
        : 'medium';
    return {
      event: {
        title: json.title,
        start: new Date(json.start).toISOString(),
        end: new Date(json.end).toISOString(),
        allDay: json.allDay === true,
      },
      confidence,
      ...(missing.length ? { missing } : {}),
      raw: input,
    };
  } catch (err) {
    // Aborts propagate; every other failure degrades to the local parser.
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return parseNaturalEventLocal(input, opts);
  }
}

export { parseNaturalEventLocal };
