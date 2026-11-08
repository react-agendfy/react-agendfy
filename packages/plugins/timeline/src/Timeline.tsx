import React, { KeyboardEvent, PointerEvent, useMemo, useRef, useState } from "react";
import {
  clockToMinutes,
  complementRanges,
  createTimeScale,
  eventResourceIds,
  getContrastText,
  getHiddenDays,
  layoutLanes,
  useCalendarView,
  useDropZone,
  useEventDraggable,
  useVirtualRange,
  type EventProps,
  type Resource,
  type TimeScale,
} from "@react-agendfy/core";

/*
 * Resource timeline (timelineDay / timelineWeek / timelineMonth): resources
 * down the side, time across. Built only on the core's public API: the
 * TimeScale (x axis), useVirtualRange (rows and slots), and the SDK's drag &
 * drop (moves in time and between resources, rules, live preview, undo,
 * keyboard, external drops).
 */

export type TimelineZoom = "day" | "week" | "month";

export interface TimelineOptions {
  /** Minutes per slot. Default: config.slotDuration (day), 60 (week), a day (month). */
  slotMinutes?: number;
  /** Width of a slot, px. Default 48 (day), 24 (week), 40 (month). */
  slotWidth?: number;
  /** Width of the resource column, px. Default 200. */
  resourceAreaWidth?: number;
  /** Height of one lane of events, px. Default 34. */
  laneHeight?: number;
  /** A row for events without resources (when there are any). Default true. */
  showUnassigned?: boolean;
}

const UNASSIGNED = "__unassigned";
/** Narrowest bar, px: short events in wide slots stay visible (and stack). */
const MIN_EVENT_WIDTH = { day: 6, week: 6, month: 24 } as const;
const MINUTE = 60_000;
const ROW_PADDING = 4;
const HEAD_ROW = 30;

interface Row {
  key: string;
  resource: Resource | null;
  depth: number;
  hasChildren: boolean;
  events: EventProps[];
  lanes: Map<string, number>;
  height: number;
}

const resourceLabel = (r: Resource) => String(r.title ?? r.name ?? r.id);
const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export default function Timeline({ zoom, options = {} }: { zoom: TimelineZoom; options?: TimelineOptions }) {
  const cal = useCalendarView();
  const { config, timeZone, range } = cal;
  const month = zoom === "month";
  const slotMinutes = options.slotMinutes ?? (month ? 1440 : zoom === "week" ? 60 : config.slotDuration || 30);
  const slotWidth = options.slotWidth ?? (month ? 40 : zoom === "week" ? 40 : 48);
  const areaWidth = options.resourceAreaWidth ?? 200;
  const laneHeight = options.laneHeight ?? 34;
  const editable = config.editable !== false;
  const canMove = config.eventStartEditable ?? editable;
  const canResize = config.eventDurationEditable ?? editable;

  const scale = useMemo(
    () =>
      createTimeScale({
        start: range.start,
        end: range.end,
        timeZone,
        unitMinutes: slotMinutes,
        unitPx: slotWidth,
        orientation: "x",
        dayStartMinutes: month ? 0 : clockToMinutes(config.slotMin, 0),
        dayEndMinutes: month ? 1440 : clockToMinutes(config.slotMax, 1440),
        hiddenDays: zoom === "day" ? [] : [...getHiddenDays(config)],
      }),
    [range.start, range.end, timeZone, slotMinutes, slotWidth, month, zoom, config]
  );

  /* --- rows: the resource tree (collapsible), then "unassigned" -------- */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const rows = useMemo<Row[]>(() => {
    const from = range.start.getTime();
    const to = range.end.getTime();
    const inRange = cal.events.filter((e) => new Date(e.start).getTime() < to && new Date(e.end).getTime() > from);
    // Lanes by what each bar covers on screen, not by time alone.
    const footprint = (e: EventProps): [number, number] => {
      const x = scale.toPx(e.start);
      return [x, Math.max(scale.toPx(e.end), x + MIN_EVENT_WIDTH[zoom])];
    };
    const make = (key: string, resource: Resource | null, depth: number, hasChildren: boolean, events: EventProps[]): Row => {
      const { lanes, count } = layoutLanes(events, footprint);
      return { key, resource, depth, hasChildren, events, lanes, height: count * laneHeight + 2 * ROW_PADDING };
    };
    const out: Row[] = [];
    const walk = (list: Resource[], depth: number) => {
      for (const r of list) {
        const id = String(r.id);
        const children = r.children ?? [];
        out.push(make(id, r, depth, children.length > 0, inRange.filter((e) => eventResourceIds(e).includes(id))));
        if (children.length && !collapsed.has(id)) walk(children, depth + 1);
      }
    };
    walk(cal.resources, 0);
    const unassigned = inRange.filter((e) => eventResourceIds(e).length === 0);
    if ((options.showUnassigned ?? true) && unassigned.length) out.push(make(UNASSIGNED, null, 0, false, unassigned));
    return out;
  }, [cal.events, cal.resources, range.start, range.end, collapsed, laneHeight, options.showUnassigned, scale, zoom]);

  /* --- virtualization: rows (y) and slots (x) --------------------------- */
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const rowSize = (i: number) => rows[i].height;
  const rowRange = useVirtualRange({ count: rows.length, size: rowSize, viewportRef, axis: "y", startOffset: HEAD_ROW * 2 });
  const slotCount = Math.round(scale.totalPx / slotWidth);
  const slotRange = useVirtualRange({ count: slotCount, size: slotWidth, viewportRef, axis: "x", startOffset: areaWidth });

  /* --- header ----------------------------------------------------------- */
  const majors = month
    ? [{ key: "month", left: 0, width: scale.totalPx, label: cal.formatDate(range.start, "MMMM yyyy") }]
    : scale.segments.map((s) => ({ key: s.day.toISOString(), left: s.offsetPx, width: s.lengthPx, label: cal.formatDate(s.day, "EEE d MMM") }));
  const labelEvery = month ? 1440 : zoom === "week" ? 180 : 60;
  const windowStart = month ? 0 : clockToMinutes(config.slotMin, 0);
  const minors = useMemo(
    () =>
      scale
        .ticks(slotMinutes)
        // A label every `labelEvery` minutes from the start of each day's window.
        .filter(
          (t) =>
            month ||
            (Number(cal.formatDate(t.date, "H")) * 60 + Number(cal.formatDate(t.date, "m")) - windowStart) % labelEvery === 0
        )
        .map((t) => ({ px: t.px, label: month ? cal.formatDate(t.date, "EEEEE d") : cal.formatTime(t.date) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scale, slotMinutes, labelEvery, windowStart, month, cal.lang, timeZone]
  );

  const now = Date.now();
  const nowX = config.nowIndicator !== false && now >= range.start.getTime() && now < range.end.getTime() ? scale.toPx(new Date(now)) : null;
  const ariaRange = `${cal.formatDate(range.start, "d MMM")} – ${cal.formatDate(new Date(range.end.getTime() - 1), "d MMM yyyy")}`;
  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div
      className="agendfy-timeline"
      role="grid"
      aria-label={cal.t("timeline.aria", { range: ariaRange })}
      style={{ ["--agendfy-timeline-area" as string]: `${areaWidth}px` }}
    >
      <div className="agendfy-timeline-viewport" ref={viewportRef}>
        <div className="agendfy-timeline-canvas" style={{ width: areaWidth + scale.totalPx }}>
          <div className="agendfy-timeline-head" role="row">
            <div className="agendfy-timeline-corner" style={{ width: areaWidth }} role="columnheader">
              {cal.t("timeline.resources")}
            </div>
            <div className="agendfy-timeline-scale" style={{ left: areaWidth, width: scale.totalPx }} aria-hidden="true">
              {majors.map((m) => (
                <div key={m.key} className="agendfy-timeline-major" style={{ left: m.left, width: m.width }}>
                  <span>{m.label}</span>
                </div>
              ))}
              {minors.map((m) => (
                <div key={m.px} className="agendfy-timeline-minor" style={{ left: m.px }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          <div className="agendfy-timeline-rows" style={{ height: rowRange.totalSize }}>
            {rowRange.items.map(({ index, offset }) => {
              const row = rows[index];
              return (
                <div
                  key={row.key}
                  className={cx("agendfy-timeline-row", row.hasChildren && "agendfy-timeline-row--group")}
                  role="row"
                  style={{ top: offset, height: row.height }}
                >
                  <div className="agendfy-timeline-resource" role="rowheader" style={{ width: areaWidth, paddingInlineStart: 10 + row.depth * 18 }}>
                    {row.hasChildren && row.resource && (
                      <button
                        type="button"
                        className="agendfy-timeline-toggle"
                        aria-expanded={!collapsed.has(row.key)}
                        aria-label={cal.t(collapsed.has(row.key) ? "timeline.expand" : "timeline.collapse", { name: resourceLabel(row.resource) })}
                        onClick={() => toggle(row.key)}
                      >
                        {collapsed.has(row.key) ? "▸" : "▾"}
                      </button>
                    )}
                    <span className="agendfy-timeline-resource-title">
                      {row.resource ? resourceLabel(row.resource) : cal.t("timeline.unassigned")}
                    </span>
                  </div>
                  <RowTrack
                    row={row}
                    left={areaWidth}
                    scale={scale}
                    slots={slotRange.items}
                    slotMinutes={slotMinutes}
                    slotWidth={slotWidth}
                    laneHeight={laneHeight}
                    zoom={zoom}
                    month={month}
                    canMove={canMove}
                    canResize={canResize}
                    nowX={nowX}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function RowTrack({
  row,
  left,
  scale,
  slots,
  slotMinutes,
  slotWidth,
  laneHeight,
  zoom,
  month,
  canMove,
  canResize,
  nowX,
}: {
  row: Row;
  left: number;
  scale: TimeScale;
  slots: { index: number; offset: number }[];
  slotMinutes: number;
  slotWidth: number;
  laneHeight: number;
  zoom: TimelineZoom;
  month: boolean;
  canMove: boolean;
  canResize: boolean;
  nowX: number | null;
}) {
  const cal = useCalendarView();
  const resourceId = row.resource ? row.resource.id : undefined;

  // Time outside the resource's (or calendar's) hours. Month: whole days only.
  const offHours = useMemo(() => {
    const hasHours = !!row.resource?.businessHours || !!cal.config.businessHours?.enabled;
    if (!hasHours) return [];
    return scale.segments.flatMap((segment) => {
      const intervals = cal.businessHoursFor(segment.day, row.resource ?? undefined);
      if (month) return intervals.length ? [] : [{ from: segment.offsetPx, to: segment.offsetPx + segment.lengthPx }];
      const inner = intervals.map((i) => ({
        from: scale.toPx(i.start) - segment.offsetPx,
        to: scale.segmentOf(i.end) === segment ? scale.toPx(i.end) - segment.offsetPx : segment.lengthPx,
      }));
      return complementRanges(inner, segment.lengthPx).map((g) => ({ from: segment.offsetPx + g.from, to: segment.offsetPx + g.to }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, row.resource, month, cal.config.businessHours]);

  return (
    <div className="agendfy-timeline-track" style={{ left, width: scale.totalPx }}>
      {offHours.map((g) => (
        <div key={`off-${g.from}`} className="react-agendfy-non-business" style={{ left: g.from, width: g.to - g.from, top: 0, bottom: 0 }} />
      ))}
      {slots.map(({ index, offset }) => (
        <Slot
          key={index}
          id={`${row.key}|${index}`}
          date={scale.toDate(offset)}
          left={offset}
          width={slotWidth}
          resourceId={resourceId}
          dayStart={month || index === 0 || scale.segments.some((s) => s.offsetPx === offset)}
        />
      ))}
      {row.events.map((event) => (
        <TimelineEvent
          key={event.id}
          event={event}
          row={row}
          scale={scale}
          slotMinutes={slotMinutes}
          laneHeight={laneHeight}
          zoom={zoom}
          canMove={canMove}
          canResize={canResize}
        />
      ))}
      {nowX !== null && <div className="react-agendfy-now-line agendfy-timeline-now" style={{ left: nowX }} />}
    </div>
  );
}

function Slot({
  id,
  date,
  left,
  width,
  resourceId,
  dayStart,
}: {
  id: string;
  date: Date;
  left: number;
  width: number;
  resourceId?: string | number;
  dayStart: boolean;
}) {
  const cal = useCalendarView();
  const disabled = cal.isDisabled(date);
  // The unassigned row drops to "no resource".
  const { setNodeRef, isOver } = useDropZone(id, { date, resourceIds: resourceId !== undefined ? [resourceId] : [] }, { disabled });
  return (
    <div
      ref={setNodeRef}
      className={cx("agendfy-timeline-slot", dayStart && "agendfy-timeline-slot--day", isOver && "agendfy-timeline-slot--over")}
      style={{ left, width }}
      onClick={() => !disabled && cal.onSlotClick(date, resourceId !== undefined ? { resourceId } : undefined)}
    />
  );
}

function TimelineEvent({
  event,
  row,
  scale,
  slotMinutes,
  laneHeight,
  zoom,
  canMove,
  canResize,
}: {
  event: EventProps;
  row: Row;
  scale: TimeScale;
  slotMinutes: number;
  laneHeight: number;
  zoom: TimelineZoom;
  canMove: boolean;
  canResize: boolean;
}) {
  const cal = useCalendarView();
  const x = scale.toPx(event.start);
  const width = Math.max(MIN_EVENT_WIDTH[zoom], scale.toPx(event.end) - x);
  const lane = row.lanes.get(String(event.id)) ?? 0;
  const slotPx = slotMinutes * scale.pxPerMinute;

  // Where the pointer grabbed the bar: start of the slot under it minus the
  // event's start (keeps the offset and the time of day on drop).
  const grabRef = useRef(0);
  const onGrab = (e: PointerEvent<HTMLDivElement>) => {
    const px = x + e.clientX - e.currentTarget.getBoundingClientRect().left;
    grabRef.current = scale.toDate(Math.floor(px / slotPx) * slotPx).getTime() - new Date(event.start).getTime();
  };
  const { setNodeRef, attributes, listeners, isDragging } = useEventDraggable(event, {
    id: `${event.id}@${row.key}`,
    resourceId: row.resource ? row.resource.id : undefined,
    disabled: !canMove,
    anchor: () => grabRef.current,
  });

  /* --- resize: the right edge, snapped to slots, validated live --------- */
  const [resize, setResize] = useState<{ width: number; invalid: boolean } | null>(null);
  const resizeRef = useRef<{ startX: number; end: Date } | null>(null);
  const endAt = (w: number) => {
    const snapped = scale.toDate(Math.round((x + w) / slotPx) * slotPx);
    const min = new Date(new Date(event.start).getTime() + slotMinutes * MINUTE);
    return snapped.getTime() < min.getTime() ? min : snapped;
  };
  const onResizeDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { startX: e.clientX, end: new Date(event.end) };
    setResize({ width, invalid: false });
  };
  const onResizeMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    const end = endAt(width + e.clientX - resizeRef.current.startX);
    resizeRef.current.end = end;
    const verdict = cal.validate({ kind: "resize", event: { ...event, end: end.toISOString() }, before: event });
    setResize({ width: Math.max(6, scale.toPx(end) - x), invalid: verdict !== true });
  };
  const onResizeUp = () => {
    const state = resizeRef.current;
    resizeRef.current = null;
    setResize(null);
    if (state && state.end.getTime() !== new Date(event.end).getTime()) cal.resizeEvent(event, { end: state.end });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !isDragging) {
      e.preventDefault();
      cal.onEventClick(event);
      return;
    }
    listeners?.onKeyDown?.(e);
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onPointerDownCapture={onGrab}
      onClick={() => cal.onEventClick(event)}
      className={cx(
        "agendfy-timeline-event",
        isDragging && "agendfy-timeline-event--dragging",
        resize?.invalid && "agendfy-timeline-event--invalid",
        cal.eventClassName(event)
      )}
      data-event-id={String(event.id)}
      aria-label={`${event.title}, ${cal.timeText(event)}`}
      style={{
        left: x,
        width: resize?.width ?? width,
        top: ROW_PADDING + lane * laneHeight,
        height: laneHeight - 4,
        backgroundColor: event.color,
        color: getContrastText(event.color),
      }}
    >
      {cal.renderEventContent(event) ?? (
        <>
          <span className="agendfy-timeline-event-title">{event.title}</span>
          {!event.allDay && <span className="agendfy-timeline-event-time">{cal.timeText(event)}</span>}
        </>
      )}
      {canResize && (
        <div
          className="agendfy-timeline-resize"
          aria-hidden="true"
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerCancel={onResizeUp}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
