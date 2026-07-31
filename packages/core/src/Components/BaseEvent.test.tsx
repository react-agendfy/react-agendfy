import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import BaseEvent from './BaseEvent';

const dummyConfig: any = {
  timeZone: 'UTC',
  slotDuration: 30,
};

const dummyEvent: any = {
  id: 'evt-1',
  title: 'Team Meeting',
  start: '2023-01-15T09:00:00.000Z',
  end: '2023-01-15T10:00:00.000Z',
  color: '#FF0000',
  resources: [],
};

const renderBaseEvent = (props: any = {}) =>
  render(
    <DndContext>
      <BaseEvent
        event={dummyEvent}
        config={dummyConfig}
        isDraggable={false}
        {...props}
      />
    </DndContext>
  );

describe('BaseEvent accessibility', () => {
  it('renders as a focusable button with a descriptive aria-label', () => {
    renderBaseEvent();
    const el = screen.getByRole('button', { name: 'Team Meeting, 09:00 - 10:00' });
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('tabindex', '0');
  });

  it('fires onEventClick when Enter is pressed', () => {
    const onEventClick = jest.fn();
    renderBaseEvent({ onEventClick });
    const el = screen.getByRole('button', { name: 'Team Meeting, 09:00 - 10:00' });
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onEventClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt-1' }));
  });

  it('fires onEventClick when Space is pressed on a non-draggable event', () => {
    const onEventClick = jest.fn();
    renderBaseEvent({ onEventClick, isDraggable: false });
    const el = screen.getByRole('button', { name: 'Team Meeting, 09:00 - 10:00' });
    fireEvent.keyDown(el, { key: ' ' });
    expect(onEventClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt-1' }));
  });
});
