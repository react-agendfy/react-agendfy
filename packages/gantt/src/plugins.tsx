import React from "react";
import { addDays, addMonths, startOfMonth, startOfWeek } from "date-fns";
import { TZDate } from "@date-fns/tz";
import type { CalendarPlugin, MiddlewarePlugin, ViewPlugin } from "@react-agendfy/core";
import GanttView, { type GanttOptions, type GanttToolbarConfig, type GanttZoom } from "./Gantt";
import { isTask, type Task } from "./model";
import { cascadeChange } from "./schedule";
import { messages } from "./messages";

const ranges: Record<GanttZoom, NonNullable<ViewPlugin["range"]>> = {
  week: (date, { timeZone, weekStartsOn }) => {
    const start = startOfWeek(new TZDate(date.getTime(), timeZone), { weekStartsOn });
    return { start: new Date(start.getTime()), end: new Date(addDays(start, 7).getTime()) };
  },
  month: (date, { timeZone }) => {
    const start = startOfMonth(new TZDate(date.getTime(), timeZone));
    return { start: new Date(start.getTime()), end: new Date(addMonths(start, 1).getTime()) };
  },
  quarter: (date, { timeZone }) => {
    const start = startOfMonth(new TZDate(date.getTime(), timeZone));
    return { start: new Date(start.getTime()), end: new Date(addMonths(start, 3).getTime()) };
  },
};

/**
 * The `gantt` view: shows the events that are tasks (see `isTask`).
 * Use it with `ganttScheduling` so moving a task pushes its successors.
 */
export function createGanttView(
  options: GanttOptions = {},
  /** Internal (the standalone <Gantt>): one view per zoom, with a toolbar. */
  internal: { viewName?: string; toolbar?: GanttToolbarConfig } = {}
): ViewPlugin {
  const zoom = options.zoom ?? "month";
  const viewName = internal.viewName ?? "gantt";
  const View = () => <GanttView options={options} toolbar={internal.toolbar} />;
  View.displayName = `Gantt(${zoom})`;
  return {
    key: viewName,
    type: "view",
    viewName,
    label: { key: "gantt.view" },
    messages,
    range: ranges[zoom],
    step: { unit: zoom === "quarter" ? "month" : zoom },
    component: View,
  };
}

/**
 * Auto-scheduling: when a task moves or changes length, its successors
 * (and summaries) move with it, as one change with one undo. Works in every
 * view, not just the Gantt.
 */
export function createGanttScheduling(options: { taskFilter?: GanttOptions["taskFilter"] } = {}): MiddlewarePlugin {
  const filter = options.taskFilter ?? isTask;
  return {
    key: "gantt-scheduling",
    type: "middleware",
    cascade: (change, ctx) => {
      if (!filter(change.event) || !ctx.events) return [];
      return cascadeChange(ctx.events().filter(filter) as Task[], change.event as Task);
    },
  };
}

/** The view and the scheduling, ready for `plugins`. */
export function createGanttPlugins(options: GanttOptions = {}): CalendarPlugin[] {
  return [createGanttView(options), createGanttScheduling(options)];
}

export const ganttView = createGanttView();
export const ganttScheduling = createGanttScheduling();
export const ganttPlugins: CalendarPlugin[] = [ganttView, ganttScheduling];
