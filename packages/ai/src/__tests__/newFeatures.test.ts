/**
 * Tests for new AI features: editing, agenda, resolution, batch, reminders, availability.
 */
import { parseEditRequest } from '../editing/index';
import { generateAgenda } from '../agenda/index';
import { suggestConflictResolutions } from '../resolution/index';
import { parseMultipleEvents } from '../batch/index';
import { suggestReminders } from '../reminders/index';
import { parseAvailabilityRequest } from '../availability/index';
import { AgendfyEvent, ConflictReport } from '../types';

const refDate = new Date('2026-09-12T09:00:00Z');

const sampleEvents: AgendfyEvent[] = [
  {
    id: '1',
    title: 'Daily Standup',
    start: '2026-09-13T09:00:00Z',
    end: '2026-09-13T09:15:00Z',
  },
  {
    id: '2',
    title: 'Sprint Review',
    start: '2026-09-13T14:00:00Z',
    end: '2026-09-13T15:00:00Z',
  },
  {
    id: '3',
    title: '1:1 with Pedro',
    start: '2026-09-14T10:00:00Z',
    end: '2026-09-14T10:30:00Z',
    resourceId: 'r1',
  },
];

describe('NL Event Editing (local fallback)', () => {
  test('detects delete action', async () => {
    const result = await parseEditRequest('cancela a reunião de sprint', {
      events: sampleEvents,
      referenceDate: refDate,
      locale: 'pt-BR',
    });
    expect(result).not.toBeNull();
    expect(result!.action).toBe('delete');
    expect(result!.eventId).toBe('2');
  });

  test('detects reschedule action', async () => {
    const result = await parseEditRequest('muda a reunião com Pedro para as 14h', {
      events: sampleEvents,
      referenceDate: refDate,
      locale: 'pt-BR',
    });
    expect(result).not.toBeNull();
    expect(result!.action).toBe('reschedule');
    expect(result!.eventId).toBe('3');
  });

  test('returns null when no match found', async () => {
    const result = await parseEditRequest('apaga a reunião do CEO', {
      events: sampleEvents,
      referenceDate: refDate,
      locale: 'pt-BR',
    });
    expect(result).toBeNull();
  });
});

describe('Agenda Generation', () => {
  test('generates daily agenda', async () => {
    const result = await generateAgenda(sampleEvents, {
      period: 'day',
      referenceDate: new Date('2026-09-13T09:00:00Z'),
      timeZone: 'UTC',
    });
    expect(result.period).toBe('day');
    expect(result.items.length).toBe(2);
    expect(result.stats.eventCount).toBe(2);
  });

  test('generates weekly agenda', async () => {
    const result = await generateAgenda(sampleEvents, {
      period: 'week',
      referenceDate: new Date('2026-09-13T09:00:00Z'),
      timeZone: 'UTC',
    });
    expect(result.period).toBe('week');
    expect(result.items.length).toBe(3);
  });

  test('items have timeRange and duration', async () => {
    const result = await generateAgenda(sampleEvents, {
      period: 'day',
      referenceDate: new Date('2026-09-13T09:00:00Z'),
    });
    const item = result.items[0];
    expect(item.timeRange).toContain('-');
    expect(item.durationMinutes).toBeGreaterThan(0);
  });
});

describe('Conflict Resolution (local fallback)', () => {
  const conflict: ConflictReport = {
    type: 'overlap',
    eventIds: ['1', '2'],
    overlapStart: '2026-09-13T09:00:00Z',
    overlapEnd: '2026-09-13T09:15:00Z',
  };

  test('suggests resolution for conflict', async () => {
    const result = await suggestConflictResolutions({
      events: sampleEvents,
      conflicts: [conflict],
      referenceDate: refDate,
      timeZone: 'UTC',
    });
    expect(result.length).toBe(1);
    expect(result[0].suggestion).toBeTruthy();
    expect(result[0].conflict).toBe(conflict);
  });

  test('returns empty for no conflicts', async () => {
    const result = await suggestConflictResolutions({
      events: sampleEvents,
      conflicts: [],
    });
    expect(result.length).toBe(0);
  });
});

describe('Batch Event Parsing (local fallback)', () => {
  test('splits events by comma', async () => {
    const result = await parseMultipleEvents(
      'standup às 9h, reunião com Pedro às 14h',
      { referenceDate: refDate, locale: 'pt-BR' }
    );
    expect(result.events.length).toBe(2);
    expect(result.failed.length).toBe(0);
  });

  test('splits events by "e"', async () => {
    const result = await parseMultipleEvents(
      'reunião de projeto segunda às 10h e review de código terça às 15h',
      { referenceDate: refDate, locale: 'pt-BR' }
    );
    expect(result.events.length).toBe(2);
  });

  test('handles single event', async () => {
    const result = await parseMultipleEvents(
      'standup diário às 9h',
      { referenceDate: refDate, locale: 'pt-BR' }
    );
    expect(result.events.length).toBe(1);
  });
});

describe('Smart Reminders (local fallback)', () => {
  test('suggests reminders for all events', async () => {
    const result = await suggestReminders({
      events: sampleEvents,
      referenceDate: refDate,
    });
    expect(result.length).toBe(sampleEvents.length);
    result.forEach((r) => {
      expect(r.eventId).toBeTruthy();
      expect(r.minutes).toBeGreaterThanOrEqual(0);
      expect(r.reason).toBeTruthy();
    });
  });

  test('external meeting gets 30min reminder', async () => {
    const externalEvents: AgendfyEvent[] = [
      { id: 'e1', title: 'Client Meeting', start: '2026-09-13T14:00:00Z', end: '2026-09-13T15:00:00Z', resourceId: 'r1' },
    ];
    const result = await suggestReminders({ events: externalEvents });
    expect(result[0].minutes).toBe(30);
  });

  test('standup gets 5min reminder', async () => {
    const standupEvents: AgendfyEvent[] = [
      { id: 's1', title: 'Daily Standup', start: '2026-09-13T09:00:00Z', end: '2026-09-13T09:15:00Z' },
    ];
    const result = await suggestReminders({ events: standupEvents });
    expect(result[0].minutes).toBe(5);
  });

  test('returns empty for no events', async () => {
    const result = await suggestReminders({ events: [] });
    expect(result.length).toBe(0);
  });
});

describe('Availability Check (local fallback)', () => {
  test('answers availability question', async () => {
    const result = await parseAvailabilityRequest(
      'quando posso ter uma reunião de 1h?',
      {
        events: sampleEvents,
        referenceDate: refDate,
        timeZone: 'UTC',
      }
    );
    expect(result.answer).toBeTruthy();
    expect(result.slots).toBeDefined();
    expect(result.constraints).toBeDefined();
    expect(result.constraints.durationMinutes).toBe(60);
  });
});
