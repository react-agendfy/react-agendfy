/**
 * NL Availability Check — answer "when can I meet?" via natural language.
 *
 * Examples:
 *   "quando posso ter uma reunião de 1h esta semana?"
 *   "tenho livre amanhã de manhã?"
 *   "encontra um slot de 30min na terça"
 */
import {
  AIAdapter,
  AgendfyEvent,
  AvailabilityResult,
  FreeSlot,
  SchedulingConstraints,
} from '../types';
import { findFreeSlots, suggestSchedulingTimes } from '../scheduling';

export interface ParseAvailabilityOptions {
  adapter?: AIAdapter;
  events: AgendfyEvent[];
  referenceDate?: Date;
  timeZone?: string;
  businessHours?: { start: string; end: string };
  locale?: string;
  signal?: AbortSignal;
}

function formatSlotsAnswer(slots: FreeSlot[], constraints: SchedulingConstraints): string {
  if (slots.length === 0) {
    return `No free slots found for a ${constraints.durationMinutes}-minute event in the requested period.`;
  }

  const slotList = slots
    .map((s) => {
      const start = new Date(s.start);
      const end = new Date(s.end);
      return `  - ${start.toISOString().slice(0, 16)} to ${end.toISOString().slice(11, 16)} (${s.durationMinutes}min available)`;
    })
    .join('\n');

  return `Found ${slots.length} slot(s) for a ${constraints.durationMinutes}-minute event:\n${slotList}`;
}

/**
 * Parse a natural-language availability question and find matching free slots.
 * Uses suggestSchedulingTimes to extract constraints, then findFreeSlots.
 */
export async function parseAvailabilityRequest(
  input: string,
  opts: ParseAvailabilityOptions
): Promise<AvailabilityResult> {
  // Extract constraints via LLM (or fallback defaults)
  const suggestion = await suggestSchedulingTimes(input, opts.events, {
    adapter: opts.adapter,
    referenceDate: opts.referenceDate,
    timeZone: opts.timeZone,
    businessHours: opts.businessHours,
    signal: opts.signal,
  });

  const { constraints, slots } = suggestion;
  const answer = formatSlotsAnswer(slots, constraints);

  return {
    answer,
    slots,
    constraints,
  };
}
