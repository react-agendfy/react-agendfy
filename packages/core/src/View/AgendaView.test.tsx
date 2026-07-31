import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AgendaView from './AgendaView';

const dummyConfig: any = {
  timeZone: 'UTC',
  lang: 'en',
};

const dummyEvents: any[] = [
  {
    id: 'evt-1',
    title: 'Team Meeting',
    start: '2023-01-15T09:00:00.000Z',
    end: '2023-01-15T10:00:00.000Z',
    color: '#FF0000',
  },
];

const currentDate = new Date('2023-01-15T00:00:00.000Z');

describe('AgendaView accessibility', () => {
  it('renders events as focusable buttons with descriptive aria-labels', () => {
    render(
      <AgendaView events={dummyEvents} config={dummyConfig} currentDate={currentDate as any} />
    );
    const el = screen.getByRole('button', { name: 'Team Meeting, 09:00 - 10:00' });
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('tabindex', '0');
  });

  it('fires onEventClick when Enter is pressed on an event', () => {
    const onEventClick = jest.fn();
    render(
      <AgendaView
        events={dummyEvents}
        config={dummyConfig}
        currentDate={currentDate as any}
        onEventClick={onEventClick}
      />
    );
    const el = screen.getByRole('button', { name: 'Team Meeting, 09:00 - 10:00' });
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onEventClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'evt-1' }));
  });
});
