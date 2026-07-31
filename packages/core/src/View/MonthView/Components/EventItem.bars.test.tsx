/**
 * Month-view multiday ROW-BAR geometry: one continuous visible bar per week
 * row (percentage stretch bridging cell paddings/borders), invisible
 * interactive pieces underneath, correct rounding at real start/end only.
 * Regression for the discontinuous bar: pixel-based stretch dropped borders
 * (seams) and duration-in-24h-periods missed calendar days (gaps).
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
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

jest.mock('re-resizable', () => ({
  // Mirrors the two real re-resizable behaviors that bit us: `size` wins
  // over `style` for width, AND any size string without a recognized unit
  // suffix gets 'px' appended (turning calc() into invalid CSS). The stretch
  // must therefore live on OUR wrapper div, never on Resizable.
  Resizable: ({ children, style, size }: any) => (
    <div data-testid="resizable" style={style} data-width={size?.width ?? ''}>
      {children}
    </div>
  ),
}));

/** The stretch channel: our own wrapper around Resizable. */
const barWrapper = () =>
  document.querySelector('.react-agendfy-month-bar') as HTMLElement;

const config = { timeZone: 'UTC', slotDuration: 30, lang: 'en' } as any;

// 2026-08-13 (Thursday) 01:00 → 2026-08-15 (Saturday) 02:00 — 3 calendar days.
const threeDay = {
  id: 'carro',
  title: 'carro',
  start: '2026-08-13T01:00:00.000Z',
  end: '2026-08-15T02:00:00.000Z',
};

const renderPiece = (props: Partial<React.ComponentProps<typeof EventItem>>) =>
  render(
    <EventItem
      event={threeDay as any}
      dayWidth={120}
      config={config}
      isStart={false}
      isEnd={false}
      {...(props as any)}
    />
  );

const chip = (container: HTMLElement) =>
  container.querySelector('.react-agendfy-event-item') as HTMLElement;

describe('multiday row-bar geometry', () => {
  test('start piece stretches 3 cells with the gap-bridging calc (no pixel math)', () => {
    renderPiece({ isStart: true, cellDate: new Date('2026-08-13T00:00:00.000Z') });
    const width = barWrapper().style.width;
    expect(width).toBe('calc(300% + 2 * var(--agendfy-month-day-gap, 17px))');
    // The calc must NEVER flow through Resizable's size: re-resizable appends
    // 'px' to unrecognized strings, producing invalid CSS the browser drops.
    expect(screen.getByTestId('resizable').getAttribute('data-width')).toBe('100%');
  });

  test('start piece: rounded at start AND end (its stretch reaches the event end)', () => {
    const { container } = renderPiece({ isStart: true, cellDate: new Date('2026-08-13T00:00:00.000Z') });
    const c = chip(container);
    expect(c.style.borderStartStartRadius).toBe('var(--agendfy-radius-sm)');
    expect(c.style.borderStartEndRadius).toBe('var(--agendfy-radius-sm)');
  });

  test('covered middle piece is invisible, non-stretched and hidden from AT', () => {
    const { container } = renderPiece({ cellDate: new Date('2026-08-14T00:00:00.000Z') });
    expect(barWrapper().style.width).toBe('100%');
    const c = chip(container);
    expect(c.style.backgroundColor).toBe('transparent');
    expect(c.getAttribute('aria-hidden')).toBe('true');
    expect(c.getAttribute('tabindex')).toBe('-1');
    expect(c.getAttribute('role')).toBeNull();
  });

  test('row-wrap: a Sunday continuation piece is visible and stretched for the remaining days', () => {
    // Same event shifted to span Sat 2026-08-15 → Mon 2026-08-17; the Sunday
    // (2026-08-16) cell starts a new week row and must render its own bar
    // covering Sun+Mon (2 cells), with no start rounding (event began earlier).
    const wrapped = { ...threeDay, start: '2026-08-15T10:00:00.000Z', end: '2026-08-17T12:00:00.000Z' };
    const { container } = render(
      <EventItem
        event={wrapped as any}
        dayWidth={120}
        config={config}
        isStart={false}
        isEnd={false}
        cellDate={new Date('2026-08-16T00:00:00.000Z')}
      />
    );
    expect(barWrapper().style.width).toBe(
      'calc(200% + 1 * var(--agendfy-month-day-gap, 17px))'
    );
    const c = chip(container);
    expect(c.style.backgroundColor).not.toBe('transparent'); // visible bar
    expect(c.style.borderStartStartRadius).toBe('0'); // continues from previous row
    expect(c.style.borderStartEndRadius).toBe('var(--agendfy-radius-sm)'); // reaches event end
  });

  test('an end at exactly midnight does not bleed the bar into the next day', () => {
    const midnightEnd = { ...threeDay, start: '2026-08-13T10:00:00.000Z', end: '2026-08-15T00:00:00.000Z' };
    render(
      <EventItem
        event={midnightEnd as any}
        dayWidth={120}
        config={config}
        isStart={true}
        isEnd={false}
        cellDate={new Date('2026-08-13T00:00:00.000Z')}
      />
    );
    // Visually ends on the 14th → 2 cells, not 3.
    expect(barWrapper().style.width).toBe(
      'calc(200% + 1 * var(--agendfy-month-day-gap, 17px))'
    );
  });

  test('single-day chip: plain 100% width, visible, keeps base rounding', () => {
    const single = { id: 's', title: 'Review', start: '2026-08-13T10:00:00.000Z', end: '2026-08-13T11:00:00.000Z' };
    const { container } = render(
      <EventItem event={single as any} dayWidth={120} config={config} isStart={true} isEnd={true} cellDate={new Date('2026-08-13T00:00:00.000Z')} />
    );
    expect(barWrapper().style.width).toBe('100%');
    expect(chip(container).style.borderStartStartRadius).toBe(''); // base CSS, no inline override
  });
});
