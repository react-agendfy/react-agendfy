import {
  computeCalendarStats,
  summarizeCalendar,
  categorizeEvents,
  buildCategorizeSchema,
} from '../insights';
import { customAdapter } from '../adapters/custom';
import { AgendfyEvent } from '../types';

const events: AgendfyEvent[] = [
  { id: '1', title: 'Standup', start: '2026-07-01T09:00:00Z', end: '2026-07-01T09:30:00Z' },
  { id: '2', title: 'Design review', start: '2026-07-01T14:00:00Z', end: '2026-07-01T16:00:00Z' },
  { id: '3', title: 'One-on-one', start: '2026-07-02T10:00:00Z', end: '2026-07-02T11:00:00Z' },
  { id: '4', title: 'Holiday', start: '2026-07-03T00:00:00Z', end: '2026-07-04T00:00:00Z', allDay: true },
];

describe('computeCalendarStats', () => {
  it('computes totals, per-day hours and the busiest day deterministically', () => {
    const stats = computeCalendarStats(events);
    expect(stats.eventCount).toBe(4);
    expect(stats.totalMeetingHours).toBe(3.5); // all-day event excluded
    expect(stats.busiestDay).toBe('2026-07-01');
    expect(stats.perDayHours).toEqual({ '2026-07-01': 2.5, '2026-07-02': 1 });
  });

  it('handles an empty calendar', () => {
    const stats = computeCalendarStats([]);
    expect(stats).toEqual({ eventCount: 0, totalMeetingHours: 0, perDayHours: {} });
  });
});

describe('summarizeCalendar', () => {
  it('embeds the computed stats in the prompt so the LLM cannot hallucinate numbers', async () => {
    let seenPrompt = '';
    const adapter = customAdapter(async (req) => {
      seenPrompt = req.prompt;
      return { text: 'A calm week with one busy Wednesday.' };
    });
    const insights = await summarizeCalendar(events, { adapter, period: 'this week' });
    expect(seenPrompt).toContain('"totalMeetingHours":3.5');
    expect(seenPrompt).toContain('"busiestDay":"2026-07-01"');
    expect(insights.summary).toBe('A calm week with one busy Wednesday.');
    expect(insights.totalMeetingHours).toBe(3.5);
    expect(insights.busiestDay).toBe('2026-07-01');
    expect(insights.eventCount).toBe(4);
  });

  it('returns a deterministic summary when no adapter is given', async () => {
    const insights = await summarizeCalendar(events, { period: 'this week' });
    expect(insights.summary).toContain('4 events');
    expect(insights.summary).toContain('3.5 meeting hours');
  });

  it('degrades to the deterministic summary when the adapter fails', async () => {
    const adapter = customAdapter(async () => {
      throw new Error('down');
    });
    const insights = await summarizeCalendar(events, { adapter });
    expect(insights.summary).toContain('4 events');
  });
});

describe('categorizeEvents', () => {
  it('returns a schema-constrained id → category mapping', async () => {
    let seenSchema: any;
    const adapter = customAdapter(async (req) => {
      seenSchema = req.schema;
      return {
        json: {
          assignments: [
            { id: '1', category: 'work' },
            { id: '2', category: 'work' },
            { id: '4', category: 'personal' },
          ],
        },
      };
    });
    const mapping = await categorizeEvents(events, { adapter, categories: ['work', 'personal'] });
    expect(mapping).toEqual({ '1': 'work', '2': 'work', '4': 'personal' });
    expect(seenSchema.additionalProperties).toBe(false);
    expect(seenSchema.properties.assignments.items.properties.category.enum).toEqual([
      'work',
      'personal',
    ]);
  });

  it('drops unknown ids and categories outside the allowed set', async () => {
    const adapter = customAdapter(async () => ({
      json: {
        assignments: [
          { id: 'ghost', category: 'work' },
          { id: '1', category: 'invented' },
          { id: '3', category: 'work' },
        ],
      },
    }));
    const mapping = await categorizeEvents(events, { adapter, categories: ['work'] });
    expect(mapping).toEqual({ '3': 'work' });
  });

  it('every object in the categorize schema has additionalProperties:false and required', () => {
    const schema: any = buildCategorizeSchema(['a']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['assignments']);
    const item = schema.properties.assignments.items;
    expect(item.additionalProperties).toBe(false);
    expect(item.required).toEqual(['id', 'category']);
  });
});
