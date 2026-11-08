import './index.css';
import React from "react";
import {
  CalendarApi,
  CalendarProps,
  CalendarConfig,
  DatesSetInfo,
  CalendarHeaderProps,
  CalendarView,
  ClassNamesInput,
  Config,
  DayCellClassNamesArg,
  DayCellClassNamesGenerator,
  EventClassNamesArg,
  EventClassNamesGenerator,
  DateRangeSelection,
  DayViewProps,
  EventContentArg,
  EventContentRenderer,
  EventProps,
  ExportOption,
  RecurrenceInput,
  RecurrenceObject,
  ValidRange,
  Weekday,
  ListViewProps,
  MonthViewProps,
  Resource,
  ChangeRejectedInfo,
  ChangeRejection,
  ChangeSource,
  ChangeVerdict,
  EventChange,
  EventConstraintRule,
  EventOverlapRule,
  WeeklyInterval,
} from "./types/types";
import {
  NotificationServiceConfig,
  EmailAdapter,
} from "./types/notification";
import {
  DataSourceConfigProps,
} from "./types/dataSource";
import {
  FilterPluginProps,
  SearchPluginProps,
} from "./types/search";
import {
  CalendarPlugin,
  ChangeContext,
  DataSourcePlugin,
  EventLike,
  ExportPlugin,
  MiddlewarePlugin,
  ThemePlugin,
  ViewPlugin,
  ViewRangeContext,
} from "./types/plugins";
import { findOverlapConflicts, satisfiesConstraint, validateChange } from './Utils/changeRules';
import { ExternalDraggable, type ExternalDraggableProps } from './Components/ExternalDraggable';
import { useCalendarView, type CalendarViewApi, type SchedulePatch } from './hooks/useCalendarView';
import { useDropZone, useEventDraggable, type DropZoneTarget } from './hooks/useViewDrag';
import { InteractionProvider as AgendfyDndProvider } from './context/InteractionContext';
import { ToastProvider } from "./Components/Toast/Toast"; 
import CalendarComponent from "./View/Calendar";
import { ensureDate } from "./Utils/DateTrannforms";
import { downloadBlob } from './Utils/pluginUtils';
import { expandRecurrences } from './Utils/recurrence';

const WrappedCalendar = React.forwardRef<HTMLDivElement, CalendarProps>((props, ref) => {
  return (
    <ToastProvider>
      <CalendarComponent {...props} events={props.events ?? []} ref={ref} />
    </ToastProvider>
  );
});
WrappedCalendar.displayName = 'WrappedCalendar';

export {
  WrappedCalendar as Calendar,
  ensureDate,
  downloadBlob,
  expandRecurrences,
  validateChange,
  findOverlapConflicts,
  satisfiesConstraint,
  AgendfyDndProvider,
  ExternalDraggable,
  useCalendarView,
  useEventDraggable,
  useDropZone,
};
export type {
  CalendarApi,
  CalendarProps,
  CalendarConfig,
  DatesSetInfo,
  CalendarHeaderProps,
  CalendarView,
  ClassNamesInput,
  Config,
  DayCellClassNamesArg,
  DayCellClassNamesGenerator,
  EventClassNamesArg,
  EventClassNamesGenerator,
  DateRangeSelection,
  DayViewProps,
  EventContentArg,
  EventContentRenderer,
  RecurrenceInput,
  RecurrenceObject,
  ValidRange,
  Weekday,
  ListViewProps,
  MonthViewProps,
  ExportOption,
  EventProps,
  EventLike,
  NotificationServiceConfig,
  EmailAdapter,
  CalendarPlugin,
  DataSourcePlugin,
  DataSourceConfigProps,
  FilterPluginProps,
  SearchPluginProps,
  ThemePlugin,
  ExportPlugin,
  Resource,
  ViewPlugin,
  ViewRangeContext,
  ExternalDraggableProps,
  CalendarViewApi,
  SchedulePatch,
  DropZoneTarget,
  ChangeContext,
  MiddlewarePlugin,
  ChangeRejectedInfo,
  ChangeRejection,
  ChangeSource,
  ChangeVerdict,
  EventChange,
  EventConstraintRule,
  EventOverlapRule,
  WeeklyInterval,
};