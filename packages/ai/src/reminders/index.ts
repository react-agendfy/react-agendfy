/**
 * Smart Reminders — AI-suggested reminder times based on event context.
 *
 * Examples:
 *   "sugere lembretes para os meus eventos"
 *   "quando devo ser lembrado desta reunião?"
 */
import {
  AIAdapter,
  AgendfyEvent,
  ReminderTrigger,
  SmartReminder,
} from '../types';

export interface SuggestRemindersOptions {
  adapter?: AIAdapter;
  events: AgendfyEvent[];
  referenceDate?: Date;
  timeZone?: string;
  locale?: string;
  signal?: AbortSignal;
}

const REMINDERS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reminders'],
  properties: {
    reminders: {
      type: 'array',
      items: {
        type: 'object',
        required: ['eventId', 'minutes', 'trigger', 'reason'],
        properties: {
          eventId: { type: 'string' },
          minutes: { type: 'number', description: 'Minutes before/after the trigger point.' },
          trigger: { type: 'string', enum: ['before-start', 'before-end', 'at-time'] },
          reason: { type: 'string', description: 'Why this reminder time was chosen.' },
        },
      },
    },
  },
};

/** Local fallback: rule-based reminder suggestions. */
function localSuggestReminders(events: AgendfyEvent[]): SmartReminder[] {
  const reminders: SmartReminder[] = [];

  for (const event of events) {
    const title = event.title.toLowerCase();
    const duration = Math.round(
      (new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000
    );

    // External meetings (with location/resource) → remind earlier
    if (event.resourceId || /externa?|cliente|customer|partner/i.test(title)) {
      reminders.push({
        eventId: event.id,
        minutes: 30,
        trigger: 'before-start',
        reason: 'External meeting — extra time to prepare and travel.',
      });
    }
    // Standup/daily → quick reminder
    else if (/standup|daily|diária|diário/i.test(title)) {
      reminders.push({
        eventId: event.id,
        minutes: 5,
        trigger: 'before-start',
        reason: 'Daily standup — brief heads-up.',
      });
    }
    // Long meetings → remind before end too
    else if (duration > 60) {
      reminders.push({
        eventId: event.id,
        minutes: 10,
        trigger: 'before-start',
        reason: 'Long meeting — time to prepare agenda.',
      });
      reminders.push({
        eventId: event.id,
        minutes: 15,
        trigger: 'before-end',
        reason: 'Wrap up and action items before meeting ends.',
      });
    }
    // Default
    else {
      reminders.push({
        eventId: event.id,
        minutes: 10,
        trigger: 'before-start',
        reason: 'Standard reminder before event.',
      });
    }
  }

  return reminders;
}

/**
 * Suggest smart reminder times for events.
 * Uses LLM when available, falls back to rule-based defaults.
 */
export async function suggestReminders(
  opts: SuggestRemindersOptions
): Promise<SmartReminder[]> {
  if (opts.events.length === 0) return [];

  // Local fallback when no adapter
  if (!opts.adapter) {
    return localSuggestReminders(opts.events);
  }

  try {
    const eventContext = opts.events
      .map(
        (e) =>
          `- id="${e.id}" title="${e.title}" start="${new Date(e.start).toISOString()}" end="${new Date(e.end).toISOString()}" resourceId="${e.resourceId ?? 'none'}"`
      )
      .join('\n');

    const result = await opts.adapter.complete({
      system: [
        'You are a scheduling assistant. Suggest intelligent reminder times for calendar events.',
        'Consider: event type, duration, whether it has a resource/location, time of day.',
        'Rules: external meetings need 30min heads-up, standups need 5min, long meetings need wrap-up reminders.',
      ].join(' '),
      prompt: `EVENTS:\n${eventContext}\n\nSuggest reminder times for each event.`,
      schema: REMINDERS_SCHEMA,
      maxTokens: 2048,
      signal: opts.signal,
    });

    const json = result.json as {
      reminders?: Array<{
        eventId: string;
        minutes: number;
        trigger: ReminderTrigger;
        reason: string;
      }>;
    };

    if (!json?.reminders?.length) {
      return localSuggestReminders(opts.events);
    }

    // Validate: only return reminders for known event ids
    const eventIds = new Set(opts.events.map((e) => e.id));
    return json.reminders.filter(
      (r) => eventIds.has(r.eventId) && typeof r.minutes === 'number' && r.minutes >= 0
    );
  } catch {
    return localSuggestReminders(opts.events);
  }
}
