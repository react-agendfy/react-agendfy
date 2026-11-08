import type { EventProps } from "../types/types";
import { defaultResource } from "./calendarHelpers";

/*
 * Undo/redo stacks of the change pipeline (RFC 001, layer 1). An entry keeps
 * the event before and after an accepted move/resize; undo re-applies only
 * the fields a move/resize touches, so edits made to other fields in the
 * meantime survive.
 */

/** Fields a move or resize changes — the only ones undo/redo restore. */
export const HISTORY_FIELDS = ["start", "end", "allDay", "resourceId", "resourceIds", "resources"] as const;

export interface HistoryEntry {
  id: number;
  kind: "move" | "resize";
  before: EventProps;
  after: EventProps;
}

const sameValue = (a: unknown, b: unknown): boolean => {
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : typeof a === "string" ? Date.parse(a) : NaN;
    const tb = b instanceof Date ? b.getTime() : typeof b === "string" ? Date.parse(b) : NaN;
    return ta === tb;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    // Ids, or resource objects compared by id.
    const key = (v: unknown) => String(v && typeof v === "object" ? (v as { id?: unknown }).id : v);
    return a.length === b.length && a.every((v, i) => key(v) === key(b[i]));
  }
  if (typeof a === "string" && typeof b === "string" && a !== b) {
    // "…Z" vs "…+00:00" describe the same instant.
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (!isNaN(ta) && !isNaN(tb) && /T/.test(a) && /T/.test(b)) return ta === tb;
  }
  return a === b;
};

/** True when `a` and `b` agree on every field a move/resize can change. */
/** Real resource objects: the placeholder normalizeEvents adds means "none". */
const realResources = (value: unknown) =>
  Array.isArray(value) ? value.filter((r) => r && r !== defaultResource) : [];

export const sameSchedule = (a: EventProps, b: EventProps): boolean =>
  HISTORY_FIELDS.every((field) =>
    field === "allDay"
      ? !!a.allDay === !!b.allDay
      : field === "resources"
        ? sameValue(realResources(a.resources), realResources(b.resources))
        : sameValue(a[field], b[field])
  );

/** `target` with the schedule fields of `source` (absent fields are removed). */
export const withSchedule = (target: EventProps, source: EventProps): EventProps => {
  const result: Record<string, unknown> = { ...target };
  for (const field of HISTORY_FIELDS) {
    if (source[field] !== undefined) result[field] = source[field];
    else delete result[field];
  }
  return result as EventProps;
};

export class ChangeHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private nextId = 1;

  constructor(public limit = 100) {}

  /** Records a new change; clears the redo stack. Returns the entry id, or null when disabled. */
  record(kind: HistoryEntry["kind"], before: EventProps, after: EventProps): number | null {
    if (this.limit <= 0) return null;
    const entry = { id: this.nextId++, kind, before, after };
    this.undoStack.push(entry);
    this.redoStack = [];
    this.trim();
    return entry.id;
  }

  /** Drops an entry wherever it is (its change was reverted by the host). */
  remove(id: number): void {
    this.undoStack = this.undoStack.filter((e) => e.id !== id);
    this.redoStack = this.redoStack.filter((e) => e.id !== id);
  }

  takeUndo(): HistoryEntry | undefined {
    return this.undoStack.pop();
  }

  takeRedo(): HistoryEntry | undefined {
    return this.redoStack.pop();
  }

  pushUndo(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    this.trim();
  }

  pushRedo(entry: HistoryEntry): void {
    this.redoStack.push(entry);
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private trim(): void {
    const limit = Math.max(0, this.limit);
    if (this.undoStack.length > limit) this.undoStack.splice(0, this.undoStack.length - limit);
  }
}
