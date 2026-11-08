import React, { KeyboardEvent, PointerEvent, useMemo, useRef, useState, useLayoutEffect } from "react";
import { TZDate } from "@date-fns/tz";
import type { EventProps, Resource } from "../../types/types";
import { useCalendarView } from "../../hooks/useCalendarView";
import { useDropZone, useEventDraggable } from "../../hooks/useViewDrag";
import { useVirtualRange } from "../../hooks/useVirtualRange";
import { useMinuteTick } from "../../hooks/useMinuteTick";
import { clockToMinutes, createTimeScale, type TimeScaleSegment } from "../../Utils/timeScale";
import { getHiddenDays } from "../../Utils/calendarRange";
import { getSlotHeight, slotHeightStyle } from "../../Utils/slotHeight";
import { formatSlotLabel, showsSlotLabel } from "../../Utils/displayOptions";
import { clipEventToDay, isBannerEvent } from "../../Utils/weekViewHelpers";
import { computeDayLayout, layoutPositionStyle } from "../../Utils/positionedEventsHelper";
import { eventResourceIds } from "../../Utils/resources";
import { complementRanges } from "../../Utils/businessHours";
import { getContrastText } from "../../Utils/colorContrast";
import { cx, publicEventId } from "../../context/ClassNamesContext";

/*
 * resourceDay / resourceWeek (RFC 001, layer 3): one column per resource
 * (and per day in the week), times down the side. Built on the public SDK
 * (useCalendarView, useEventDraggable, useDropZone), the TimeScale and
 * useVirtualRange: only the columns in view are rendered, so hundreds of
 * resources stay fast.
 */

const LABEL_WIDTH = 64;
const DEFAULT_MIN_COLUMN = 120;
const MINUTE = 60_000;

interface Column {
  key: string;
  day: Date;
  segment: TimeScaleSegment;
  resource: Resource;
}

/** Columns are leaf resources; a parent with children groups them. */
const leaves = (resources: Resource[]): Resource[] =>
  resources.flatMap((r) => (r.children?.length ? leaves(r.children) : [r]));

const resourceLabel = (r: Resource) => String(r.title ?? r.name ?? r.id);
const sameDay = (a: Date, b: Date, timeZone: string) => {
  const x = new TZDate(a.getTime(), timeZone);
  const y = new TZDate(b.getTime(), timeZone);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

export default function ResourceTimeGrid({ span }: { span: "day" | "week" }) {
  const cal = useCalendarView();
  const { config, timeZone, range } = cal;
  const slotMinutes = config.slotDuration || 30;
  const slotPx = getSlotHeight(config);
  const dayStart = clockToMinutes(config.slotMin, 0);
  const dayEnd = Math.max(dayStart + slotMinutes, clockToMinutes(config.slotMax, 1440));
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
        unitPx: slotPx,
        dayStartMinutes: dayStart,
        dayEndMinutes: dayEnd,
        hiddenDays: span === "week" ? [...getHiddenDays(config)] : [],
      }),
    [range.start, range.end, timeZone, slotMinutes, slotPx, dayStart, dayEnd, span, config]
  );
  const dayHeight = scale.segments[0]?.lengthPx ?? 0;

  const resources = useMemo(() => leaves(cal.resources), [cal.resources]);
  const byDate = span === "week" && !!config.datesAboveResources;
  const columns = useMemo<Column[]>(() => {
    const out: Column[] = [];
    const add = (segment: TimeScaleSegment, resource: Resource) =>
      out.push({ key: `${resource.id}|${segment.day.toISOString()}`, day: segment.day, segment, resource });
    if (byDate) scale.segments.forEach((s) => resources.forEach((r) => add(s, r)));
    else resources.forEach((r) => scale.segments.forEach((s) => add(s, r)));
    return out;
  }, [scale, resources, byDate]);

  /* --- width: stretch to fill, never under the minimum; virtualized ---- */
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setViewportWidth(el.clientWidth);
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => observer?.disconnect();
  }, []);
  const minColumn = config.resourceColumnMinWidth ?? DEFAULT_MIN_COLUMN;
  const columnWidth = Math.max(minColumn, columns.length ? (viewportWidth - LABEL_WIDTH) / columns.length : minColumn);
  const { items, totalSize } = useVirtualRange({
    count: columns.length,
    size: columnWidth,
    viewportRef,
    axis: "x",
    startOffset: LABEL_WIDTH,
  });

  /* --- events per column ------------------------------------------------ */
  const timedByColumn = useMemo(() => {
    const map = new Map<string, EventProps[]>();
    for (const column of columns) {
      const id = String(column.resource.id);
      const list: EventProps[] = [];
      for (const event of cal.events) {
        if (isBannerEvent(event, timeZone) || !eventResourceIds(event).includes(id)) continue;
        const segment = clipEventToDay(event, column.day, timeZone);
        if (segment) list.push(segment);
      }
      map.set(column.key, list);
    }
    return map;
  }, [columns, cal.events, timeZone]);

  const allDayByColumn = useMemo(() => {
    const map = new Map<string, EventProps[]>();
    for (const column of columns) {
      const id = String(column.resource.id);
      const dayMs = column.day.getTime();
      const next = column.segment.day.getTime() + 24 * 60 * MINUTE;
      map.set(
        column.key,
        cal.events.filter((e) => {
          if (!isBannerEvent(e, timeZone) || !eventResourceIds(e).includes(id)) return false;
          // End is exclusive.
          return new Date(e.start).getTime() < next && new Date(e.end).getTime() > dayMs;
        })
      );
    }
    return map;
  }, [columns, cal.events, timeZone]);
  const hasAllDay = config.allDaySlot !== false;

  /* --- header groups (the outer grouping of the week) ------------------- */
  const multiDay = scale.segments.length > 1;
  const groups = useMemo(() => {
    if (!multiDay) return [];
    const out: { key: string; label: string; first: number; last: number }[] = [];
    columns.forEach((column, index) => {
      const key = byDate ? column.day.toISOString() : String(column.resource.id);
      const label = byDate ? cal.formatDate(column.day, "EEE d") : resourceLabel(column.resource);
      const last = out[out.length - 1];
      if (last && last.key === key) last.last = index;
      else out.push({ key, label, first: index, last: index });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, byDate, multiDay, cal.lang, timeZone]);
  const firstVisible = items[0]?.index ?? 0;
  const lastVisible = items[items.length - 1]?.index ?? -1;

  const columnLabel = (column: Column) =>
    !multiDay ? resourceLabel(column.resource) : byDate ? resourceLabel(column.resource) : cal.formatDate(column.day, "EEE d");

  /* --- time labels ------------------------------------------------------ */
  const labels = useMemo(() => {
    const first = scale.segments[0];
    if (!first) return [];
    const out: { top: number; text: string }[] = [];
    for (let m = dayStart; m < dayEnd; m += slotMinutes) {
      if (!showsSlotLabel(m - dayStart, config)) continue;
      const date = new TZDate(first.day.getTime(), timeZone);
      date.setHours(0, m, 0, 0);
      out.push({ top: (m - dayStart) * scale.pxPerMinute, text: formatSlotLabel(date, config) });
    }
    return out;
  }, [scale, dayStart, dayEnd, slotMinutes, timeZone, config]);

  // Re-render every minute so the now line moves.
  useMinuteTick(config.nowIndicator !== false);
  const now = new Date();
  const nowTop = (column: Column) => {
    if (config.nowIndicator === false || !sameDay(now, column.day, timeZone)) return null;
    const top = scale.toPx(now) - column.segment.offsetPx;
    return top > 0 && top < dayHeight ? top : null;
  };

  const width = LABEL_WIDTH + totalSize;
  const ariaLabel = multiDay
    ? `${cal.formatDate(range.start, "d MMM")} – ${cal.formatDate(new Date(range.end.getTime() - 1), "d MMM yyyy")}`
    : cal.formatDate(range.start, "EEEE, d MMMM yyyy");

  return (
    <div className="react-agendfy-rtg" role="grid" aria-label={ariaLabel} style={slotHeightStyle(config)}>
      <div className="react-agendfy-rtg-viewport" ref={viewportRef}>
        <div className="react-agendfy-rtg-canvas" style={{ width }}>
          {/* header */}
          <div className={cx("react-agendfy-rtg-head", multiDay && "react-agendfy-rtg-head--grouped")} role="row">
            <div className="react-agendfy-rtg-corner" style={{ width: LABEL_WIDTH }}>
              {multiDay ? "" : cal.formatDate(range.start, "EEE d")}
            </div>
            {groups
              .filter((g) => g.last >= firstVisible && g.first <= lastVisible)
              .map((g) => (
                <div
                  key={g.key}
                  className="react-agendfy-rtg-group"
                  style={{ left: LABEL_WIDTH + g.first * columnWidth, width: (g.last - g.first + 1) * columnWidth }}
                >
                  <span>{g.label}</span>
                </div>
              ))}
            <div className={cx("react-agendfy-rtg-head-row", multiDay && "react-agendfy-rtg-head-row--sub")}>
              {items.map(({ index, offset, size }) => (
                <div
                  key={columns[index].key}
                  className={cx("react-agendfy-rtg-col-head", index > 0 && columns[index - 1].day.getTime() !== columns[index].day.getTime() && !byDate && "react-agendfy-rtg-col-head--day-start")}
                  role="columnheader"
                  style={{ left: LABEL_WIDTH + offset, width: size }}
                >
                  {columnLabel(columns[index])}
                </div>
              ))}
            </div>
          </div>

          {/* all-day row */}
          {hasAllDay && (
            <div className="react-agendfy-rtg-allday" role="row">
              <div className="react-agendfy-rtg-allday-label" style={{ width: LABEL_WIDTH }}>
                {config.all_day}
              </div>
              {items.map(({ index, offset, size }) => (
                <AllDayCell
                  key={columns[index].key}
                  column={columns[index]}
                  left={LABEL_WIDTH + offset}
                  width={size}
                  events={allDayByColumn.get(columns[index].key) ?? []}
                  canMove={canMove}
                />
              ))}
            </div>
          )}

          {/* body */}
          <div className="react-agendfy-rtg-body" style={{ height: dayHeight }}>
            <div className="react-agendfy-rtg-times" style={{ width: LABEL_WIDTH, height: dayHeight }} aria-hidden="true">
              {labels.map((l) => (
                <div key={l.top} className="react-agendfy-rtg-time" style={{ top: l.top }}>
                  {l.text}
                </div>
              ))}
            </div>
            {items.map(({ index, offset, size }) => {
              const column = columns[index];
              return (
                <ResourceColumn
                  key={column.key}
                  column={column}
                  left={LABEL_WIDTH + offset}
                  width={size}
                  height={dayHeight}
                  slotMinutes={slotMinutes}
                  slotPx={slotPx}
                  dayStart={dayStart}
                  dayEnd={dayEnd}
                  scale={scale}
                  events={timedByColumn.get(column.key) ?? []}
                  nowTop={nowTop(column)}
                  canMove={canMove}
                  canResize={canResize}
                  dayStartsHere={!byDate && index > 0 && columns[index - 1].day.getTime() !== column.day.getTime()}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SlotZone({ column, minutes, top, height }: { column: Column; minutes: number; top: number; height: number }) {
  const cal = useCalendarView();
  const date = useMemo(() => {
    const d = new TZDate(column.day.getTime(), cal.timeZone);
    d.setHours(0, minutes, 0, 0);
    return new Date(d.getTime());
  }, [column.day, minutes, cal.timeZone]);
  const disabled = cal.isDisabled(column.day);
  const { setNodeRef, isOver } = useDropZone(`${column.key}|${minutes}`, { date, resourceIds: [column.resource.id] }, { disabled });
  return (
    <div
      ref={setNodeRef}
      className={cx("react-agendfy-rtg-slot", isOver && "react-agendfy-rtg-slot--over")}
      style={{ top, height }}
      onClick={() => !disabled && cal.onSlotClick(date, { resourceId: column.resource.id })}
    />
  );
}

function ResourceColumn({
  column,
  left,
  width,
  height,
  slotMinutes,
  slotPx,
  dayStart,
  dayEnd,
  scale,
  events,
  nowTop,
  canMove,
  canResize,
  dayStartsHere,
}: {
  column: Column;
  left: number;
  width: number;
  height: number;
  slotMinutes: number;
  slotPx: number;
  dayStart: number;
  dayEnd: number;
  scale: ReturnType<typeof createTimeScale>;
  events: EventProps[];
  nowTop: number | null;
  canMove: boolean;
  canResize: boolean;
  dayStartsHere: boolean;
}) {
  const cal = useCalendarView();
  const disabled = cal.isDisabled(column.day);
  const layout = useMemo(() => computeDayLayout(events, cal.timeZone), [events, cal.timeZone]);
  const business = cal.businessHoursFor(column.day, column.resource);
  const top = (date: Date | string) => scale.toPx(date) - column.segment.offsetPx;
  const bottom = (date: Date | string) => {
    // An end at the next midnight closes this day, not the next one.
    const d = new Date(date);
    return sameDay(d, column.day, cal.timeZone) ? top(d) : height;
  };
  // Shade the time outside the resource's hours (or the calendar's).
  const hasHours = !!column.resource.businessHours || !!cal.config.businessHours?.enabled;
  const offHours = hasHours
    ? complementRanges(
        business.map((interval) => ({ from: top(interval.start), to: bottom(interval.end) })),
        height
      )
    : [];
  const slots = [];
  for (let m = dayStart; m < dayEnd; m += slotMinutes) slots.push(m);

  return (
    <div
      className={cx(
        "react-agendfy-rtg-column",
        disabled && "react-agendfy-day-disabled",
        dayStartsHere && "react-agendfy-rtg-column--day-start"
      )}
      role="gridcell"
      aria-label={`${resourceLabel(column.resource)}, ${cal.formatDate(column.day, "EEEE d MMMM")}`}
      style={{ left, width, height }}
    >
      {offHours.map((gap) => (
        <div key={`off-${gap.from}`} className="react-agendfy-non-business" style={{ top: gap.from, height: gap.to - gap.from }} />
      ))}
      {business.map((interval, i) => (
        <div
          key={i}
          className="react-agendfy-business-hours"
          style={{ top: Math.max(0, top(interval.start)), height: Math.max(0, bottom(interval.end) - Math.max(0, top(interval.start))), left: 0, right: 0 }}
        />
      ))}
      {slots.map((m, i) => (
        <SlotZone key={m} column={column} minutes={m} top={i * slotPx} height={slotPx} />
      ))}
      {events.map((event) => {
        const y = Math.max(0, top(event.start));
        const h = Math.max(slotPx / 2, bottom(event.end) - y);
        if (y >= height) return null;
        return (
          <TimedEvent
            key={event.id}
            event={event}
            column={column}
            top={y}
            height={Math.min(h, height - y)}
            position={layoutPositionStyle(layout.get(String(event.id)))}
            scale={scale}
            canMove={canMove}
            canResize={canResize}
            slotMinutes={slotMinutes}
          />
        );
      })}
      {nowTop !== null && <div className="react-agendfy-now-line react-agendfy-rtg-now" style={{ top: nowTop }} />}
    </div>
  );
}

function TimedEvent({
  event,
  column,
  top,
  height,
  position,
  scale,
  canMove,
  canResize,
  slotMinutes,
}: {
  event: EventProps;
  column: Column;
  top: number;
  height: number;
  position: { left: string; width: string };
  scale: ReturnType<typeof createTimeScale>;
  canMove: boolean;
  canResize: boolean;
  slotMinutes: number;
}) {
  const cal = useCalendarView();
  const segment = event.__segment as { isStart: boolean; isEnd: boolean; originalEnd: string } | undefined;
  const isStart = !segment || segment.isStart;
  const isEnd = !segment || segment.isEnd;
  const resourceId = column.resource.id;
  // Where the pointer grabbed the event: start of the slot under it minus
  // the event's start (see useEventDraggable's `anchor`).
  const grabRef = useRef(0);
  const onGrab = (e: PointerEvent<HTMLDivElement>) => {
    const y = top + e.clientY - e.currentTarget.getBoundingClientRect().top;
    const slotPx = slotMinutes * scale.pxPerMinute;
    const slotStart = scale.toDate(column.segment.offsetPx + Math.floor(y / slotPx) * slotPx);
    grabRef.current = slotStart.getTime() - new Date(event.start).getTime();
  };
  const { setNodeRef, attributes, listeners, isDragging } = useEventDraggable(event, {
    id: `${event.id}@${resourceId}`,
    resourceId,
    disabled: !canMove || !isStart,
    anchor: () => grabRef.current,
  });

  /* --- resize: bottom handle, snapped to slots, validated live ---------- */
  const [resize, setResize] = useState<{ height: number; invalid: boolean } | null>(null);
  const resizeRef = useRef<{ startY: number; end: Date } | null>(null);
  const endAt = (h: number) => {
    const raw = scale.toDate(column.segment.offsetPx + top + h);
    const snapped = scale.snap(raw, slotMinutes);
    const min = new Date(new Date(event.start).getTime() + slotMinutes * MINUTE);
    return snapped.getTime() < min.getTime() ? min : snapped;
  };
  const onResizeDown = (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = { startY: e.clientY, end: new Date(event.end) };
    setResize({ height, invalid: false });
  };
  const onResizeMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    const end = endAt(height + e.clientY - resizeRef.current.startY);
    resizeRef.current.end = end;
    const verdict = cal.validate({ kind: "resize", event: { ...event, end: end.toISOString() }, before: event });
    setResize({ height: scale.toPx(end) - column.segment.offsetPx - top, invalid: verdict !== true });
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

  const content = cal.renderEventContent(event, { isStart, isEnd }) ?? (
    <>
      <span className="react-agendfy-rtg-event-title">{event.title || cal.config.untitled_event || "Event"}</span>
      <span className="react-agendfy-rtg-event-time">{cal.timeText(event)}</span>
    </>
  );

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onPointerDownCapture={onGrab}
      onClick={() => cal.onEventClick(event)}
      className={cx(
        "react-agendfy-rtg-event",
        isDragging && "react-agendfy-rtg-event--dragging",
        resize?.invalid && "react-agendfy-rtg-event--invalid",
        cal.eventClassName(event)
      )}
      data-event-id={publicEventId(event)}
      aria-label={`${event.title}, ${cal.timeText(event)}`}
      style={{
        top,
        height: resize?.height ?? height,
        left: position.left,
        width: position.width,
        backgroundColor: event.color,
        color: getContrastText(event.color),
      }}
    >
      {content}
      {canResize && isEnd && (
        <div
          className="react-agendfy-rtg-resize"
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

function AllDayCell({
  column,
  left,
  width,
  events,
  canMove,
}: {
  column: Column;
  left: number;
  width: number;
  events: EventProps[];
  canMove: boolean;
}) {
  const cal = useCalendarView();
  const disabled = cal.isDisabled(column.day);
  const { setNodeRef, isOver } = useDropZone(
    `${column.key}|allday`,
    { date: column.day, allDay: true, resourceIds: [column.resource.id] },
    { disabled }
  );
  return (
    <div
      ref={setNodeRef}
      className={cx("react-agendfy-rtg-allday-cell", isOver && "react-agendfy-rtg-slot--over")}
      style={{ left, width }}
    >
      {events.map((event) => (
        <AllDayChip
          key={event.id}
          event={event}
          column={column}
          // Only the event's first day carries the drag (one draggable per event and column).
          draggable={canMove && sameDay(new Date(event.start), column.day, cal.timeZone)}
        />
      ))}
    </div>
  );
}

function AllDayChip({ event, column, draggable }: { event: EventProps; column: Column; draggable: boolean }) {
  const cal = useCalendarView();
  const { setNodeRef, attributes, listeners } = useEventDraggable(event, {
    id: `${event.id}@${column.resource.id}`,
    resourceId: column.resource.id,
    disabled: !draggable,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cx("react-agendfy-rtg-chip", cal.eventClassName(event))}
      data-event-id={publicEventId(event)}
      style={{ backgroundColor: event.color, color: getContrastText(event.color) }}
      onClick={() => cal.onEventClick(event)}
    >
      {cal.renderEventContent(event) ?? event.title}
    </div>
  );
}
