/**
 * Deterministic natural-language event parser — the no-LLM fallback.
 *
 * Handles a useful subset: times ("15h", "15h30", "3pm", "15:30"), weekday
 * names (EN + PT), "today"/"tomorrow"/"hoje"/"amanhã", and durations
 * ("90min", "2 hours", "2 horas"). Used automatically when no adapter is
 * provided or the adapter call fails; results always carry confidence 'low'.
 *
 * Determinism note: dates are computed with UTC arithmetic from the
 * reference date, so times are interpreted as UTC wall-clock. The `timeZone`
 * option is accepted for API symmetry but not applied here — precise
 * timezone resolution is the LLM path's job.
 */
import { ParsedEventResult } from '../types';

export interface LocalParseOptions {
  referenceDate?: Date;
  timeZone?: string;
  locale?: string;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, domingo: 0,
  monday: 1, mon: 1, segunda: 1,
  tuesday: 2, tue: 2, tues: 2, 'terça': 2, terca: 2,
  wednesday: 3, wed: 3, quarta: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4, quinta: 4,
  friday: 5, fri: 5, sexta: 5,
  saturday: 6, sat: 6, 'sábado': 6, sabado: 6,
};

const WEEKDAY_RE = new RegExp(
  `(?:\\bnext\\s+|\\bna\\s+|\\bno\\s+)?\\b(${Object.keys(WEEKDAYS).join('|')})(?:-feira)?\\b`,
  'i'
);
// NOTE: JS \b is ASCII-only, so it misbehaves next to accented letters
// ("amanhã", "às"). Edges around those words use (?:^|\s) / (?=\s|$) instead.
const TODAY_RE = /\b(today|hoje)\b/i;
const TOMORROW_RE = /(?:^|\s)(tomorrow|amanhã|amanha)(?=\s|$|[.,;!?])/i;
// Durations first (word forms only) so "2 hours" is not read as a time.
const DURATION_RE = /\b(?:for|por|durante)?\s*(\d{1,3})\s*(min(?:utes?|utos?)?|hours?|horas?)\b/i;
const TIME_PREFIX = '(?:\\bat\\s+|(?:^|\\s)às\\s+|\\bas\\s+)?';
const AMPM_RE = new RegExp(`${TIME_PREFIX}\\b(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)\\b`, 'i');
const HHMM_RE = new RegExp(`${TIME_PREFIX}\\b(\\d{1,2}):(\\d{2})\\b`);
const HOUR_H_RE = new RegExp(`${TIME_PREFIX}\\b(\\d{1,2})h(\\d{2})?\\b`, 'i');

interface TimeMatch { hour: number; minute: number; matched: string }

function matchTime(text: string): TimeMatch | null {
  const ampm = AMPM_RE.exec(text);
  if (ampm) {
    let hour = parseInt(ampm[1], 10) % 12;
    if (/^p/i.test(ampm[3])) hour += 12;
    return { hour, minute: ampm[2] ? parseInt(ampm[2], 10) : 0, matched: ampm[0] };
  }
  const hhmm = HHMM_RE.exec(text);
  if (hhmm) {
    return { hour: parseInt(hhmm[1], 10), minute: parseInt(hhmm[2], 10), matched: hhmm[0] };
  }
  const hourH = HOUR_H_RE.exec(text);
  if (hourH) {
    return {
      hour: parseInt(hourH[1], 10),
      minute: hourH[2] ? parseInt(hourH[2], 10) : 0,
      matched: hourH[0],
    };
  }
  return null;
}

function cleanTitle(input: string, matched: string[]): string {
  let title = input;
  for (const m of matched) {
    if (m) title = title.replace(m, ' ');
  }
  return title
    .replace(/(?:^|\s)(next|at|on|for|às|as|na|no|por|durante|em)(?=\s|$)/gi, ' ')
    .replace(/[,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseNaturalEventLocal(
  input: string,
  opts: LocalParseOptions = {}
): ParsedEventResult {
  const ref = opts.referenceDate ?? new Date();
  const missing: string[] = [];
  const consumed: string[] = [];

  // 1. Duration (before time matching, so "2 hours" is not a time).
  let durationMinutes = 60;
  let working = input;
  const dur = DURATION_RE.exec(working);
  if (dur) {
    const value = parseInt(dur[1], 10);
    durationMinutes = /^h/i.test(dur[2]) ? value * 60 : value;
    working = working.replace(dur[0], ' ');
    consumed.push(dur[0]);
  }

  // 2. Day offset relative to the reference date (UTC arithmetic).
  let dayOffset = 0;
  let hasDate = false;
  const today = TODAY_RE.exec(working);
  const tomorrow = TOMORROW_RE.exec(working);
  const weekday = WEEKDAY_RE.exec(working);
  if (tomorrow) {
    dayOffset = 1;
    hasDate = true;
    consumed.push(tomorrow[0]);
  } else if (today) {
    hasDate = true;
    consumed.push(today[0]);
  } else if (weekday) {
    const target = WEEKDAYS[weekday[1].toLowerCase()];
    const diff = (target - ref.getUTCDay() + 7) % 7;
    dayOffset = diff === 0 ? 7 : diff; // "terça" on a Tuesday → next Tuesday
    hasDate = true;
    consumed.push(weekday[0]);
  }
  if (!hasDate) missing.push('date');

  // 3. Time of day.
  const time = matchTime(working);
  let hour = 9;
  let minute = 0;
  if (time) {
    hour = time.hour;
    minute = time.minute;
    consumed.push(time.matched);
  } else {
    missing.push('time');
  }

  // 4. Assemble ISO start/end.
  const startMs = Date.UTC(
    ref.getUTCFullYear(),
    ref.getUTCMonth(),
    ref.getUTCDate() + dayOffset,
    hour,
    minute
  );
  const endMs = startMs + durationMinutes * 60_000;

  // 5. Title = leftovers after removing every consumed token.
  let title = cleanTitle(input, consumed);
  if (!title) {
    title = 'Untitled event';
    missing.push('title');
  }

  return {
    event: {
      title,
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      allDay: false,
    },
    confidence: 'low',
    ...(missing.length ? { missing } : {}),
    raw: input,
  };
}
