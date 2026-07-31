/**
 * Regression tests for the WeekView drag-end logic (phase-0 audit bug B8):
 * the drop must snap EXACTLY to the slot under the pointer (`over.id`).
 * The old code added `(active.transform.y / 40) * slotDuration` on top of
 * the drop slot, double-counting the drag distance and producing
 * fractional-minute start times.
 */
import React from 'react';
import { render } from '@testing-library/react';
import WeekView from './WeekView';
import { TZDate } from '@date-fns/tz';

const mockDndContextOnDragEnd = jest.fn();

jest.mock('@dnd-kit/core', () => {
  const originalModule = jest.requireActual('@dnd-kit/core');
  return {
    ...originalModule,
    DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (event: any) => void }) => {
      if (onDragEnd) {
        mockDndContextOnDragEnd.mockImplementation(onDragEnd);
      }
      return <div data-testid="dnd-context">{children}</div>;
    },
  };
});

// Keep the render surface small — the drag handler is what we're testing.
jest.mock('./Components/DayColumn.tsx', () => ({
  DayColumn: () => <div data-testid="day-column" />,
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

const config = {
  timeZone: 'UTC',
  slotDuration: 30,
  defaultView: 'week',
  slotLabelFormat: 'HH:mm',
  slotMin: '00:00',
  slotMax: '23:59',
  lang: 'en',
} as any;

const event = {
  id: 'ev-1',
  title: 'Design review',
  start: '2026-08-03T09:00:00.000Z',
  end: '2026-08-03T10:00:00.000Z', // 60-minute duration
};

const renderWeekView = (onEventUpdate: jest.Mock, onEventClick?: jest.Mock) =>
  render(
    <WeekView
      events={[event]}
      currentDate={new TZDate('2026-08-03T00:00:00.000Z', 'UTC')}
      slotMin="0"
      slotMax="24"
      config={config}
      onEventUpdate={onEventUpdate}
      onEventClick={onEventClick}
    />
  );

describe('WeekView drag-end snapping (B8 regression)', () => {
  beforeEach(() => {
    mockDndContextOnDragEnd.mockReset();
  });

  test('drop lands exactly on the slot under the pointer, ignoring transform.y', () => {
    const onEventUpdate = jest.fn();
    renderWeekView(onEventUpdate);

    const dropSlot = '2026-08-04T14:30:00.000Z';
    mockDndContextOnDragEnd({
      active: {
        id: 'ev-1',
        // Large travelled distance — the OLD code would add
        // (200 / 40) * 30 = 150 minutes on top of the drop slot.
        transform: { x: 0, y: 200 },
      },
      over: { id: dropSlot },
      delta: { x: 120, y: 200 },
    });

    expect(onEventUpdate).toHaveBeenCalledTimes(1);
    const updated = onEventUpdate.mock.calls[0][0];
    // Exact snap to the drop slot — no fractional/offset minutes.
    expect(updated.start).toBe(new Date(dropSlot).toISOString());
    // Duration preserved (60 minutes).
    expect(new Date(updated.end).getTime() - new Date(updated.start).getTime()).toBe(60 * 60 * 1000);
  });

  test('sub-threshold movement on both axes is a click, not a move', () => {
    const onEventUpdate = jest.fn();
    const onEventClick = jest.fn();
    renderWeekView(onEventUpdate, onEventClick);

    mockDndContextOnDragEnd({
      active: { id: 'ev-1', transform: { x: 2, y: 3 } },
      over: { id: '2026-08-03T09:00:00.000Z' },
      delta: { x: 2, y: 3 },
    });

    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventUpdate).not.toHaveBeenCalled();
  });

  test('horizontal-only drag to another day is a move, not a click (B2 guard)', () => {
    const onEventUpdate = jest.fn();
    const onEventClick = jest.fn();
    renderWeekView(onEventUpdate, onEventClick);

    const dropSlot = '2026-08-05T09:00:00.000Z'; // same time, two days later
    mockDndContextOnDragEnd({
      active: { id: 'ev-1', transform: { x: 260, y: 0 } },
      over: { id: dropSlot },
      delta: { x: 260, y: 0 },
    });

    expect(onEventClick).not.toHaveBeenCalled();
    expect(onEventUpdate).toHaveBeenCalledTimes(1);
    expect(onEventUpdate.mock.calls[0][0].start).toBe(new Date(dropSlot).toISOString());
  });
});
