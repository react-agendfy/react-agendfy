/**
 * Regression: while dragging, the event must move 1:1 with the pointer.
 *
 * WeekEvent (drag owner) wraps BaseEvent; both used to register useDraggable
 * with the SAME id. dnd-kit activates `transform` by id, so both layers
 * translated and the event drifted away from the pointer at 2x speed.
 * Exactly ONE rendered element may carry the drag translate3d.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { WeekEvent } from './WeekEvent';
import BaseEvent from '../../../Components/BaseEvent';

const DRAG_TRANSFORM = { x: 40, y: 80, scaleX: 1, scaleY: 1 };

jest.mock('@dnd-kit/core', () => {
  const originalModule = jest.requireActual('@dnd-kit/core');
  return {
    ...originalModule,
    // Simulate an active drag: every useDraggable instance that shares the
    // active id receives the same transform — exactly the real-world
    // condition that produced the double-translate drift.
    useDraggable: () => ({
      setNodeRef: jest.fn(),
      transform: DRAG_TRANSFORM,
      isDragging: true,
      attributes: {},
      listeners: {},
    }),
  };
});

const config = {
  timeZone: 'UTC',
  slotDuration: 30,
  lang: 'en',
} as any;

const event = {
  id: 'ev-1',
  title: 'Design review',
  start: '2026-08-03T09:00:00.000Z',
  end: '2026-08-03T10:00:00.000Z',
  color: '#4353ff',
};

function countTranslated(container: HTMLElement): number {
  return Array.from(container.querySelectorAll<HTMLElement>('*')).filter((el) =>
    (el.style.transform || '').includes('translate3d')
  ).length;
}

describe('drag translate is applied by exactly one layer', () => {
  test('WeekEvent during drag: exactly ONE translate3d in the tree', () => {
    const { container } = render(
      <WeekEvent
        event={event}
        dayDate={new Date('2026-08-03T00:00:00.000Z')}
        endHour={24}
        config={config}
        positionStyle={{ top: '0', height: '40px', left: '0', width: '100%' }}
        isDraggable={true}
      />
    );
    expect(countTranslated(container)).toBe(1);
  });

  test('BaseEvent with isDraggable=false never translates, even with an active same-id transform', () => {
    const { container } = render(
      <BaseEvent
        event={event}
        positionStyle={{ top: '0', height: '40px' }}
        config={config}
        isDraggable={false}
      />
    );
    expect(countTranslated(container)).toBe(0);
  });

  test('BaseEvent as standalone drag owner still translates (DayView path)', () => {
    const { container } = render(
      <BaseEvent
        event={event}
        positionStyle={{ top: '0', height: '40px' }}
        config={config}
        isDraggable={true}
      />
    );
    expect(countTranslated(container)).toBe(1);
  });
});
