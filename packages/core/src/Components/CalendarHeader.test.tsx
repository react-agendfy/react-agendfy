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
