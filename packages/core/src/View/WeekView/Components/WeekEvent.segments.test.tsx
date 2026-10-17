/**
 * Segment behavior in WeekEvent: the continuation segment of a
 * midnight-crossing event must (a) never move with the start segment's
 * drag, and (b) resize against the event's TRUE bounds — never the
 * clipped midnight bounds.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeekEvent } from './WeekEvent';

const DRAG_TRANSFORM = { x: 30, y: 60, scaleX: 1, scaleY: 1 };

jest.mock('@dnd-kit/core', () => {
  const originalModule = jest.requireActual('@dnd-kit/core');
  return {
    ...originalModule,
    useDraggable: () => ({
      setNodeRef: jest.fn(),
      transform: DRAG_TRANSFORM,
      isDragging: true,
      attributes: {},
      listeners: {},
    }),
  };
});

// Deterministic Resizable stub: exposes buttons that fire onResizeStop and
// reports which handles are enabled.
jest.mock('re-resizable', () => ({
  Resizable: ({ children, onResizeStop, enable, style }: any) => (
    <div data-testid="resizable" data-enable={JSON.stringify(enable)} style={style}>
      <button
        data-testid="resize-bottom-60"
        onClick={() => onResizeStop({}, 'bottom', {}, { height: 80, width: 0 })}
      />
      <button
        data-testid="resize-right-5cols"
        onClick={() =>
          onResizeStop(
            {},
            'right',
            // Real column width measured from the DOM (5 columns of 120px).
            { parentElement: { offsetWidth: 120 } },
            { height: 0, width: 600 }
          )
        }
      />
      {children}
    </div>
  ),
}));

const config = { timeZone: 'UTC', slotDuration: 30, lang: 'en' } as any;

// Continuation segment of a 22:00 → 01:00 event, clipped to day 2.
const continuationSegment = {
  id: 'ev-x::cont',
  title: 'Night shift',
  start: '2026-08-11T00:00:00.000Z',
  end: '2026-08-11T01:00:00.000Z',
  __segment: {
    isStart: false,
    isEnd: true,
    originalStart: '2026-08-10T22:00:00.000Z',
    originalEnd: '2026-08-11T01:00:00.000Z',
  },
};

// Start segment of the same event, clipped to day 1.
const startSegment = {
  id: 'ev-x',
  title: 'Night shift',
  start: '2026-08-10T22:00:00.000Z',
  end: '2026-08-11T00:00:00.000Z',
  __segment: {
    isStart: true,
    isEnd: false,
    originalStart: '2026-08-10T22:00:00.000Z',
    originalEnd: '2026-08-11T01:00:00.000Z',
  },
};

const renderSegment = (segment: any, onEventResize?: jest.Mock) =>
  render(
    <WeekEvent
      event={segment}
      dayDate={new Date('2026-08-11T00:00:00.000Z')}
      endHour={24}
      config={config}
      positionStyle={{ top: '0', height: '80px', left: '0', width: '100%' }}
      isDraggable={true}
      onEventResize={onEventResize}
    />
  );

describe('continuation segment', () => {
  test('never applies the active drag transform (start segment owns the drag)', () => {
    const { container } = renderSegment(continuationSegment);
    const translated = Array.from(container.querySelectorAll<HTMLElement>('*')).filter((el) =>
      (el.style.transform || '').includes('translate3d')
    );
    expect(translated).toHaveLength(0);
  });

  test('exposes end-side handles (it contains the real end)', () => {
    renderSegment(continuationSegment, jest.fn());
    const enable = JSON.parse(screen.getByTestId('resizable').getAttribute('data-enable')!);
    expect(enable.bottom).toBe(true);
  });

  test('shows no resize handles when resizing is off (no onEventResize)', () => {
    renderSegment(continuationSegment);
    const enable = JSON.parse(screen.getByTestId('resizable').getAttribute('data-enable')!);
    expect(enable.bottom).toBe(false);
    expect(enable.right).toBe(false);
  });

  test('bottom resize emits the TRUE bounds and original id — never the clipped midnight start', () => {
    const onEventResize = jest.fn();
    renderSegment(continuationSegment, onEventResize);
    fireEvent.click(screen.getByTestId('resize-bottom-60'));

    expect(onEventResize).toHaveBeenCalledTimes(1);
    const emitted = onEventResize.mock.calls[0][0];
    expect(emitted.id).toBe('ev-x'); // ::cont stripped
    expect(emitted.start).toBe('2026-08-10T22:00:00.000Z'); // original start preserved
    // +80px at 30min/40px = +60min on the true end (01:00 -> 02:00)
    expect(emitted.end).toBe('2026-08-11T02:00:00.000Z');
    expect(emitted.isMultiDay).toBe(true);
    expect(emitted.__segment).toBeUndefined(); // metadata stripped
  });
});

describe('horizontal multi-day resize (one gesture)', () => {
  const plainEvent = {
    id: 'ev-p',
    title: 'Workshop',
    start: '2026-08-10T14:00:00.000Z',
    end: '2026-08-10T15:00:00.000Z',
  };

  test('right handle dragged 5 columns extends the end by exactly 5 days', () => {
    const onEventResize = jest.fn();
    renderSegment(plainEvent, onEventResize);
    fireEvent.click(screen.getByTestId('resize-right-5cols'));

    expect(onEventResize).toHaveBeenCalledTimes(1);
    const emitted = onEventResize.mock.calls[0][0];
    expect(emitted.start).toBe('2026-08-10T14:00:00.000Z');
    expect(emitted.end).toBe('2026-08-15T15:00:00.000Z'); // +5 days, time kept
    expect(emitted.isMultiDay).toBe(true);
  });

  test('no maxWidth clamp on the resizable (it silently blocked horizontal resize)', () => {
    renderSegment(plainEvent);
    const resizable = screen.getByTestId('resizable');
    expect(resizable.style.maxWidth).toBe('');
  });
});

describe('start segment of a crossing event', () => {
  test('owns the drag: shown as the ghost while the overlay moves (no translate)', () => {
    const { container } = renderSegment(startSegment);
    const all = Array.from(container.querySelectorAll<HTMLElement>('*'));
    expect(all.filter((el) => (el.style.transform || '').includes('translate3d'))).toHaveLength(0);
    expect(all.filter((el) => el.style.opacity === '0.35')).toHaveLength(1);
  });

  test('hides end-side handles (its bottom edge is midnight, not the real end)', () => {
    renderSegment(startSegment);
    const enable = JSON.parse(screen.getByTestId('resizable').getAttribute('data-enable')!);
    expect(enable.bottom).toBe(false);
    expect(enable.right).toBe(false);
  });
});
