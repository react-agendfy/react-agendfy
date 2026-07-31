import { parseNaturalEvent, PARSED_EVENT_SCHEMA } from '../nl/parseEvent';
import { customAdapter } from '../adapters/custom';
import { AICompletionRequest } from '../types';

const REF = new Date('2026-07-01T08:00:00.000Z');

describe('parseNaturalEvent (LLM path with mock adapter)', () => {
  it('maps schema-constrained adapter JSON into a ParsedEventResult', async () => {
    const adapter = customAdapter(async () => ({
      json: {
        title: 'Design review',
        start: '2026-07-07T15:00:00.000Z',
        end: '2026-07-07T16:00:00.000Z',
        allDay: false,
        confidence: 'high',
        missing: [],
      },
    }));
    const r = await parseNaturalEvent('design review next tuesday 3pm', {
      adapter,
      referenceDate: REF,
      timeZone: 'Europe/Lisbon',
    });
    expect(r.event).toEqual({
      title: 'Design review',
      start: '2026-07-07T15:00:00.000Z',
      end: '2026-07-07T16:00:00.000Z',
      allDay: false,
    });
    expect(r.confidence).toBe('high');
    expect(r.raw).toBe('design review next tuesday 3pm');
  });

  it('sends the reference "now", timezone and schema to the adapter', async () => {
    let seen: AICompletionRequest | undefined;
    const adapter = customAdapter(async (req) => {
      seen = req;
      return {
        json: {
          title: 'x',
          start: '2026-07-02T09:00:00.000Z',
          end: '2026-07-02T10:00:00.000Z',
          allDay: false,
          confidence: 'medium',
          missing: [],
        },
      };
    });
    await parseNaturalEvent('x tomorrow', { adapter, referenceDate: REF, timeZone: 'America/Sao_Paulo' });
    expect(seen?.system).toContain(REF.toISOString());
    expect(seen?.system).toContain('America/Sao_Paulo');
    expect(seen?.schema).toBe(PARSED_EVENT_SCHEMA);
    expect(seen?.prompt).toBe('x tomorrow');
  });

  it('falls back to the local parser when the adapter throws', async () => {
    const adapter = customAdapter(async () => {
      throw new Error('boom');
    });
    const r = await parseNaturalEvent('Team meeting tomorrow at 3pm', {
      adapter,
      referenceDate: REF,
    });
    expect(r.confidence).toBe('low');
    expect(r.event.start).toBe('2026-07-02T15:00:00.000Z');
  });

  it('falls back to the local parser when the adapter returns invalid JSON', async () => {
    const adapter = customAdapter(async () => ({ json: { nope: true } }));
    const r = await parseNaturalEvent('Team meeting tomorrow at 3pm', {
      adapter,
      referenceDate: REF,
    });
    expect(r.confidence).toBe('low');
    expect(r.event.title).toBe('Team meeting');
  });

  it('uses the local parser directly when no adapter is provided', async () => {
    const r = await parseNaturalEvent('Standup hoje 9:30', { referenceDate: REF });
    expect(r.confidence).toBe('low');
    expect(r.event.start).toBe('2026-07-01T09:30:00.000Z');
  });

  it('schema follows structured-outputs constraints (additionalProperties + required)', () => {
    expect(PARSED_EVENT_SCHEMA.additionalProperties).toBe(false);
    expect(PARSED_EVENT_SCHEMA.required).toEqual(
      expect.arrayContaining(['title', 'start', 'end', 'allDay', 'confidence', 'missing'])
    );
    const raw = JSON.stringify(PARSED_EVENT_SCHEMA);
    expect(raw).not.toContain('minLength');
    expect(raw).not.toContain('maxLength');
    expect(raw).not.toContain('minimum');
    expect(raw).not.toContain('maximum');
  });
});
