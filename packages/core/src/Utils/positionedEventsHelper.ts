import { differenceInMinutes, format } from "date-fns";
import { EventProps } from "../types/types";
import { ensureDate } from "../Utils/DateTrannforms";
import { getSlotHeight } from "./slotHeight";

export function computePositionedEvents(
  slotEvents: EventProps[],
  config: any,
  groupByStart: boolean = false,
  extraStyle: object = {}
): EventProps[] {
  if (!slotEvents || slotEvents.length === 0) return [];

  if (groupByStart) {
    const eventsByStart = slotEvents.reduce((acc: { [key: string]: EventProps[] }, event: EventProps) => {
      const key = format(ensureDate(event.start, config?.timeZone), "yyyy-MM-dd HH:mm");
      acc[key] = acc[key] || [];
      acc[key].push(event);
      return acc;
    }, {});

    const positioned: EventProps[] = [];
    Object.values(eventsByStart).forEach((group) => {
      const total = group.length;
      group.forEach((event, idx) => {
        positioned.push({
          ...event,
          positionStyle: {
            left: `${(idx * 100) / total}%`,
            width: `${100 / total}%`,
            top: "0",
            ...extraStyle,
          },
        });
      });
    });
    return positioned;
  } else {
    const total = Math.max(slotEvents.length, 1);
    return slotEvents.map((event, idx) => ({
      ...event,
      positionStyle: {
        top: "0",
        left: `${(idx * 100) / total}%`,
        width: `${100 / total}%`,
        height: `${
          (differenceInMinutes(ensureDate(event.end), ensureDate(event.start)) / config?.slotDuration) * getSlotHeight(config)
        }px`,
      },
    }));
  }
}

/** Column placement of one event inside its overlap cluster. */
export interface DayLayoutSlot {
  column: number;
  columns: number;
  /** How many columns it can stretch over to the right (free space). */
  span: number;
}

/**
 * Day-level overlap layout (FullCalendar/Google semantics): events that
 * overlap in time — transitively — form a cluster; each event takes the
 * first free column, every event in the cluster divides the width by the
 * cluster's column count, and an event stretches right over columns that
 * stay free for its whole duration.
 *
 * Laying out per DAY (not per slot) matters: two events starting in
 * different slots but overlapping in time must share the width instead of
 * being drawn on top of each other.
 */
export function computeDayLayout(events: EventProps[], timeZone?: string): Map<string, DayLayoutSlot> {
  const items = events
    .map((event) => ({
      id: String(event.id),
      start: ensureDate(event.start, timeZone).getTime(),
      end: ensureDate(event.end, timeZone).getTime(),
    }))
    .filter((e) => !isNaN(e.start) && !isNaN(e.end))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result = new Map<string, DayLayoutSlot>();
  let cluster: { id: string; start: number; end: number; column: number }[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const columns = columnEnds.length;
    cluster.forEach((item) => {
      // Stretch over following columns that no cluster member occupies
      // while this event runs.
      let span = 1;
      for (let c = item.column + 1; c < columns; c++) {
        const blocked = cluster.some(
          (other) => other.column === c && other.start < item.end && other.end > item.start
        );
        if (blocked) break;
        span++;
      }
      result.set(item.id, { column: item.column, columns, span });
    });
    cluster = [];
    columnEnds = [];
    clusterEnd = -Infinity;
  };

  for (const item of items) {
    if (item.start >= clusterEnd) flush();
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(item.end);
    } else {
      columnEnds[column] = item.end;
    }
    cluster.push({ ...item, column });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return result;
}

/**
 * left/width for an event from its day layout. Plain percentages only:
 * re-resizable (WeekEvent) mangles calc() widths, so the visual gap between
 * neighbours comes from the event's inset ring (BaseEvent.css), not here.
 */
export function layoutPositionStyle(slot: DayLayoutSlot | undefined) {
  if (!slot || slot.columns <= 1) return { left: "0%", width: "100%" };
  const unit = 100 / slot.columns;
  return { left: `${slot.column * unit}%`, width: `${slot.span * unit}%` };
}
