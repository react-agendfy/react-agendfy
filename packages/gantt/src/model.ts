import type { EventProps } from "@react-agendfy/core";

/*
 * Gantt tasks are calendar events with extra fields (RFC 001): one source of
 * data, so the calendar's rules, undo, data sources and resources apply.
 */

/** Finish-to-start, start-to-start, finish-to-finish, start-to-finish. */
export type DependencyType = "FS" | "SS" | "FF" | "SF";

export interface TaskDependency {
  /** The predecessor task's id. */
  id: string | number;
  /** Default "FS": the task starts after the predecessor finishes. */
  type?: DependencyType;
  /** Minutes added to the constraint (negative = overlap). Default 0. */
  lag?: number;
}

/** The fields a task adds to an event. */
export interface TaskFields {
  /** "summary" spans its children; "milestone" is a point in time. Default "task". */
  type?: "task" | "milestone" | "summary";
  /** Done, 0–100. */
  progress?: number;
  /** The summary task this one belongs to. */
  parentId?: string | number;
  /** Predecessors: ids (finish-to-start) or full dependencies. */
  dependencies?: (string | number | TaskDependency)[];
  /** The planned dates, drawn under the bar. */
  baselineStart?: Date | string;
  baselineEnd?: Date | string;
}

export type Task = EventProps & TaskFields;

const TASK_TYPES = new Set(["task", "milestone", "summary"]);

/** Whether an event is a Gantt task (has a task type or a task field). */
export const isTask = (event: EventProps): boolean =>
  TASK_TYPES.has(event.type) ||
  event.progress !== undefined ||
  event.parentId !== undefined ||
  (Array.isArray(event.dependencies) && event.dependencies.length > 0);

export const taskType = (task: Task): "task" | "milestone" | "summary" =>
  task.type === "milestone" || task.type === "summary" ? task.type : "task";

export const dependenciesOf = (task: Task): Required<TaskDependency>[] =>
  (task.dependencies ?? []).map((d) =>
    typeof d === "object" ? { id: d.id, type: d.type ?? "FS", lag: d.lag ?? 0 } : { id: d, type: "FS", lag: 0 }
  );

export const ms = (value: Date | string) => new Date(value).getTime();
