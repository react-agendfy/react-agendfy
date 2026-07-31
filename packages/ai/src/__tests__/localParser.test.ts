import { parseNaturalEventLocal } from '../nl/localParser';

// 2026-07-01 is a Wednesday.
const REF = new Date('2026-07-01T08:00:00.000Z');

describe('parseNaturalEventLocal', () => {
  it('parses "tomorrow at 3pm" relative to the reference date', () => {
    const r = parseNaturalEventLocal('Team meeting tomorrow at 3pm', { referenceDate: REF });
    expect(r.event.start).toBe('2026-07-02T15:00:00.000Z');
    expect(r.event.end).toBe('2026-07-02T16:00:00.000Z');
    expect(r.event.title).toBe('Team meeting');
    expect(r.confidence).toBe('low');
  });

  it('parses Portuguese weekday + "às 15h"', () => {
    const r = parseNaturalEventLocal('Reunião terça às 15h', { referenceDate: REF });
    // Next Tuesday after Wednesday 2026-07-01 is 2026-07-07.
    expect(r.event.start).toBe('2026-07-07T15:00:00.000Z');
    expect(r.event.end).toBe('2026-07-07T16:00:00.000Z');
    expect(r.event.title).toBe('Reunião');
  });

  it('parses "hoje" with HH:MM time and an explicit minutes duration', () => {
    const r = parseNaturalEventLocal('Standup hoje 9:30 15min', { referenceDate: REF });
    expect(r.event.start).toBe('2026-07-01T09:30:00.000Z');
    expect(r.event.end).toBe('2026-07-01T09:45:00.000Z');
  });

  it('parses hour-word durations ("2 hours") without mistaking them for times', () => {
    const r = parseNaturalEventLocal('Call with John tomorrow 2pm for 2 hours', {
      referenceDate: REF,
    });
    expect(r.event.start).toBe('2026-07-02T14:00:00.000Z');
    expect(r.event.end).toBe('2026-07-02T16:00:00.000Z');
  });

  it('parses "15h30" style times', () => {
    const r = parseNaturalEventLocal('Revisão amanhã às 15h30', { referenceDate: REF });
    expect(r.event.start).toBe('2026-07-02T15:30:00.000Z');
  });

  it('flags missing time and defaults to 09:00', () => {
    const r = parseNaturalEventLocal('Dentist tomorrow', { referenceDate: REF });
    expect(r.event.start).toBe('2026-07-02T09:00:00.000Z');
    expect(r.missing).toContain('time');
  });

  it('flags missing date and defaults to the reference day', () => {
    const r = parseNaturalEventLocal('Sync at 10:00', { referenceDate: REF });
    expect(r.event.start).toBe('2026-07-01T10:00:00.000Z');
    expect(r.missing).toContain('date');
  });

  it('same weekday as reference rolls to next week and keeps raw input', () => {
    const r = parseNaturalEventLocal('Retro wednesday 11:00', { referenceDate: REF });
    expect(r.event.start).toBe('2026-07-08T11:00:00.000Z');
    expect(r.raw).toBe('Retro wednesday 11:00');
  });

  it('falls back to an untitled event when only date/time tokens are given', () => {
    const r = parseNaturalEventLocal('tomorrow 3pm', { referenceDate: REF });
    expect(r.event.title).toBe('Untitled event');
    expect(r.missing).toContain('title');
  });
});
