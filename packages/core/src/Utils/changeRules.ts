import { TZDate } from "@date-fns/tz";
import type {
  ChangeRejection,
  ChangeVerdict,
  Config,
  EventChange,
  EventConstraintRule,
  EventOverlapRule,
  EventProps,
  WeeklyInterval,
} from "../types/types";
import type { ChangeContext, MiddlewarePlugin } from "../types/plugins";
import { ensureDate } from "./DateTrannforms";
import { getBusinessHoursIntervalsForDate } from "./businessHours";
import { resolveValidRange } from "./calendarRange";
import { defaultResource } from "./calendarHelpers";

/*
 * Validation step of the change pipeline (RFC 001, layer 1). Pure and
 * synchronous on purpose: the same function will run on every pointer move
 * once the drag engine is shared, to paint the drag preview.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const instant = (value: string | Date, timeZone?: string): number => {
  if (typeof value === "string" && DATE_ONLY.test(value)) {
    return resolveValidRange({ start: value }, timeZone).start!.getTime();
  }
  return ensureDate(value).getTime();
};

/** [start, end) in epoch ms; a missing/invalid end collapses onto start. */
export const eventSpan = (event: EventProps): { start: number; end: number } => {
  const start = ensureDate(event.start).getTime();
  const end = event.end ? ensureDate(event.end).getTime() : start;
  return { start, end: isNaN(end) || end < start ? start : end };
};

/**
 * Resource ids of an event: `resourceIds`, `resourceId` and the legacy
 * `resources` objects (the resource filter's source), minus the placeholder
 * `normalizeEvents` adds to events without resources.
 */
const resourceKeys = (event: EventProps): Set<string> | null => {
  const ids = new Set<string>();
  event.resourceIds?.forEach((id) => ids.add(String(id)));
  if (event.resourceId !== undefined && event.resourceId !== null) ids.add(String(event.resourceId));
  if (Array.isArray(event.resources)) {
    for (const r of event.resources as { id?: string | number }[]) {
      if (r && r !== defaultResource && r.id !== undefined) ids.add(String(r.id));
    }
  }
  return ids.size ? ids : null;
};

/** Events with resources on both sides only meet when they share one. */
const shareResource = (a: EventProps, b: EventProps): boolean => {
  const ra = resourceKeys(a);
  const rb = resourceKeys(b);
  if (!ra || !rb) return true;
  for (const id of ra) if (rb.has(id)) return true;
  return false;
};

const overlapAllowed = (still: EventProps, moving: EventProps, rule: EventOverlapRule | undefined) => {
  if (still.overlap === false) return false;
  if (typeof moving.overlap === "boolean") return moving.overlap;
  if (typeof rule === "function") return rule(still, moving);
  return rule !== false;
};

/** Every event `moving` would collide with, given the overlap rules. */
export const findOverlapConflicts = (
  moving: EventProps,
  others: EventProps[],
  rule: EventOverlapRule | undefined
): EventProps[] => {
  const span = eventSpan(moving);
  if (span.end <= span.start) return [];
  return others.filter((other) => {
    if (other.id === moving.id) return false;
    const o = eventSpan(other);
    if (!(o.start < span.end && span.start < o.end)) return false;
    if (!shareResource(moving, other)) return false;
    return !overlapAllowed(other, moving, rule);
  });
};

const fitsWeeklyIntervals = (event: EventProps, intervals: WeeklyInterval[], timeZone?: string) => {
  const span = eventSpan(event);
  const day = timeZone ? new TZDate(span.start, timeZone) : new Date(span.start);
  return getBusinessHoursIntervalsForDate(day, { enabled: true, intervals }).some(
    (interval) => span.start >= interval.start.getTime() && span.end <= interval.end.getTime()
  );
};

/** Whether `event` satisfies its own `constraint` or, failing that, `rule`. */
export const satisfiesConstraint = (
  event: EventProps,
  rule: EventConstraintRule | undefined,
  config: Partial<Config>
): boolean => {
  const constraint: EventConstraintRule | undefined = event.constraint ?? rule;
  if (!constraint) return true;
  const timeZone = config.timeZone;

  if (constraint === "businessHours") {
    if (event.allDay || !config.businessHours?.enabled) return true;
    return fitsWeeklyIntervals(event, config.businessHours.intervals, timeZone);
  }
  if (Array.isArray(constraint)) {
    return fitsWeeklyIntervals(event, constraint, timeZone);
  }
  const span = eventSpan(event);
  if (constraint.start && span.start < instant(constraint.start, timeZone)) return false;
  if (constraint.end && span.end > instant(constraint.end, timeZone)) return false;
  return true;
};

const reject = (reason: string, extra?: Partial<ChangeRejection>): ChangeRejection => ({
  ok: false,
  reason,
  ...extra,
});

/**
 * Runs, in order: `eventOverlap`, `eventConstraint`, `eventAllow`, then each
 * middleware plugin's `validate`. The first refusal wins.
 */
export const validateChange = (
  change: EventChange,
  ctx: ChangeContext,
  middleware: MiddlewarePlugin[] = []
): ChangeVerdict => {
  const { config } = ctx;
  const moving = change.event;

  // Always checked: even with overlap allowed globally, a still event with
  // `overlap: false` refuses company.
  const span = eventSpan(moving);
  const conflicts = findOverlapConflicts(
    moving,
    ctx.eventsInRange(new Date(span.start), new Date(span.end)),
    config.eventOverlap
  );
  if (conflicts.length) return reject("overlap", { conflicts });

  if (!satisfiesConstraint(moving, config.eventConstraint, config)) return reject("constraint");

  if (config.eventAllow && config.eventAllow(change) === false) return reject("not-allowed");

  for (const plugin of middleware) {
    if (!plugin.validate) continue;
    const verdict = plugin.validate(change, ctx);
    if (verdict === false) return reject("not-allowed", { message: plugin.key });
    if (verdict !== true && verdict && verdict.ok === false) return verdict;
  }
  return true;
};
