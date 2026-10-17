/**
 * Conflict Resolution — suggest how to fix scheduling conflicts.
 *
 * When detectConflicts finds overlaps, this module proposes concrete fixes
 * (move event, shorten, or cancel) using the LLM for intelligent suggestions.
 */
import {
  AIAdapter,
  AgendfyEvent,
  ConflictReport,
  ConflictResolution,
  FreeSlot,
} from '../types';
import { findFreeSlots } from '../scheduling';

export interface SuggestResolutionOptions {
  adapter?: AIAdapter;
  events: AgendfyEvent[];
  conflicts: ConflictReport[];
  referenceDate?: Date;
  timeZone?: string;
  businessHours?: { start: string; end: string };
  signal?: AbortSignal;
}

const RESOLUTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['resolutions'],
  properties: {
    resolutions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['eventId', 'suggestion'],
        properties: {
          eventId: { type: 'string' },
          suggestion: { type: 'string' },
          newStart: { type: 'string', description: 'ISO 8601 datetime (optional).' },
          newEnd: { type: 'string', description: 'ISO 8601 datetime (optional).' },
        },
      },
    },
  },
};

function findEvent(events: AgendfyEvent[], id: string): AgendfyEvent | undefined {
  return events.find((e) => e.id === id);
}

function getEventDurationMinutes(event: AgendfyEvent): number {
  return Math.round(
    (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
  );
}

/** Local fallback: suggest moving to the next available slot. */
function localSuggestResolutions(
  conflicts: ConflictReport[],
  events: AgendfyEvent[],
  opts: { timeZone?: string; businessHours?: { start: string; end: string } }
): ConflictResolution[] {
  const ref = new Date();
  const rangeStart = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate())
  );
  const rangeEnd = new Date(rangeStart.getTime() + 7 * 86400000);

  return conflicts.map((conflict) => {
    const [idA, idB] = conflict.eventIds;
    const eventB = findEvent(events, idB);
    if (!eventB) {
      return {
        conflict,
        suggestion: `Consider rescheduling one of the conflicting events.`,
      };
    }

    const duration = getEventDurationMinutes(eventB);
    const freeSlots = findFreeSlots(events, {
      rangeStart: rangeStart.toISOString(),
      rangeEnd: rangeEnd.toISOString(),
      durationMinutes: duration,
      businessHours: opts.businessHours,
      timeZone: opts.timeZone,
      maxSlots: 1,
    });

    if (freeSlots.length > 0) {
      const slot = freeSlots[0];
      return {
        conflict,
        suggestion: `Move "${eventB.title}" to ${formatSlot(slot)} to avoid the overlap.`,
        proposedFix: {
          eventId: idB,
          newStart: slot.start,
          newEnd: slot.end,
        },
      };
    }

    return {
      conflict,
      suggestion: `No free slot found in the next 7 days. Consider shortening or cancelling "${eventB.title}".`,
    };
  });
}

function formatSlot(slot: FreeSlot): string {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  return `${start.toISOString().slice(0, 16)} - ${end.toISOString().slice(11, 16)}`;
}

/**
 * Suggest resolutions for scheduling conflicts.
 * Uses LLM when available, falls back to slot-finding algorithm.
 */
export async function suggestConflictResolutions(
  opts: SuggestResolutionOptions
): Promise<ConflictResolution[]> {
  if (opts.conflicts.length === 0) return [];

  // Local fallback when no adapter
  if (!opts.adapter) {
    return localSuggestResolutions(opts.conflicts, opts.events, opts);
  }

  try {
    const eventContext = opts.events
      .map((e) => `- id="${e.id}" title="${e.title}" start="${new Date(e.start).toISOString()}" end="${new Date(e.end).toISOString()}"`)
      .join('\n');

    const conflictContext = opts.conflicts
      .map(
        (c, i) =>
          `Conflict ${i + 1}: events "${c.eventIds[0]}" and "${c.eventIds[1]}" overlap from ${c.overlapStart} to ${c.overlapEnd}`
      )
      .join('\n');

    const result = await opts.adapter.complete({
      system: [
        'You are a scheduling assistant. Given conflicting events, suggest the best resolution.',
        'Consider: event importance, duration, and available time slots.',
        'Be specific and actionable.',
      ].join(' '),
      prompt: `EVENTS:\n${eventContext}\n\nCONFLICTS:\n${conflictContext}\n\nSuggest resolutions for each conflict.`,
      schema: RESOLUTION_SCHEMA,
      maxTokens: 2048,
      signal: opts.signal,
    });

    const json = result.json as {
      resolutions?: Array<{
        eventId: string;
        suggestion: string;
        newStart?: string;
        newEnd?: string;
      }>;
    };

    if (!json?.resolutions?.length) {
      return localSuggestResolutions(opts.conflicts, opts.events, opts);
    }

    return opts.conflicts.map((conflict, i) => {
      const res = json.resolutions![i] ?? json.resolutions![0];
      return {
        conflict,
        suggestion: res.suggestion,
        ...(res.newStart && res.newEnd
          ? {
              proposedFix: {
                eventId: res.eventId,
                newStart: res.newStart,
                newEnd: res.newEnd,
              },
            }
          : {}),
      };
    });
  } catch {
    return localSuggestResolutions(opts.conflicts, opts.events, opts);
  }
}
