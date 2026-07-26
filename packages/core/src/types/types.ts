import type React from "react";
import { TZDate } from "@date-fns/tz";
import { CalendarPlugin } from "./plugins";
import type { EmailAdapter, NotificationServiceConfig } from "./notification";

/** All view identifiers the calendar can render. */
export type CalendarView = "month" | "week" | "day" | "list" | "agenda";

/**
 * Narrow escape hatch for locale dictionaries: translation bundles may carry
 * additional string entries keyed dynamically. Values are always strings.
 */
export interface LocaleStrings {
  [key: string]: string | undefined;
}

export interface Config {
  timeZone: string;
  defaultView: CalendarView;
  slotDuration: number;
  slotLabelFormat: string;
  slotMin: string;
  slotMax: string;
  lang: string;
  today: string;
  monthView: string;
  weekView: string;
  dayView: string;
  listView: string;
  agenda: string;
  all_day: string;
  filter_resources: string;
  clear_filter?: string;
  businessHours: {
    enabled: boolean;
    intervals: {
      daysOfWeek: number[];
      startTime: string;
      endTime: string;
    }[];
  };
  alerts?: {
    enabled: boolean;
    thresholdMinutes: number;
  };
  emailAdapter?: EmailAdapter | null;
  emailConfig?: NotificationServiceConfig["emailConfig"];
  export?: boolean;
  calendar_export: string;
}

/** Alias kept for helpers that reference the config under an older name. */
export type CalendarConfig = Config;

/** Locale-only subset used by locale helpers. */
export interface LocaleConfig {
  today: string;
  monthView: string;
  weekView: string;
  dayView: string;
}
export interface WeekProps  {
  events:EventProps[],
  onEventUpdate?: (event: EventProps) => void;
  onEventClick?: (event: EventProps) => void;
  onDayClick?: (day: Date) => void;
  onSlotClick?: (slotTime: Date) => void;
  onEventResize?: (event: EventProps) => void;
  onDateRangeSelect?: (selection: EventProps) => void;
  currentDate: TZDate,
  slotMin: string,
  slotMax: string,
  config: Config,
  interactionPlugin?: CalendarPlugin[];
  eventRenderingPlugins?: CalendarPlugin[];
}

export interface CalendarDayProps {
  day: TZDate | null;
  events?: EventProps[];
  onDayClick?: (day: TZDate) => void;
  onEventClick?: (event: EventProps) => void;
  onEventResize?: (event: EventProps) => void;
  onMouseDown?: (day: Date) => void;
  onMouseMove?: (day: Date) => void;
  isSelected?: boolean;
  monthDate?: TZDate;
  isDroppable?: boolean;
  isDropTarget?: boolean;
  config: Config;
}
export interface BaseEventProps {
  event: EventProps;
  onEventClick?: (event: EventProps) => void;
  onEventUpdate?: (event: EventProps) => void;
  onEventResize?: (event: EventProps) => void;
  positionStyle?: PositionStyle;
  isPreview?: boolean;
  isMultiDay?: boolean;
  isStart?: boolean;
  isEnd?: boolean;
  config?: Config;
  dayDate?: any;
  isDraggable?: boolean;
  customClassName?: string;
  parsedSlotMax?: number;
}

export interface PositionStyle {
  top?: string | number;
  height?: string | number;
  [key: string]: any;
}

export type TimeSlotData = {
  [key: string]: number[];
};

export interface EventPositionStyle {
  left: string;
  width: string;
  top: string;
  marginLeft: string;
}

export interface MonthViewProps {
  events?: EventProps[];
  resources?: Resource[];
  currentDate?: TZDate;
  onEventUpdate?: (updatedEvent: EventProps) => void;
  onEventResize?: (updatedEvent: EventProps) => void;
  onDateRangeSelect?: (range: EventProps) => void;
  onDayClick?: (day: Date) => void;
  onEventClick?: (event: EventProps) => void;
  config: Config;
  showResourceView?: boolean;
}

export interface EventProps {
  id: string;
  title: string;
  start: Date | string;
  end: Date | string;
  allDay?: boolean;
  color?: string;
  resourceId?: string | number;
  resourceIds?: (string | number)[];
  [key: string]: any;
}

export interface Resource {
  id: string | number;
  title?: string;
  name?: string;
  type?: string;
  children?: Resource[];
  [key: string]: any;
}

/** Selection emitted when a user drags across a date range. */
export interface DateRangeSelection {
  start: string;
  end: string;
  isMultiDay: boolean;
}

export interface CalendarProps {
  events: EventProps[];
  resources?: Resource[];
  plugins?: CalendarPlugin[];
  /** Partial config; unspecified keys fall back to the built-in defaults. */
  config?: Partial<Config>;
  theme?: string;
  filteredResources?: string[];
  emailAdapter?: EmailAdapter;
  emailConfig?: NotificationServiceConfig["emailConfig"];
  currentDate?: Date;
  onEventUpdate?: (event: EventProps) => void;
  onEventResize?: (event: EventProps) => void;
  onEventClick?: (event: EventProps) => void;
  onDayClick?: (day: Date) => void;
  onSlotClick?: (slotTime: Date) => void;
  onDateRangeSelect?: (selection: EventProps) => void;
  onDateChange?: (date: Date) => void;
}

export interface TimeSlotProps {
  index: number;
  slotEvents: EventProps[];
  onEventUpdate?: (event: EventProps) => void;
  onSlotClick?: (event: Date) => void;
  onEventClick?: (event: EventProps) => void;
  onEventResize?: (event: EventProps) => void;
  parsedSlotMax: number;
  dayDate: any;
  slotMin: number;
  config?: Config;
  isDraggable?: boolean;
}
export interface DayColumnProps {
  dayDate: any;
  events: EventProps[];
  getEventsForDay: (dayDate: Date) => EventProps[];
  timeSlots: number[];
  onEventUpdate?: (event: EventProps) => void;
  onEventClick?: (event: EventProps) => void;
  onSlotClick?: (slotTime: Date) => void;
  onEventResize?: (event: EventProps) => void;
   eventRenderingPlugins?: CalendarPlugin[];
    onSelectionMouseDown?: (date: Date) => void;
    onSelectionMouseMove: (date: Date) => void;
    isSlotSelected: (date: Date) => boolean;
  parsedSlotMin: number;
  parsedSlotMax: number;
  redLineOffset: number;
  config?: Config;
  isDraggable: boolean;
}

export interface DayViewProps {
  events: EventProps[];
  currentDate: TZDate;
  config: Config;
  onEventUpdate?: (event: EventProps) => void;
  onEventClick?: (event: EventProps) => void;
  onSlotClick?: (slotTime: Date) => void;
  onEventResize?: (event: EventProps) => void;
}

export interface ListViewProps {
  events: EventProps[];
  currentDate?: TZDate | Date;
  config?: Config;
  onEventClick?: (event: EventProps) => void;
  onEventUpdate?: (event: EventProps) => void;
}

export interface ListEventProps {
  event: EventProps;
  currentDate?: TZDate | Date;
  config?: Config;
  onEventClick?: (event: EventProps) => void;
}

export interface ExportOption {
  formatName: string;
  label: string;
}

export interface CalendarHeaderProps {
  currentView: string;
  availableViews: { name: string; label: string }[];
  onViewChange: (view: string) => void;
  currentDate: TZDate | Date;
  onNavigate: (direction: "prev" | "next" | "today") => void;
  localeConfig: Config;
  onExport?: (format: string) => void;
  exportOptions?: ExportOption[];
  headerLeftPlugins?: React.ReactNode[];
  headerRightPlugins?: React.ReactNode[];
}
