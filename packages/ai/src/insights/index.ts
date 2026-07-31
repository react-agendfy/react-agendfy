/**
 * Calendar insights.
 *
 * DESIGN RULE: all NUMBERS (hours, counts, busiest day) are computed
 * deterministically by `computeCalendarStats`. The LLM is used only for the
 * prose summary — and the computed stats are embedded in its prompt so it
 * cannot hallucinate figures. With no adapter (or on failure) a plain
 * deterministic template summary is returned instead.
 */
import {
  AgendfyEvent,
  AIAdapter,
  CalendarInsights,
  CalendarStats,
  JSONSchema,
} from '../types';

/* -------------------------------------------------------------------------- */
/* Deterministic stats                                                        */
/* -------------------------------------------------------------------------- */

function toMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function dayKey(ms: number, timeZone: string): string {
  // en-CA yields "yyyy-MM-dd".
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

export interface StatsOptions {
  timeZone?: string;
}

export function computeCalendarStats(
  events: AgendfyEvent[],
  opts: StatsOptions = {}
): CalendarStats {
  const timeZone = opts.timeZone ?? 'UTC';
  const perDayHours: Record<string, number> = {};
  let totalMs = 0;

  for (const event of events) {
    const s = toMs(event.start);
    const en = toMs(event.end);
    if (!Number.isFinite(s) || !Number.isFinite(en) || en <= s) continue;
    if (event.allDay) continue; // all-day entries are not "meeting hours"
    totalMs += en - s;
    const key = dayKey(s, timeZone);
    perDayHours[key] = (perDayHours[key] ?? 0) + (en - s) / 3600_000;
  }

  for (const key of Object.keys(perDayHours)) {
    perDayHours[key] = Math.round(perDayHours[key] * 100) / 100;
  }

  let busiestDay: string | undefined;
  for (const [key, hours] of Object.entries(perDayHours)) {
    if (
      busiestDay === undefined ||
      hours > perDayHours[busiestDay] ||
      (hours === perDayHours[busiestDay] && key < busiestDay)
    ) {
      busiestDay = key;
    }
  }

  return {
    eventCount: events.length,
    totalMeetingHours: Math.round((totalMs / 3600_000) * 100) / 100,
    ...(busiestDay !== undefined ? { busiestDay } : {}),
    perDayHours,
  };
}

/* -------------------------------------------------------------------------- */
/* summarizeCalendar — deterministic numbers, LLM prose                       */
/* -------------------------------------------------------------------------- */

export interface SummarizeOptions {
  adapter?: AIAdapter;
  /** Human label for the period being summarized, e.g. "this week". */
  period?: string;
  locale?: string;
  timeZone?: string;
  signal?: AbortSignal;
}

function deterministicSummary(stats: CalendarStats, period?: string): string {
  const span = period ? ` ${period}` : '';
  if (stats.eventCount === 0) return `No events scheduled${span}.`;
  const busiest = stats.busiestDay ? ` Busiest day: ${stats.busiestDay}.` : '';
  return (
    `You have ${stats.eventCount} event${stats.eventCount === 1 ? '' : 's'}${span}, ` +
    `totaling ${stats.totalMeetingHours} meeting hour${stats.totalMeetingHours === 1 ? '' : 's'}.` +
    busiest
  );
}

export async function summarizeCalendar(
  events: AgendfyEvent[],
  opts: SummarizeOptions = {}
): Promise<CalendarInsights> {
  const stats = computeCalendarStats(events, { timeZone: opts.timeZone });
  const base: CalendarInsights = {
    summary: deterministicSummary(stats, opts.period),
    busiestDay: stats.busiestDay,
    totalMeetingHours: stats.totalMeetingHours,
    eventCount: stats.eventCount,
  };
  if (!opts.adapter) return base;

  try {
    const titles = events.slice(0, 50).map((e) => e.title).join('; ');
    const result = await opts.adapter.complete({
      system: [
        'You write short calendar summaries. Use ONLY the pre-computed',
        'statistics provided — never invent or recompute numbers.',
        `Respond in locale "${opts.locale ?? 'en'}", 2-3 sentences, plain text.`,
      ].join(' '),
      prompt: [
        `Period: ${opts.period ?? 'upcoming'}.`,
        `Statistics (authoritative): ${JSON.stringify(stats)}.`,
        `Event titles: ${titles || '(none)'}.`,
        'Write the summary.',
      ].join('\n'),
      maxTokens: 4096,
      signal: opts.signal,
    });
    const summary = result.text?.trim();
    return summary ? { ...base, summary } : base;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return base; // graceful degradation to the deterministic summary
  }
}

/* -------------------------------------------------------------------------- */
/* categorizeEvents — schema-constrained id → category mapping                */
/* -------------------------------------------------------------------------- */

export interface CategorizeOptions {
  adapter: AIAdapter;
  categories: string[];
  signal?: AbortSignal;
}

export function buildCategorizeSchema(categories: string[]): JSONSchema {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['assignments'],
    properties: {
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'category'],
          properties: {
            id: { type: 'string' },
            category: { type: 'string', enum: categories },
          },
        },
      },
    },
  };
}

export async function categorizeEvents(
  events: AgendfyEvent[],
  opts: CategorizeOptions
): Promise<Record<string, string>> {
  if (events.length === 0 || opts.categories.length === 0) return {};

  const result = await opts.adapter.complete({
    system:
      'Assign each calendar event to exactly one of the allowed categories ' +
      'based on its title. Return one assignment per event id.',
    prompt: [
      `Allowed categories: ${opts.categories.join(', ')}.`,
      'Events:',
      ...events.map((e) => `- id=${e.id} title=${JSON.stringify(e.title)}`),
    ].join('\n'),
    schema: buildCategorizeSchema(opts.categories),
    maxTokens: 2048,
    signal: opts.signal,
  });

  const knownIds = new Set(events.map((e) => e.id));
  const allowed = new Set(opts.categories);
  const mapping: Record<string, string> = {};
  const assignments = (result.json as { assignments?: unknown })?.assignments;
  if (Array.isArray(assignments)) {
    for (const entry of assignments) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as any).id === 'string' &&
        typeof (entry as any).category === 'string' &&
        knownIds.has((entry as any).id) &&
        allowed.has((entry as any).category)
      ) {
        mapping[(entry as any).id] = (entry as any).category;
      }
    }
  }
  return mapping;
}
