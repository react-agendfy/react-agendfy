import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CalendarHeader from './CalendarHeader';

const localeConfig: any = {
  lang: 'en',
  today: 'Today',
  back: 'Back',
  next: 'Next',
  go_to_today: 'Go to today',
  export: true,
  calendar_export: 'Export',
};

const availableViews = [
  { name: 'month', label: 'Month' },
  { name: 'week', label: 'Week' },
];

describe('CalendarHeader accessibility', () => {
  it('marks the active view button with aria-pressed', () => {
    render(
      <CalendarHeader
        currentView="month"
        availableViews={availableViews as any}
        onViewChange={jest.fn()}
        currentDate={new Date('2023-01-15T00:00:00.000Z')}
        onNavigate={jest.fn()}
        localeConfig={localeConfig}
      />
    );
    expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('exposes the export dropdown as a menu with aria-haspopup/aria-expanded', () => {
    render(
      <CalendarHeader
        currentView="month"
        availableViews={availableViews as any}
        onViewChange={jest.fn()}
        currentDate={new Date('2023-01-15T00:00:00.000Z')}
        onNavigate={jest.fn()}
        localeConfig={localeConfig}
        onExport={jest.fn()}
        exportOptions={[{ formatName: 'ics', label: 'iCal' } as any]}
      />
    );
    const trigger = screen.getByRole('button', { name: /Export/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'iCal' })).toBeInTheDocument();
  });
});

describe('view groups (headerViews: [{ label, views }])', () => {
  const Calendar = require('../index').Calendar;
  const renderGroups = (defaultView = 'month') =>
    render(
      <Calendar
        events={[]}
        resources={[{ id: 'a', title: 'A' }]}
        currentDate={new Date('2026-03-11T12:00:00Z')}
        config={{
          timeZone: 'UTC',
          defaultView,
          headerViews: ['month', 'week', { label: 'Resources', views: ['resourceDay', 'resourceWeek'] }, { label: 'Solo', views: ['day'] }],
        }}
      />
    );

  it('shows a group as one menu button; choosing a view switches to it', async () => {
    renderGroups();
    const button = await screen.findByRole('button', { name: 'Resources' });
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    // A group of one view is a plain button.
    expect(screen.getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);
    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((i) => i.textContent)).toEqual(['Resource day', 'Resource week']);
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(items[1]).toHaveFocus();
    fireEvent.click(items[1]);

    expect(screen.queryByRole('menu')).toBeNull();
    // The button now shows the active view of its group.
    const active = await screen.findByRole('button', { name: 'Resource week' });
    expect(active).toHaveClass('react-agendfy-button-active');
    expect(active).toHaveFocus();
  });

  it('Escape closes the menu', async () => {
    renderGroups();
    fireEvent.click(await screen.findByRole('button', { name: 'Resources' }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
