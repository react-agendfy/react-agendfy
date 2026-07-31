/**
 * Segment rendering for timed events crossing midnight (professional-calendar
 * semantics): clipped in-grid segments per day, banner row only for all-day
 * or >= 24h events.
 */
import { clipEventToDay, getEventsForSlot, isBannerEvent } from './weekViewHelpers';

const TZ = 'UTC';
const config = { timeZone: TZ, slotDuration: 30 };

// 22:00 day 1 → 01:00 day 2 (3h, crosses one midnight)
const crossing = {
  id: 'ev-x',
  title: 'Night shift',
  start: '2026-08-10T22:00:00.000Z',
  end: '2026-08-11T01:00:00.000Z',
};

const inside = {
  id: 'ev-i',
  title: 'Lunch',
  start: '2026-08-10T12:00:00.000Z',
  end: '2026-08-10T13:00:00.000Z',
};

describe('isBannerEvent', () => {
  test('all-day events are banners', () => {
    expect(isBannerEvent({ ...inside, isAllDay: true } as any, TZ)).toBe(true);
  });

  test('timed events >= 24h are banners', () => {
    expect(
      isBannerEvent(
        { id: 'a', title: 'Trip', start: '2026-08-10T14:00:00.000Z', end: '2026-08-11T14:00:00.000Z' } as any,
        TZ
      )
    ).toBe(true);
  });

  test('a timed event merely crossing midnight (< 24h) is NOT a banner', () => {
    expect(isBannerEvent(crossing as any, TZ)).toBe(false);
  });
});

describe('clipEventToDay', () => {
  test('event fully inside the day is returned untouched', () => {
    expect(clipEventToDay(inside as any, new Date('2026-08-10T00:00:00.000Z'), TZ)).toBe(inside);
  });

  test('no overlap returns null', () => {
    expect(clipEventToDay(inside as any, new Date('2026-08-12T00:00:00.000Z'), TZ)).toBeNull();
  });

  test('day 1: start segment clipped at midnight, keeps original id, no isEnd', () => {
    const seg: any = clipEventToDay(crossing as any, new Date('2026-08-10T00:00:00.000Z'), TZ);
    expect(seg.id).toBe('ev-x');
    expect(seg.start).toBe('2026-08-10T22:00:00.000Z');
    expect(seg.end).toBe('2026-08-11T00:00:00.000Z');
    expect(seg.__segment).toEqual({
      isStart: true,
      isEnd: false,
      originalStart: '2026-08-10T22:00:00.000Z',
      originalEnd: '2026-08-11T01:00:00.000Z',
    });
  });

  test('day 2: continuation segment starts at midnight with a distinct id', () => {
    const seg: any = clipEventToDay(crossing as any, new Date('2026-08-11T00:00:00.000Z'), TZ);
    expect(seg.id).toBe('ev-x::cont');
    expect(seg.start).toBe('2026-08-11T00:00:00.000Z');
    expect(seg.end).toBe('2026-08-11T01:00:00.000Z');
    expect(seg.__segment.isStart).toBe(false);
    expect(seg.__segment.isEnd).toBe(true);
  });
});

describe('getEventsForSlot with segments', () => {
  test('day 1, 22:00 slot: yields the clipped start segment', () => {
    const found: any[] = getEventsForSlot('2026-08-10T22:00:00.000Z', [crossing as any], config);
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('ev-x');
    expect(found[0].end).toBe('2026-08-11T00:00:00.000Z');
  });

  test('day 2, midnight slot: yields the continuation segment (used to be invisible)', () => {
    const found: any[] = getEventsForSlot('2026-08-11T00:00:00.000Z', [crossing as any], config);
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('ev-x::cont');
    expect(found[0].start).toBe('2026-08-11T00:00:00.000Z');
    expect(found[0].end).toBe('2026-08-11T01:00:00.000Z');
  });

  test('banner events (>= 24h) never appear in time-grid slots', () => {
    const banner = { id: 'b', title: 'Trip', start: '2026-08-10T14:00:00.000Z', end: '2026-08-11T14:00:00.000Z' };
    expect(getEventsForSlot('2026-08-10T14:00:00.000Z', [banner as any], config)).toHaveLength(0);
  });
});
