/**
 * Month-view horizontal resize (EventItem): extending/shrinking an event by
 * whole days via the right handle. Regression coverage for the defects that
 * made it unusable: no zero-width guard, no shrink, missing isMultiDay
 * recompute, non-tz-aware bounds and an incomplete start/stop handshake.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventItem } from './EventItem';

jest.mock('@dnd-kit/core', () => {
  const originalModule = jest.requireActual('@dnd-kit/core');
  return {
    ...originalModule,
    useDraggable: () => ({
      setNodeRef: jest.fn(),
      transform: null,
      isDragging: false,
      attributes: {},
      listeners: {},
    }),
  };
});

// Resizable stub exposing buttons that fire the resize lifecycle with
// controlled deltas/refs.
jest.mock('re-resizable', () => ({
  Resizable: ({ children, onResizeStart, onResizeStop, enable }: any) => (
    <div data-testid="resizable" data-enable={JSON.stringify(enable)}>
      <button
        data-testid="resize-plus-2"
        onClick={() => {
          onResizeStart({ stopPropagation: () => {} });
          onResizeStop({}, 'right', {}, { width: 240, height: 0 }); // 2 cells of 120
        }}
      />
      <button
        data-testid="resize-minus-1"
        onClick={() => {
          onResizeStart({ stopPropagation: () => {} });
          onResizeStop({}, 'right', {}, { width: -120, height: 0 });
        }}
      />
      <button
        data-testid="resize-zero-width"
        onClick={() => {
          onResizeStart({ stopPropagation: () => {} });
          // dayWidth prop is 0 in this scenario AND no parent to measure.
          onResizeStop({}, 'right', null, { width: 240, height: 0 });
        }}
      />
      {children}
    </div>
  ),
}));

const config = { timeZone: 'UTC', slotDuration: 30, lang: 'en' } as any;

const singleDay = {
  id: 'ev-m',
  title: 'Review',
  start: '2026-08-10T14:00:00.000Z',
  end: '2026-08-10T15:00:00.000Z',
};

const threeDay = {
  id: 'ev-3d',
  title: 'Sprint',
  start: '2026-08-10T09:00:00.000Z',
  end: '2026-08-12T18:00:00.000Z',
  isMultiDay: true,
};

const renderItem = (event: any, onEventResize: jest.Mock, dayWidth = 120) =>
  render(
    <EventItem
      event={event}
      isStart={true}
      isEnd={true}
      dayWidth={dayWidth}
      config={config}
      onEventResize={onEventResize}
    />
  );

describe('month-view horizontal resize', () => {
  test('right handle +2 cells extends the end by 2 days and flags isMultiDay', () => {
    const onEventResize = jest.fn();
    renderItem(singleDay, onEventResize);
    fireEvent.click(screen.getByTestId('resize-plus-2'));

    // handshake: 'start' then 'stop' with the updated event
    expect(onEventResize).toHaveBeenNthCalledWith(1, 'start');
    const [status, emitted] = onEventResize.mock.calls[1];
    expect(status).toBe('stop');
    expect(emitted.end).toBe('2026-08-12T15:00:00.000Z');
    expect(emitted.isMultiDay).toBe(true);
    expect(emitted.start).toBe(singleDay.start); // untouched
  });

  test('negative delta shrinks a multiday event back (guarded by start < end)', () => {
    const onEventResize = jest.fn();
    renderItem(threeDay, onEventResize);
    fireEvent.click(screen.getByTestId('resize-minus-1'));

    const [, emitted] = onEventResize.mock.calls[1];
    expect(emitted.end).toBe('2026-08-11T18:00:00.000Z');
    expect(emitted.isMultiDay).toBe(true); // still spans 2 days
  });

  test('unmeasurable cell width: completes the handshake without emitting a corrupt update', () => {
    const onEventResize = jest.fn();
    renderItem(singleDay, onEventResize, 0); // dayWidth 0 + ref null
    fireEvent.click(screen.getByTestId('resize-zero-width'));

    expect(onEventResize).toHaveBeenNthCalledWith(1, 'start');
    // 'stop' fired with NO event — never NaN/Invalid Date
    expect(onEventResize).toHaveBeenNthCalledWith(2, 'stop');
  });

  test('right handle is enabled for single-day events', () => {
    renderItem(singleDay, jest.fn());
    const enable = JSON.parse(screen.getByTestId('resizable').getAttribute('data-enable')!);
    expect(enable.right).toBe(true);
  });
});
