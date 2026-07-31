import {
  detectConflicts,
  findFreeSlots,
  suggestSchedulingTimes,
  SCHEDULING_CONSTRAINTS_SCHEMA,
} from '../scheduling';
import { customAdapter } from '../adapters/custom';
import { AgendfyEvent } from '../types';

const ev = (
  id: string,
  start: string,
  end: string,
  extra: Partial<AgendfyEvent> = {}
): AgendfyEvent => ({ id, title: id, start, end, ...extra });

describe('detectConflicts', () => {
  it('reports an overlapping pair with the overlap span', () => {
    const reports = detectConflicts([
      ev('a', '2026-07-01T10:00:00Z', '2026-07-01T11:00:00Z'),
      ev('b', '2026-07-01T10:30:00Z', '2026-07-01T11:30:00Z'),
    ]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      type: 'overlap',
      eventIds: ['a', 'b'],
      overlapStart: '2026-07-01T10:30:00.000Z',
      overlapEnd: '2026-07-01T11:00:00.000Z',
    });
  });

  it('does not report back-to-back events (end == start)', () => {
    const reports = detectConflicts([
      ev('a', '2026-07-01T10:00:00Z', '2026-07-01T11:00:00Z'),
      ev('b', '2026-07-01T11:00:00Z', '2026-07-01T12:00:00Z'),
    ]);
    expect(reports).toHaveLength(0);
  });

  it('classifies same-resource overlaps as resource-double-booking', () => {
    const reports = detectConflicts([
      ev('a', '2026-07-01T10:00:00Z', '2026-07-01T11:00:00Z', { resourceId: 'r1' }),
      ev('b', '2026-07-01T10:30:00Z', '2026-07-01T11:30:00Z', { resourceId: 'r1' }),
    ]);
    expect(reports[0].type).toBe('resource-double-booking');
    expect(reports[0].resourceId).toBe('r1');
  });

  it('detects shared resources through resourceIds arrays', () => {
    const reports = detectConflicts([
      ev('a', '2026-07-01T10:00:00Z', '2026-07-01T11:00:00Z', { resourceIds: ['r1', 'r2'] }),
      ev('b', '2026-07-01T10:30:00Z', '2026-07-01T11:30:00Z', { resourceId: 'r2' }),
    ]);
    expect(reports[0].type).toBe('resource-double-booking');
    expect(reports[0].resourceId).toBe('r2');
  });

  it('reports every pair in a triple overlap and ignores invalid events', () => {
    const reports = detectConflicts([
      ev('a', '2026-07-01T10:00:00Z', '2026-07-01T12:00:00Z'),
      ev('b', '2026-07-01T10:30:00Z', '2026-07-01T11:30:00Z'),
      ev('c', '2026-07-01T11:00:00Z', '2026-07-01T13:00:00Z'),
      ev('broken', 'not-a-date', '2026-07-01T13:00:00Z'),
    ]);
    expect(reports).toHaveLength(3);
  });
});

describe('findFreeSlots', () => {
  const RANGE = {
    rangeStart: '2026-07-01T00:00:00Z',
    rangeEnd: '2026-07-02T00:00:00Z',
    durationMinutes: 60,
  };

  it('returns the whole range when there are no events', () => {
    const slots = findFreeSlots([], RANGE);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual({
      start: '2026-07-01T00:00:00.000Z',
      end: '2026-07-02T00:00:00.000Z',
      durationMinutes: 1440,
    });
  });

  it('splits the range around busy intervals and merges overlapping busy time', () => {
    const slots = findFreeSlots(
      [
        ev('a', '2026-07-01T09:00:00Z', '2026-07-01T10:00:00Z'),
        ev('b', '2026-07-01T09:30:00Z', '2026-07-01T11:00:00Z'),
      ],
      RANGE
    );
    expect(slots).toEqual([
      expect.objectContaining({ start: '2026-07-01T00:00:00.000Z', end: '2026-07-01T09:00:00.000Z' }),
      expect.objectContaining({ start: '2026-07-01T11:00:00.000Z', end: '2026-07-02T00:00:00.000Z' }),
    ]);
  });

  it('restricts slots to business-hours windows per day', () => {
    const slots = findFreeSlots(
      [ev('a', '2026-07-01T10:00:00Z', '2026-07-01T14:00:00Z')],
      {
        rangeStart: '2026-07-01T00:00:00Z',
        rangeEnd: '2026-07-03T00:00:00Z',
        durationMinutes: 30,
        businessHours: { start: '09:00', end: '17:00' },
        timeZone: 'UTC',
      }
    );
    expect(slots).toEqual([
      expect.objectContaining({ start: '2026-07-01T09:00:00.000Z', end: '2026-07-01T10:00:00.000Z' }),
      expect.objectContaining({ start: '2026-07-01T14:00:00.000Z', end: '2026-07-01T17:00:00.000Z' }),
      expect.objectContaining({ start: '2026-07-02T09:00:00.000Z', end: '2026-07-02T17:00:00.000Z' }),
    ]);
  });

  it('interprets business hours in the provided IANA timezone', () => {
    // New York is UTC-4 in July: 09:00 local == 13:00 UTC.
    const slots = findFreeSlots([], {
      rangeStart: '2026-07-01T00:00:00Z',
      rangeEnd: '2026-07-02T00:00:00Z',
      durationMinutes: 60,
      businessHours: { start: '09:00', end: '10:00' },
      timeZone: 'America/New_York',
    });
    expect(slots).toEqual([
      expect.objectContaining({ start: '2026-07-01T13:00:00.000Z', end: '2026-07-01T14:00:00.000Z' }),
    ]);
  });

  it('returns no slots when no gap fits the requested duration', () => {
    const slots = findFreeSlots(
      [ev('a', '2026-07-01T09:30:00Z', '2026-07-01T16:30:00Z')],
      {
        rangeStart: '2026-07-01T00:00:00Z',
        rangeEnd: '2026-07-02T00:00:00Z',
        durationMinutes: 60,
        businessHours: { start: '09:00', end: '17:00' },
      }
    );
    expect(slots).toHaveLength(0);
  });

  it('returns [] for an inverted or invalid range', () => {
    expect(
      findFreeSlots([], { rangeStart: '2026-07-02T00:00:00Z', rangeEnd: '2026-07-01T00:00:00Z', durationMinutes: 30 })
    ).toHaveLength(0);
  });
});

describe('suggestSchedulingTimes', () => {
  const events = [ev('a', '2026-07-01T10:00:00Z', '2026-07-01T11:00:00Z')];

  it('uses the adapter only to extract constraints, then decides deterministically', async () => {
    let sawSchema: unknown;
    const adapter = customAdapter(async (req) => {
      sawSchema = req.schema;
      return {
        json: {
          durationMinutes: 60,
          earliest: '2026-07-01T09:00:00Z',
          latest: '2026-07-01T13:00:00Z',
          preferences: 'mornings',
        },
      };
    });
    const suggestion = await suggestSchedulingTimes('find 1h tomorrow morning', events, {
      adapter,
      referenceDate: new Date('2026-07-01T08:00:00Z'),
    });
    expect(sawSchema).toBe(SCHEDULING_CONSTRAINTS_SCHEMA);
    expect(suggestion.source).toBe('llm');
    expect(suggestion.constraints.preferences).toBe('mornings');
    // Window 09:00–13:00 minus the 10:00–11:00 busy block = two viable gaps.
    expect(suggestion.slots).toEqual([
      expect.objectContaining({ start: '2026-07-01T09:00:00.000Z', end: '2026-07-01T10:00:00.000Z' }),
      expect.objectContaining({ start: '2026-07-01T11:00:00.000Z', end: '2026-07-01T13:00:00.000Z' }),
    ]);
  });

  it('degrades to a deterministic default window when the adapter fails', async () => {
    const adapter = customAdapter(async () => {
      throw new Error('rate limited');
    });
    const ref = new Date('2026-07-01T08:00:00Z');
    const suggestion = await suggestSchedulingTimes('find 1h', [], { adapter, referenceDate: ref });
    expect(suggestion.source).toBe('fallback');
    expect(suggestion.constraints).toMatchObject({
      durationMinutes: 60,
      earliest: '2026-07-01T08:00:00.000Z',
      latest: '2026-07-08T08:00:00.000Z',
    });
    expect(suggestion.slots.length).toBeGreaterThan(0);
  });

  it('works without any adapter (pure fallback)', async () => {
    const suggestion = await suggestSchedulingTimes('anything', [], {
      referenceDate: new Date('2026-07-01T08:00:00Z'),
    });
    expect(suggestion.source).toBe('fallback');
  });
});
