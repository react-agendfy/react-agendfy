import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DayView from './DayView';

jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd: (e: any) => void }) => (
    <div data-testid="dnd-context">
      <button
        data-testid="simulate-drag-end"
        onClick={() => onDragEnd(globalThis.simulatedDragEndEvent)}
      >
        Simulate Drag End
      </button>
      {children}
    </div>
  ),
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useDroppable: jest.fn(() => ({ setNodeRef: jest.fn(), isOver: false })),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
  PointerSensor: jest.fn(),
  KeyboardSensor: jest.fn(),
}));


jest.mock('./Components/TimeSlot.tsx', () => ({
  TimeSlot: ({ index, slotEvents }: { index: number; slotEvents: any[] }) => (
    <div data-testid="time-slot" data-index={index}>
      TimeSlot {index} - {JSON.stringify(slotEvents)}
    </div>
  ),
}));

describe('DayView Component', () => {
  const dummyConfig = {
    timeZone: 'UTC',
    slotDuration: 30,
    slotMin: "08:00", 
    slotMax: "10:00", 
    timeZone: 'UTC',
  };

  const dummyEvents = [
    {
      id: '1',
      title: 'Event 1',
      start: '2023-01-01T08:00:00Z',
      end: '2023-01-01T09:00:00Z',
    },
    {
      id: '2',
      title: 'Recurring Event',
      start: '2023-01-01T10:00:00Z',
      end: '2023-01-01T11:00:00Z',
      recurrence: 'FREQ=DAILY;COUNT=5',
    },
    {
      id: '3',
      title: 'Multi-day Event',
      start: '2023-01-01T12:00:00Z',
      end: '2023-01-02T12:00:00Z',
      isMultiDay: true,
    },
  ];

  const baseProps = {
    events: dummyEvents,
    onEventUpdate: jest.fn(),
    onEventClick: jest.fn(),
    onSlotClick: jest.fn(),
    currentDate: new Date('2023-01-01T00:00:00Z'),
    config: dummyConfig,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders error message when numberOfSlots is invalid', () => {
    const props = { ...baseProps, config: { ...baseProps.config, slotMin: "10", slotMax: "10" } };
    render(<DayView {...props} />);
    expect(screen.getByText(/invalid time slot/i)).toBeInTheDocument();
  });

  test('renders correct number of TimeSlot components', () => {
    render(<DayView {...baseProps} />);
    const timeSlots = screen.getAllByTestId('time-slot');
    expect(timeSlots.length).toBe(4);
  });

  test('renders red line overlay if current date is today', () => {
    // The line shows only while "now" is inside the grid (08:00-10:00 UTC).
    jest.useFakeTimers({ now: new Date('2026-03-11T09:15:00Z') });
    try {
      const props = { ...baseProps, currentDate: new Date('2026-03-11T09:15:00Z') };
      const { container } = render(<DayView {...props} />);
      const redLine = container.querySelector('.react-agendfy-now-line') as HTMLElement;
      expect(redLine).toBeInTheDocument();
      // 75 min after 08:00 with 30-min slots of 40px.
      expect(redLine.style.top).toBe('100px');
    } finally {
      jest.useRealTimers();
    }
  });

  test('hides the red line when now is outside the grid hours', () => {
    jest.useFakeTimers({ now: new Date('2026-03-11T13:00:00Z') });
    try {
      const props = { ...baseProps, currentDate: new Date('2026-03-11T13:00:00Z') };
      const { container } = render(<DayView {...props} />);
      expect(container.querySelector('.react-agendfy-now-line')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
