import React from 'react';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from './../Components/Toast/Toast';
import Calendar from '../View/Calendar';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
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

jest.mock('./DayView/DayView', () => () => (
  <div data-testid="day-view">DayView</div>
));
jest.mock('./WeekView/WeekView', () => () => (
  <div data-testid="week-view">WeekView</div>
));
jest.mock('./MonthView/MonthView.tsx', () => () => (
  <div data-testid="month-view">MonthView</div>
));
jest.mock('./ListView/ListView', () => () => (
  <div data-testid="list-view">ListView</div>
));

const renderCalendar = (props: Partial<React.ComponentProps<typeof Calendar>> = {}) =>
  render(
    <ToastProvider>
      <Calendar events={[]} config={{ defaultView: 'week', lang: 'en' }} {...props} />
    </ToastProvider>
  );

const getRoot = (container: HTMLElement) =>
  container.querySelector('.react-agendfy-layout') as HTMLElement;

describe('Calendar i18n integration', () => {
  describe('locale catalog resolution', () => {
    it('uses the English catalog by default', async () => {
      renderCalendar();
      expect(await screen.findByText('Today')).toBeInTheDocument();
      expect(screen.getByText('Month')).toBeInTheDocument();
    });

    it('uses the built-in catalog for config.lang', async () => {
      renderCalendar({ config: { defaultView: 'week', lang: 'pt' } });
      expect(await screen.findByText('Hoje')).toBeInTheDocument();
      expect(screen.getByText('Mês')).toBeInTheDocument();
      expect(screen.getByText('Semana')).toBeInTheDocument();
    });

    it('lets explicit config keys override the catalog', async () => {
      renderCalendar({
        config: { defaultView: 'week', lang: 'pt', today: 'Custom Today' },
      });
      expect(await screen.findByText('Custom Today')).toBeInTheDocument();
      // Non-overridden keys still come from the pt catalog.
      expect(screen.getByText('Mês')).toBeInTheDocument();
    });
  });

  describe('text direction', () => {
    it('sets dir="ltr" for LTR languages', async () => {
      const { container } = renderCalendar();
      await screen.findByTestId('week-view');
      expect(getRoot(container)).toHaveAttribute('dir', 'ltr');
    });

    it('sets dir="rtl" for Arabic', async () => {
      const { container } = renderCalendar({
        config: { defaultView: 'week', lang: 'ar' },
      });
      await screen.findByTestId('week-view');
      expect(getRoot(container)).toHaveAttribute('dir', 'rtl');
    });

    it('lets the direction prop override the language-derived value', async () => {
      const { container } = renderCalendar({
        config: { defaultView: 'week', lang: 'ar' },
        direction: 'ltr',
      });
      await screen.findByTestId('week-view');
      expect(getRoot(container)).toHaveAttribute('dir', 'ltr');
    });
  });
});
