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
    `User timezone: ${timeZone}. Resolve every relative date/time expression`,
    '("tomorrow", "next Tuesday 3pm", "terça às 15h") against that "now" in',
    'that timezone, and return ISO 8601 datetimes including the correct offset.',
    `The input language is likely "${locale}", but detect it if different.`,
    'If no duration is given, assume 60 minutes. If no time of day is given,',
    "use 09:00 and add 'time' to missing. Never invent attendees or locations.",
  ].join(' ');
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
