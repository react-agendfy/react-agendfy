/**
 * Agenda Generation — produce formatted daily/weekly/monthly agendas.
 *
 * Examples:
 *   "o que tenho amanhã?"
 *   "resumo da semana"
 *   "agenda de segunda"
 */
import {
  AIAdapter,
  AgendfyEvent,
  AgendaItem,
  AgendaPeriod,
  AgendaResult,
  CalendarStats,
} from '../types';
import { computeCalendarStats } from '../insights';

export interface GenerateAgendaOptions {
  adapter?: AIAdapter;
  period: AgendaPeriod;
  /** Reference date to compute the period from. */
  referenceDate?: Date;
  timeZone?: string;
  locale?: string;
  signal?: AbortSignal;
}

function getPeriodRange(
  period: AgendaPeriod,
  ref: Date
): { start: Date; end: Date } {
  const d = new Date(ref);
  if (period === 'day') {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const end = new Date(start.getTime() + 86400000 - 1);
    return { start, end };
  }
  if (period === 'week') {
    const dayOfWeek = d.getUTCDay();
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOfWeek));
    const end = new Date(start.getTime() + 7 * 86400000 - 1);
    return { start, end };
  }
  // month
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59));
  return { start, end };
}

function filterEvents(
  events: AgendfyEvent[],
  rangeStart: Date,
  rangeEnd: Date
): AgendfyEvent[] {
  const rs = rangeStart.getTime();
  const re = rangeEnd.getTime();
  return events.filter((e) => {
    const es = new Date(e.start).getTime();
    const ee = new Date(e.end).getTime();
    return es <= re && ee >= rs;
  });
}

function formatTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return `${fmt(start)} - ${fmt(end)}`;
}

function sortEvents(events: AgendfyEvent[]): AgendfyEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}

const AGENDA_SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary'],
  properties: {
    summary: { type: 'string', description: 'A concise prose summary of the agenda.' },
  },
};

function buildAgendaPrompt(
  items: AgendaItem[],
  period: AgendaPeriod,
  stats: CalendarStats,
  locale: string
): string {
  const eventLines = items
    .map((i) => `- ${i.timeRange} (${i.durationMinutes}min): ${i.event.title}`)
    .join('\n');

  return [
    `Generate a ${period} calendar agenda summary in ${locale}.`,
    '',
    `Total events: ${stats.eventCount}. Total meeting hours: ${stats.totalMeetingHours}.`,
    stats.busiestDay ? `Busiest day: ${stats.busiestDay}.` : '',
    '',
    'EVENTS:',
    eventLines || '(no events)',
    '',
    'Write a friendly, concise summary. Mention key events, free time, and busy periods.',
    'Use a natural, conversational tone.',
  ].join('\n');
}

/**
 * Generate an agenda for a given period (day/week/month).
 * Returns sorted items with formatted time ranges, stats, and optional LLM summary.
 */
export async function generateAgenda(
  events: AgendfyEvent[],
  opts: GenerateAgendaOptions
): Promise<AgendaResult> {
  const ref = opts.referenceDate ?? new Date();
  const { start, end } = getPeriodRange(opts.period, ref);
  const filtered = sortEvents(filterEvents(events, start, end));
  const stats = computeCalendarStats(filtered, { timeZone: opts.timeZone });

  const items: AgendaItem[] = filtered.map((e) => {
    const eStart = new Date(e.start);
    const eEnd = new Date(e.end);
    const durationMinutes = Math.round((eEnd.getTime() - eStart.getTime()) / 60000);
    return {
      event: e,
      timeRange: formatTimeRange(eStart, eEnd),
      durationMinutes,
    };
  });

  let summary: string | undefined;
  if (opts.adapter) {
    try {
      const result = await opts.adapter.complete({
        system: `You are a helpful calendar assistant. Current date: ${ref.toISOString()}.`,
        prompt: buildAgendaPrompt(items, opts.period, stats, opts.locale ?? 'pt-BR'),
        schema: AGENDA_SUMMARY_SCHEMA,
        maxTokens: 1024,
        signal: opts.signal,
      });
      const json = result.json as { summary?: string } | undefined;
      summary = json?.summary;
    } catch {
      // Graceful degradation: no summary
    }
  }

  return {
    period: opts.period,
    dateStart: start.toISOString(),
    dateEnd: end.toISOString(),
    items,
    summary,
    stats,
  };
}
