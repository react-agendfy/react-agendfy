import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Calendar,
  type CalendarApi,
  type CalendarProps,
  type CalendarPlugin,
  type CalendarView,
  type EventProps,
  type MiddlewarePlugin,
} from "@react-agendfy/core";
import type { GanttOptions, GanttZoom } from "./Gantt";
import type { Task } from "./model";
import { createGanttScheduling, createGanttView } from "./plugins";

/*
 * <Gantt>: the Gantt on its own, in project vocabulary (tasks, zoom,
 * onTaskChange). Underneath it is the calendar's engine — drag, rules,
 * undo, time zones — with one view per zoom and its own toolbar.
 */

export interface GanttApi {
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  today(): void;
  prev(): void;
  next(): void;
  gotoDate(date: Date | string): void;
  getDate(): Date;
  getZoom(): GanttZoom;
  setZoom(zoom: GanttZoom): void;
}

/** Why a change was refused, in tasks. */
export interface GanttChangeRejectedInfo {
  /** The task that was moved, resized or edited. */
  task: Task;
  /** The tasks it would have pushed. */
  moved: Task[];
  /** A short code: "overlap", "constraint", "allow", "readonly"… */
  reason: string;
  message?: string;
}

export type GanttDirection = NonNullable<CalendarProps["direction"]>;

export interface GanttProps extends Pick<GanttOptions, "columns" | "dayWidth" | "rowHeight" | "criticalPath"> {
  /** The tasks. `allDay` defaults to true: `end` is the day after the last one. */
  tasks: Task[];
  /** The zoom (controlled; pair it with `onZoomChange`). */
  zoom?: GanttZoom;
  /** The first zoom when `zoom` is not given. Default "month". */
  defaultZoom?: GanttZoom;
  onZoomChange?: (zoom: GanttZoom) => void;
  /** The date shown first. Default today. */
  date?: Date | string;
  /**
   * A task changed (moved, resized, progress) and, with it, the tasks it
   * pushed: one call per change, undo included. Return a rejected promise to
   * revert all of them.
   */
  onTaskChange?: (task: Task, moved: Task[]) => void | Promise<unknown>;
  onTaskClick?: (task: Task) => void;
  /** An empty day was clicked. */
  onDateClick?: (date: Date) => void;
  /** A change was refused (for example, a pushed task broke a rule). */
  onChangeRejected?: (info: GanttChangeRejectedInfo) => void;
  /** No drag, resize or progress changes. */
  readOnly?: boolean;
  /** Working days, 0 = Sunday … 6 = Saturday. The others are shaded. Default Monday–Friday. */
  workingDays?: number[];
  timeZone?: string;
  lang?: string;
  direction?: GanttDirection;
  theme?: string;
  className?: string;
  apiRef?: React.Ref<GanttApi>;
}

const ZOOMS: GanttZoom[] = ["week", "month", "quarter"];
const viewOf = (zoom: GanttZoom) => `gantt-${zoom}`;
const zoomOf = (view: string): GanttZoom => ZOOMS.find((z) => viewOf(z) === view) ?? "month";
const every = () => true;

interface Batch {
  main: string;
  related: number;
  task?: Task;
  moved: Task[];
  promise: Promise<unknown>;
  settle: (result: unknown) => void;
}

export function Gantt({
  tasks,
  zoom: controlledZoom,
  defaultZoom = "month",
  onZoomChange,
  date,
  onTaskChange,
  onTaskClick,
  onDateClick,
  onChangeRejected,
  readOnly = false,
  workingDays,
  timeZone,
  lang,
  direction,
  theme,
  className,
  apiRef,
  columns,
  dayWidth,
  rowHeight,
  criticalPath,
}: GanttProps) {
  const calRef = useRef<CalendarApi>(null);
  const [initialZoom] = useState(controlledZoom ?? defaultZoom);

  /* --- tasks → events (all-day unless said otherwise) --------------------- */
  const implicitAllDay = useMemo(() => new Set(tasks.filter((t) => t.allDay === undefined).map((t) => String(t.id))), [tasks]);
  const events = useMemo(() => tasks.map((t) => (t.allDay === undefined ? { ...t, allDay: true } : t)), [tasks]);
  const toTask = useCallback(
    (event: EventProps): Task => {
      const task = { ...event } as Task;
      if (implicitAllDay.has(String(event.id))) delete task.allDay;
      return task;
    },
    [implicitAllDay]
  );

  /*
   * One onTaskChange per change: the calendar calls back each event it moved
   * (the task first, then the ones it pushed), all in the same tick. The
   * middleware's onCommit says how many to expect.
   */
  const batchRef = useRef<Batch | null>(null);
  const batchPlugin = useMemo<MiddlewarePlugin>(
    () => ({
      key: "gantt-batch",
      type: "middleware",
      onCommit: (change) => {
        let settle!: (result: unknown) => void;
        const promise = new Promise((resolve, reject) => {
          settle = (result) =>
            result && typeof (result as Promise<unknown>).then === "function"
              ? (result as Promise<unknown>).then(resolve, reject)
              : resolve(result);
        });
        batchRef.current = { main: String(change.event.id), related: change.related?.length ?? 0, moved: [], promise, settle };
      },
    }),
    []
  );
  const onEventChange = useCallback(
    (event: EventProps) => {
      const batch = batchRef.current;
      const task = toTask(event);
      if (!batch) return onTaskChange?.(task, []);
      if (String(event.id) === batch.main && !batch.task) batch.task = task;
      else batch.moved.push(task);
      if (batch.task && batch.moved.length >= batch.related) {
        batchRef.current = null;
        batch.settle(onTaskChange?.(batch.task, batch.moved));
      }
      return batch.promise;
    },
    [onTaskChange, toTask]
  );

  /* --- one view per zoom, with the toolbar ------------------------------- */
  const plugins = useMemo<CalendarPlugin[]>(() => {
    const toolbar = { zooms: ZOOMS.map((z) => ({ zoom: z, view: viewOf(z) })) };
    const options = { columns, dayWidth, rowHeight, criticalPath, taskFilter: every };
    return [
      ...ZOOMS.map((zoom) => createGanttView({ ...options, zoom }, { viewName: viewOf(zoom), toolbar })),
      createGanttScheduling({ taskFilter: every }),
      batchPlugin,
    ];
  }, [columns, dayWidth, rowHeight, criticalPath, batchPlugin]);

  const config = useMemo(
    () => ({
      defaultView: viewOf(initialZoom) as CalendarView,
      showHeader: false,
      export: false,
      editable: !readOnly,
      ...(timeZone && { timeZone }),
      ...(lang && { lang }),
      ...(workingDays && {
        businessHours: { enabled: true, intervals: [{ daysOfWeek: workingDays, startTime: "09:00", endTime: "17:00" }] },
      }),
    }),
    [initialZoom, readOnly, timeZone, lang, workingDays]
  );

  /* --- zoom: controlled or not ------------------------------------------- */
  useEffect(() => {
    const api = calRef.current;
    if (controlledZoom && api && api.getView().type !== viewOf(controlledZoom)) api.changeView(viewOf(controlledZoom));
  }, [controlledZoom]);

  useImperativeHandle(
    apiRef,
    (): GanttApi => ({
      undo: () => calRef.current?.undo(),
      redo: () => calRef.current?.redo(),
      canUndo: () => !!calRef.current?.canUndo(),
      canRedo: () => !!calRef.current?.canRedo(),
      today: () => calRef.current?.today(),
      prev: () => calRef.current?.prev(),
      next: () => calRef.current?.next(),
      gotoDate: (d) => calRef.current?.gotoDate(d),
      getDate: () => calRef.current?.getDate() ?? new Date(),
      getZoom: () => zoomOf(calRef.current?.getView().type ?? ""),
      setZoom: (zoom) => calRef.current?.changeView(viewOf(zoom)),
    }),
    []
  );

  const currentDate = useMemo(() => (date === undefined ? undefined : new Date(date)), [date]);

  return (
    <Calendar
      className={["agendfy-gantt-standalone", className].filter(Boolean).join(" ")}
      apiRef={calRef}
      events={events}
      currentDate={currentDate}
      plugins={plugins}
      config={config}
      direction={direction}
      theme={theme}
      onEventUpdate={onEventChange}
      onEventResize={onEventChange}
      onEventClick={onTaskClick && ((event) => onTaskClick(toTask(event)))}
      onSlotClick={onDateClick && ((day) => onDateClick(day))}
      onChangeRejected={
        onChangeRejected &&
        (({ change, reason, message }) =>
          onChangeRejected({ task: toTask(change.event), moved: (change.related ?? []).map((r) => toTask(r.event)), reason, message }))
      }
      onViewChange={(view) => onZoomChange?.(zoomOf(view))}
    />
  );
}
