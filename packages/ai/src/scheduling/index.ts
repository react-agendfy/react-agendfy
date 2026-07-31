/**
 * Smart scheduling.
 *
 * DESIGN RULE — "the LLM interprets, algorithms decide":
 * `detectConflicts` and `findFreeSlots` are pure deterministic functions and
 * never touch an LLM. The only LLM-assisted entry point is
 * `suggestSchedulingTimes`, which uses the adapter EXCLUSIVELY to translate a
 * natural-language request into machine constraints (duration + window); the
 * actual slots always come from the deterministic `findFreeSlots`.
 */
import {
  AgendfyEvent,
  AIAdapter,
  BusinessHours,
  ConflictReport,
  FreeSlot,
  JSONSchema,
  SchedulingConstraints,
  SchedulingSuggestion,
} from '../types';

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function toMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function resourceIdsOf(event: AgendfyEvent): string[] {
  const ids: string[] = [];
  if (event.resourceId != null) ids.push(String(event.resourceId));
  if (Array.isArray(event.resourceIds)) {
    for (const id of event.resourceIds) ids.push(String(id));
  }
  return ids;
}

function sharedResource(a: AgendfyEvent, b: AgendfyEvent): string | undefined {
  const setA = new Set(resourceIdsOf(a));
  for (const id of resourceIdsOf(b)) {
    if (setA.has(id)) return id;
  }
  return undefined;
}

/** UTC-ms for a wall-clock (y, m, d, h, min) in `timeZone` (Intl-based). */
function zonedTimeToUtcMs(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number,
  timeZone: string
): number {
  const target = Date.UTC(y, m, d, h, min);
  let ms = target;
  // Two passes converge for all fixed-offset and DST cases.
  for (let i = 0; i < 2; i++) {
    ms = target - (wallClockUtcMs(ms, timeZone) - ms);
  }
  return ms;
}

/** The wall-clock reading of `ms` in `timeZone`, re-encoded as UTC ms. */
function wallClockUtcMs(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
}

function zonedDateParts(ms: number, timeZone: string): { y: number; m: number; d: number } {
  const wall = new Date(wallClockUtcMs(ms, timeZone));
  return { y: wall.getUTCFullYear(), m: wall.getUTCMonth(), d: wall.getUTCDate() };
}

function parseHHmm(value: string): { h: number; min: number } {
  const [h, min] = value.split(':').map((v) => parseInt(v, 10));
  return { h: h || 0, min: min || 0 };
}

/* -------------------------------------------------------------------------- */
/* detectConflicts — deterministic                                            */
/* -------------------------------------------------------------------------- */

export interface DetectConflictsOptions {
  timeZone?: string;
}

export function detectConflicts(
  events: AgendfyEvent[],
  _opts: DetectConflictsOptions = {}
): ConflictReport[] {
  const timed = events
    .map((e) => ({ e, s: toMs(e.start), en: toMs(e.end) }))
    .filter((x) => Number.isFinite(x.s) && Number.isFinite(x.en) && x.en > x.s)
    .sort((a, b) => a.s - b.s || a.en - b.en);

  const reports: ConflictReport[] = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      // Sorted by start: once b starts at/after a's end, no later b overlaps a.
      if (timed[j].s >= timed[i].en) break;
      const a = timed[i];
      const b = timed[j];
      const resourceId = sharedResource(a.e, b.e);
      reports.push({
        type: resourceId != null ? 'resource-double-booking' : 'overlap',
        eventIds: [a.e.id, b.e.id],
        ...(resourceId != null ? { resourceId } : {}),
        overlapStart: new Date(Math.max(a.s, b.s)).toISOString(),
        overlapEnd: new Date(Math.min(a.en, b.en)).toISOString(),
      });
    }
  }
  return reports;
}

/* -------------------------------------------------------------------------- */
/* findFreeSlots — deterministic                                              */
/* -------------------------------------------------------------------------- */

export interface FindFreeSlotsOptions {
  rangeStart: Date | string;
  rangeEnd: Date | string;
  durationMinutes: number;
  /** Restrict slots to a daily window (interpreted in `timeZone`, UTC default). */
  businessHours?: BusinessHours;
  timeZone?: string;
  /** Cap on returned slots (default 50). */
  maxSlots?: number;
}

export function findFreeSlots(
  events: AgendfyEvent[],
  opts: FindFreeSlotsOptions
): FreeSlot[] {
  const rangeStart = toMs(opts.rangeStart);
  const rangeEnd = toMs(opts.rangeEnd);
  const durationMs = Math.max(1, opts.durationMinutes) * 60_000;
  const maxSlots = opts.maxSlots ?? 50;
  const timeZone = opts.timeZone ?? 'UTC';
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) {
    return [];
  }

  // Merge busy intervals clipped to the range (all-day events count as busy).
  const busy = events
    .map((e) => ({ s: toMs(e.start), en: toMs(e.end) }))
    .filter((x) => Number.isFinite(x.s) && Number.isFinite(x.en) && x.en > x.s)
    .map((x) => ({ s: Math.max(x.s, rangeStart), en: Math.min(x.en, rangeEnd) }))
    .filter((x) => x.en > x.s)
    .sort((a, b) => a.s - b.s);
  const merged: Array<{ s: number; en: number }> = [];
  for (const b of busy) {
    const last = merged[merged.length - 1];
    if (last && b.s <= last.en) last.en = Math.max(last.en, b.en);
    else merged.push({ ...b });
  }

  // Candidate windows: whole range, or one business-hours window per day.
  const windows: Array<{ s: number; en: number }> = [];
  if (!opts.businessHours) {
    windows.push({ s: rangeStart, en: rangeEnd });
  } else {
    const open = parseHHmm(opts.businessHours.start);
    const close = parseHHmm(opts.businessHours.end);
    const { y, m, d } = zonedDateParts(rangeStart, timeZone);
    for (let i = 0; i < 366; i++) {
      const winStart = zonedTimeToUtcMs(y, m, d + i, open.h, open.min, timeZone);
      const winEnd = zonedTimeToUtcMs(y, m, d + i, close.h, close.min, timeZone);
      if (winStart >= rangeEnd) break;
      const s = Math.max(winStart, rangeStart);
      const en = Math.min(winEnd, rangeEnd);
      if (en > s) windows.push({ s, en });
    }
  }

  // Walk each window subtracting merged busy time; keep gaps >= duration.
  const slots: FreeSlot[] = [];
  for (const win of windows) {
    let cursor = win.s;
    for (const b of merged) {
      if (b.en <= win.s) continue;
      if (b.s >= win.en) break;
      if (b.s > cursor) pushGap(cursor, Math.min(b.s, win.en));
      cursor = Math.max(cursor, b.en);
      if (cursor >= win.en) break;
    }
    if (cursor < win.en) pushGap(cursor, win.en);
    if (slots.length >= maxSlots) break;
  }
  return slots.slice(0, maxSlots);

  function pushGap(s: number, en: number): void {
    if (en - s >= durationMs) {
      slots.push({
        start: new Date(s).toISOString(),
        end: new Date(en).toISOString(),
        durationMinutes: Math.floor((en - s) / 60_000),
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/* suggestSchedulingTimes — LLM interprets, findFreeSlots decides             */
/* -------------------------------------------------------------------------- */

export const SCHEDULING_CONSTRAINTS_SCHEMA: JSONSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['durationMinutes', 'earliest', 'latest', 'preferences'],
  properties: {
    durationMinutes: { type: 'integer', description: 'Requested duration in minutes.' },
    earliest: { type: 'string', description: 'ISO 8601 lower bound of the search window.' },
    latest: { type: 'string', description: 'ISO 8601 upper bound of the search window.' },
    preferences: {
      type: 'string',
      description: 'Any soft preferences mentioned (e.g. "mornings"), else empty string.',
    },
  },
};

export interface SuggestSchedulingOptions {
  adapter?: AIAdapter;
  referenceDate?: Date;
  timeZone?: string;
  businessHours?: BusinessHours;
  maxSlots?: number;
  signal?: AbortSignal;
}

function fallbackConstraints(referenceDate: Date): SchedulingConstraints {
  const start = referenceDate.getTime();
  return {
    durationMinutes: 60,
    earliest: new Date(start).toISOString(),
    latest: new Date(start + 7 * 24 * 3600_000).toISOString(),
    preferences: '',
  };
}

export async function suggestSchedulingTimes(
  nlRequest: string,
  events: AgendfyEvent[],
  opts: SuggestSchedulingOptions = {}
): Promise<SchedulingSuggestion> {
  const referenceDate = opts.referenceDate ?? new Date();
  const timeZone = opts.timeZone ?? 'UTC';

  let constraints = fallbackConstraints(referenceDate);
  let source: SchedulingSuggestion['source'] = 'fallback';

  if (opts.adapter) {
    try {
      const result = await opts.adapter.complete({
        system: [
          'Translate a natural-language scheduling request into constraints.',
          `Current datetime ("now"): ${referenceDate.toISOString()}. Timezone: ${timeZone}.`,
          'Return the search window as ISO 8601 datetimes ("this week" = now',
          'until the end of the current week). Default duration: 60 minutes.',
        ].join(' '),
        prompt: nlRequest,
        schema: SCHEDULING_CONSTRAINTS_SCHEMA,
        maxTokens: 2048,
        signal: opts.signal,
      });
      const json = result.json as Partial<SchedulingConstraints> | undefined;
      if (
        json &&
        typeof json.durationMinutes === 'number' &&
        json.durationMinutes > 0 &&
        typeof json.earliest === 'string' &&
        typeof json.latest === 'string' &&
        !Number.isNaN(Date.parse(json.earliest)) &&
        !Number.isNaN(Date.parse(json.latest))
      ) {
        constraints = {
          durationMinutes: Math.round(json.durationMinutes),
          earliest: new Date(json.earliest).toISOString(),
          latest: new Date(json.latest).toISOString(),
          preferences: typeof json.preferences === 'string' ? json.preferences : '',
        };
        source = 'llm';
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      // Adapter failure degrades to the deterministic default window.
    }
  }

  const slots = findFreeSlots(events, {
    rangeStart: constraints.earliest,
    rangeEnd: constraints.latest,
    durationMinutes: constraints.durationMinutes,
    businessHours: opts.businessHours,
    timeZone,
    maxSlots: opts.maxSlots,
  });

  return { slots, constraints, source };
}
