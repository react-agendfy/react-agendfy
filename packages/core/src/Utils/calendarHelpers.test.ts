import { defaultResource, normalizeEvents, filterEvents } from './calendarHelpers';
import { DERIVED_RESOURCES, eventResourceIds, toPublicEvent } from './resources';

describe('calendarHelpers', () => {
  describe('normalizeEvents', () => {
    it('should add the default resource if an event has no resources property', () => {
      const events = [
        { id: 1, title: 'Event 1' },
      ];
      const normalized = normalizeEvents(events);
      expect(normalized).toEqual([
        { id: 1, title: 'Event 1', resources: [defaultResource], [DERIVED_RESOURCES]: true },
      ]);
    });

    it('should add the default resource if an event has an empty resources array', () => {
      const events = [
        { id: 1, title: 'Event 1', resources: [] },
      ];
      const normalized = normalizeEvents(events);
      expect(normalized).toEqual([
        { id: 1, title: 'Event 1', resources: [defaultResource], [DERIVED_RESOURCES]: true },
      ]);
    });

    it('should not modify events that already have resources', () => {
      const events = [
        { id: 1, title: 'Event 1', resources: [{ id: 'r1', name: 'Resource 1' }] },
      ];
      const normalized = normalizeEvents(events);
      expect(normalized).toEqual(events);
    });
  });

  describe('resourceIds model', () => {
    const all = [{ id: 'r1', title: 'Room 1' }, { id: 'r2', title: 'Room 2' }];

    it('resolves resourceIds/resourceId against the calendar resources, for display', () => {
      const [many, one, unknown] = normalizeEvents(
        [
          { id: 1, title: 'A', start: '', end: '', resourceIds: ['r1', 'r2'] },
          { id: 2, title: 'B', start: '', end: '', resourceId: 'r2' },
          { id: 3, title: 'C', start: '', end: '', resourceId: 'r9' },
        ],
        all
      );
      expect(many.resources).toEqual(all);
      expect(one.resources).toEqual([all[1]]);
      expect(unknown.resources).toEqual([{ id: 'r9' }]);
    });

    it('reads ids with priority resourceIds > resourceId > legacy resources', () => {
      expect(eventResourceIds({ id: 1, title: '', start: '', end: '', resourceIds: ['a'], resourceId: 'b' })).toEqual(['a']);
      expect(eventResourceIds({ id: 1, title: '', start: '', end: '', resourceId: 7 })).toEqual(['7']);
      expect(eventResourceIds({ id: 1, title: '', start: '', end: '', resources: [{ id: 'x' }, defaultResource] })).toEqual(['x']);
      // Derived objects are display only, never read back as ids.
      const [placeholder] = normalizeEvents([{ id: 1, title: '', start: '', end: '' }]);
      expect(eventResourceIds(placeholder)).toEqual([]);
    });

    it('toPublicEvent gives the host its own shape back', () => {
      const original = { id: 1, title: 'A', start: '', end: '', resourceIds: ['r1'] };
      const [normalized] = normalizeEvents([original], all);
      expect(toPublicEvent({ ...normalized, start: 'moved' })).toEqual({ ...original, start: 'moved' });
      const legacy = { id: 2, title: 'L', start: '', end: '', resources: [all[0]] };
      expect(toPublicEvent(normalizeEvents([legacy], all)[0])).toBe(legacy);
    });

    it('the resource filter matches resourceIds, resourceId and legacy resources', () => {
      const events = [
        { id: 1, title: '', start: '', end: '', resourceIds: ['r1', 'r2'] },
        { id: 2, title: '', start: '', end: '', resourceId: 'r2' },
        { id: 3, title: '', start: '', end: '', resources: [{ id: 'r2' }] },
        { id: 4, title: '', start: '', end: '' },
      ];
      expect(filterEvents(normalizeEvents(events, all), ['r2']).map((e) => e.id)).toEqual([1, 2, 3]);
    });
  });

  describe('filterEvents', () => {
    const eventWithResources = { id: 1, title: 'Event 1', resources: [{ id: 'r1', name: 'Resource 1' }] };
    const eventWithoutResources = { id: 2, title: 'Event 2' };
    const eventWithMultipleResources = { id: 3, title: 'Event 3', resources: [{ id: 'r2', name: 'Resource 2' }, { id: 'r3', name: 'Resource 3' }] };

    it('should return all events if no local filtered resources are provided', () => {
      const events = [eventWithResources, eventWithoutResources, eventWithMultipleResources];
      const filtered = filterEvents(events, []);
      expect(filtered).toEqual(events);
    });

    it('should return only events that include at least one filtered resource', () => {
      const events = [eventWithResources, eventWithMultipleResources];
      const filtered = filterEvents(events, ['r1']);
      expect(filtered).toEqual([eventWithResources]);
    });

    it('should return events with resources if the filtered resources array is empty', () => {
      const events = [eventWithResources, eventWithoutResources, eventWithMultipleResources];
      const filtered = filterEvents(events, []);
      expect(filtered).toEqual(events);
    });

    it('should filter out events without resources when filtered resources is not empty', () => {
      const events = [eventWithoutResources];
      const filtered = filterEvents(events, ['r1']);
      expect(filtered).toEqual([]);
    });
  });
});
