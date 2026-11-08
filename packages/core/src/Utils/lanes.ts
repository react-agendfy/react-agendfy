import type { EventProps } from "../types/types";

/*
 * Lane stacking for horizontal time axes (RFC 001, layer 3): events that
 * overlap in time go to separate lanes, each in the first lane free at its
 * start (the horizontal counterpart of computeDayLayout's columns).
 */

export interface LaneLayout {
  /** Lane of each event id (0 = top). */
  lanes: Map<string, number>;
  /** Lanes used (at least 1, so an empty row keeps its height). */
  count: number;
}

/**
 * `span` gives each event's footprint on the axis (default: its time). Pass
 * pixels with a minimum width when short events are drawn wider than their
 * duration — they must not share a lane with what they visually cover.
 */
export function layoutLanes(
  events: EventProps[],
  span: (event: EventProps) => [number, number] = (e) => [new Date(e.start).getTime(), new Date(e.end).getTime()]
): LaneLayout {
  const items = events
    .map((event) => {
      const [start, end] = span(event);
      return { id: String(event.id), start, end };
    })
    .filter((e) => !isNaN(e.start) && !isNaN(e.end))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const item of items) {
    // Zero-length events still take a lane until their start.
    const end = Math.max(item.end, item.start + 1);
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    lanes.set(item.id, lane);
  }
  return { lanes, count: Math.max(1, laneEnds.length) };
}
