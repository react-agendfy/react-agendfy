import React, { KeyboardEvent, PointerEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createTimeScale,
  getContrastText,
  useCalendarView,
  useDropZone,
  useEventDraggable,
  useVirtualRange,
  type EventProps,
  type TimeScale,
} from "@react-agendfy/core";
import { TZDate } from "@date-fns/tz";
import { dependenciesOf, isTask, ms, taskType, type Task } from "./model";
import { criticalPath, rollupProgress } from "./schedule";
import GanttToolbar from "./GanttToolbar";

/*
 * The Gantt view: a task table on the left, bars on a time axis on the
 * right, dependency arrows, the critical path. Built on the core's public
 * API; moving a task pushes its successors through the change pipeline's
 * cascade (one change, one undo).
 */

export type GanttZoom = "week" | "month" | "quarter";
export type GanttColumn = "task" | "start" | "end" | "duration" | "progress";

export interface GanttOptions {
  /** Days shown: a week, a month (default) or a quarter. */
  zoom?: GanttZoom;
  /** Width of a day, px. Default 120 (week), 40 (month), 14 (quarter). */
  dayWidth?: number;
  /** Table columns, in order. Default all. */
  columns?: GanttColumn[];
  /** Height of a row, px. Default 36. */
  rowHeight?: number;
  /** Highlight the critical path. Default true. */
  criticalPath?: boolean;
  /** Which events are tasks. Default: events with a task type or task fields. */
  taskFilter?: (event: EventProps) => boolean;
}

const DAY = 86_400_000;
const COLUMN_WIDTH: Record<GanttColumn, number> = { task: 220, start: 76, end: 76, duration: 84, progress: 100 };
const HEAD_ROW = 30;

interface Row {
  task: Task;
  depth: number;
  hasChildren: boolean;
}

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/** The standalone <Gantt>'s own toolbar (navigation and zoom). */
export interface GanttToolbarConfig {
  zooms: { zoom: GanttZoom; view: string }[];
}

export default function Gantt({ options = {}, toolbar }: { options?: GanttOptions; toolbar?: GanttToolbarConfig }) {
  const cal = useCalendarView();
  const { config, timeZone, range } = cal;
  const zoom = options.zoom ?? "month";
  const dayWidth = options.dayWidth ?? (zoom === "week" ? 120 : zoom === "quarter" ? 14 : 40);
  const rowHeight = options.rowHeight ?? 36;
  const columns = options.columns ?? ["task", "start", "end", "duration", "progress"];
  const gridWidth = columns.reduce((sum, c) => sum + COLUMN_WIDTH[c], 0);
  const editable = config.editable !== false;
  const canMove = config.eventStartEditable ?? editable;
  const canResize = config.eventDurationEditable ?? editable;

  const scale = useMemo(
    () => createTimeScale({ start: range.start, end: range.end, timeZone, unitMinutes: 1440, unitPx: dayWidth, orientation: "x" }),
    [range.start, range.end, timeZone, dayWidth]
  );

  /* --- tasks: the parentId tree, in the order given ---------------------- */
  const tasks = useMemo(
    () => cal.events.filter(options.taskFilter ?? isTask) as Task[],
    [cal.events, options.taskFilter]
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const rows = useMemo<Row[]>(() => {
    const ids = new Set(tasks.map((t) => String(t.id)));
    const children = new Map<string, Task[]>();
    const roots: Task[] = [];
    for (const t of tasks) {
      const parent = t.parentId !== undefined && ids.has(String(t.parentId)) ? String(t.parentId) : null;
      if (parent) children.set(parent, [...(children.get(parent) ?? []), t]);
      else roots.push(t);
    }
    const out: Row[] = [];
    const walk = (list: Task[], depth: number) => {
      for (const t of list) {
        const kids = children.get(String(t.id)) ?? [];
        out.push({ task: t, depth, hasChildren: kids.length > 0 });
        if (kids.length && !collapsed.has(String(t.id))) walk(kids, depth + 1);
      }
    };
    walk(roots, 0);
    return out;
  }, [tasks, collapsed]);
  const rowIndex = useMemo(() => new Map(rows.map((r, i) => [String(r.task.id), i])), [rows]);
  const progressOf = useMemo(() => rollupProgress(tasks), [tasks]);
  const critical = useMemo(
    () => (options.criticalPath === false ? new Set<string>() : criticalPath(tasks)),
    [tasks, options.criticalPath]
  );

  /* --- virtualization: rows (y) and days (x) ---------------------------- */
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const rowRange = useVirtualRange({ count: rows.length, size: rowHeight, viewportRef, axis: "y", startOffset: HEAD_ROW * 2 });
  const dayCount = scale.segments.length;
  const dayRange = useVirtualRange({ count: dayCount, size: dayWidth, viewportRef, axis: "x", startOffset: gridWidth });

  /* --- header ------------------------------------------------------------ */
  const months = useMemo(() => {
    const out: { key: string; left: number; width: number; label: string }[] = [];
    for (const s of scale.segments) {
      const key = cal.formatDate(s.day, "yyyy-MM");
      const last = out[out.length - 1];
      if (last && last.key === key) last.width += s.lengthPx;
      else out.push({ key, left: s.offsetPx, width: s.lengthPx, label: cal.formatDate(s.day, "MMMM yyyy") });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, cal.lang, timeZone]);
  // Quarter: too narrow for every day, label the first day of each week.
  const dayLabel = (day: Date) =>
    zoom === "week"
      ? cal.formatDate(day, "EEE d")
      : zoom === "quarter" && new TZDate(day.getTime(), timeZone).getDay() !== cal.weekStartsOn
        ? ""
        : cal.formatDate(day, "d");

  const now = useNow(config.nowIndicator !== false);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const nowX = config.nowIndicator !== false && now >= range.start.getTime() && now < range.end.getTime() ? scale.toPx(new Date(now)) : null;
  const ariaRange = `${cal.formatDate(range.start, "d MMM")} – ${cal.formatDate(new Date(range.end.getTime() - 1), "d MMM yyyy")}`;

  return (
    <>
    {toolbar && <GanttToolbar zoom={zoom} zooms={toolbar.zooms} />}
    <div
      className="agendfy-gantt"
      role="grid"
      aria-label={cal.t("gantt.aria", { range: ariaRange })}
      style={{ ["--agendfy-gantt-grid" as string]: `${gridWidth}px`, ["--agendfy-gantt-row" as string]: `${rowHeight}px` }}
    >
      <div className="agendfy-gantt-viewport" ref={viewportRef}>
        <div className="agendfy-gantt-canvas" style={{ width: gridWidth + scale.totalPx }}>
          <div className="agendfy-gantt-head" role="row">
            <div className="agendfy-gantt-grid-head" style={{ width: gridWidth }}>
              {columns.map((c) => (
                <div key={c} className={`agendfy-gantt-col agendfy-gantt-col--${c}`} role="columnheader" style={{ width: COLUMN_WIDTH[c] }} title={cal.t(`gantt.${c}`)}>
                  <span className="agendfy-gantt-col-label">{cal.t(`gantt.${c}`)}</span>
                </div>
              ))}
            </div>
            <div className="agendfy-gantt-scale" style={{ left: gridWidth, width: scale.totalPx }} aria-hidden="true">
              {months.map((m) => (
                <div key={m.key} className="agendfy-gantt-major" style={{ left: m.left, width: m.width }}>
                  <span>{m.label}</span>
                </div>
              ))}
              {dayRange.items.map(({ index, offset }) => (
                <div key={index} className="agendfy-gantt-minor" style={{ left: offset, width: dayWidth }}>
                  {dayLabel(scale.segments[index].day)}
                </div>
              ))}
            </div>
          </div>

          <div className="agendfy-gantt-rows" style={{ height: rowRange.totalSize }}>
            <Links
              rows={rows}
              rowIndex={rowIndex}
              rowHeight={rowHeight}
              scale={scale}
              left={gridWidth}
              critical={critical}
              height={rowRange.totalSize}
            />
            {rowRange.items.map(({ index, offset }) => {
              const row = rows[index];
              const id = String(row.task.id);
              return (
                <div key={id} className={cx("agendfy-gantt-row", row.hasChildren && "agendfy-gantt-row--summary")} role="row" style={{ top: offset, height: rowHeight }}>
                  <GridCells
                    row={row}
                    columns={columns}
                    width={gridWidth}
                    collapsed={collapsed.has(id)}
                    progress={progressOf.get(id) ?? 0}
                    onToggle={() => toggle(id)}
                  />
                  <div className="agendfy-gantt-track" style={{ left: gridWidth, width: scale.totalPx }}>
                    {dayRange.items.map(({ index: d, offset: x }) => (
                      <DayZone key={d} id={`${id}|${d}`} day={scale.segments[d].day} allDay={!!row.task.allDay} left={x} width={dayWidth} />
                    ))}
                    <Bar
                      task={row.task}
                      scale={scale}
                      rowHeight={rowHeight}
                      critical={critical.has(id)}
                      canMove={canMove}
                      canResize={canResize}
                    />
                    {nowX !== null && <div className="react-agendfy-now-line agendfy-gantt-now" style={{ left: nowX }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function GridCells({
  row,
  columns,
  width,
  collapsed,
  progress,
  onToggle,
}: {
  row: Row;
  columns: GanttColumn[];
  width: number;
  collapsed: boolean;
  progress: number;
  onToggle: () => void;
}) {
  const cal = useCalendarView();
  const { task } = row;
  const allDay = !!task.allDay;
  // All-day ends are exclusive: show the last day (a milestone is a point).
  const lastDay = new Date(Math.max(ms(task.start), ms(task.end) - (allDay ? 1 : 0)));
  const length = ms(task.end) - ms(task.start);
  const duration =
    taskType(task) === "milestone"
      ? "—"
      : length >= DAY || allDay
        ? cal.t("gantt.days", { n: Math.round(length / DAY) || 1 }, `${Math.round(length / DAY) || 1} d`)
        : cal.t("gantt.hours", { n: Math.round(length / 3_600_000) }, `${Math.round(length / 3_600_000)} h`);
  const cell = (c: GanttColumn) => {
    switch (c) {
      case "task":
        return (
          <>
            <span style={{ width: row.depth * 16, flex: "none" }} />
            {row.hasChildren ? (
              <button
                type="button"
                className="agendfy-gantt-toggle"
                aria-expanded={!collapsed}
                aria-label={cal.t(collapsed ? "gantt.expand" : "gantt.collapse", { name: task.title })}
                onClick={onToggle}
              >
                {collapsed ? "▸" : "▾"}
              </button>
            ) : (
              <span className="agendfy-gantt-toggle-space" />
            )}
            <span className="agendfy-gantt-title">{task.title}</span>
          </>
        );
      case "start":
        return cal.formatDate(task.start, "d MMM");
      case "end":
        return cal.formatDate(lastDay, "d MMM");
      case "duration":
        return duration;
      case "progress":
        return taskType(task) === "milestone" ? "—" : `${Math.round(progress)}%`;
    }
  };
  return (
    <div className="agendfy-gantt-grid" role="rowheader" style={{ width }}>
      {columns.map((c) => (
        <div key={c} className={`agendfy-gantt-cell agendfy-gantt-col--${c}`} style={{ width: COLUMN_WIDTH[c] }}>
          {cell(c)}
        </div>
      ))}
    </div>
  );
}

function DayZone({ id, day, allDay, left, width }: { id: string; day: Date; allDay: boolean; left: number; width: number }) {
  const cal = useCalendarView();
  const disabled = cal.isDisabled(day);
  const off = cal.businessHoursFor(day).length === 0 && !!cal.config.businessHours?.enabled;
  const { setNodeRef, isOver } = useDropZone(id, { date: day, allDay }, { disabled });
  return (
    <div
      ref={setNodeRef}
      className={cx("agendfy-gantt-day", off && "agendfy-gantt-day--off", isOver && "agendfy-gantt-day--over")}
      style={{ left, width }}
      onClick={() => !disabled && cal.onSlotClick(day)}
    />
  );
}

function Bar({
  task,
  scale,
  rowHeight,
  critical,
  canMove,
  canResize,
}: {
  task: Task;
  scale: TimeScale;
  rowHeight: number;
  critical: boolean;
  canMove: boolean;
  canResize: boolean;
}) {
  const cal = useCalendarView();
  const type = taskType(task);
  const x = scale.toPx(task.start);
  const width = Math.max(4, scale.toPx(task.end) - x);
  const dayPx = 1440 * scale.pxPerMinute;
  const progress = Math.max(0, Math.min(100, task.progress ?? 0));

  // Grab point: start of the day under the pointer minus the task's start.
  const grabRef = useRef(0);
  const onGrab = (e: PointerEvent<HTMLDivElement>) => {
    const px = x + e.clientX - e.currentTarget.getBoundingClientRect().left;
    grabRef.current = scale.toDate(Math.floor(px / dayPx) * dayPx).getTime() - ms(task.start);
  };
  const { setNodeRef, attributes, listeners, isDragging } = useEventDraggable(task, {
    disabled: !canMove,
    anchor: () => grabRef.current,
  });

  /* --- resize the end, and drag the progress ---------------------------- */
  const [preview, setPreview] = useState<{ width?: number; progress?: number; invalid?: boolean } | null>(null);
  const dragRef = useRef<{ kind: "end" | "progress"; startX: number; end?: Date; progress?: number } | null>(null);
  const onHandleDown = (kind: "end" | "progress") => (e: PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { kind, startX: e.clientX };
    setPreview({});
  };
  const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (d.kind === "end") {
      const snapped = scale.toDate(Math.round((x + width + dx) / dayPx) * dayPx);
      const end = new Date(Math.max(snapped.getTime(), ms(task.start) + DAY));
      d.end = end;
      const verdict = cal.validate({ kind: "resize", event: { ...task, end: end.toISOString() }, before: task });
      setPreview({ width: scale.toPx(end) - x, invalid: verdict !== true });
    } else {
      const value = Math.max(0, Math.min(100, Math.round(((width * progress) / 100 + dx) / width * 20) * 5));
      d.progress = value;
      setPreview({ progress: value });
    }
  };
  const onHandleUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setPreview(null);
    if (!d) return;
    if (d.kind === "end" && d.end && d.end.getTime() !== ms(task.end)) cal.resizeEvent(task, { end: d.end });
    if (d.kind === "progress" && d.progress !== undefined && d.progress !== progress) cal.updateEvent(task, { progress: d.progress });
  };
  const handle = (kind: "end" | "progress", className: string, style?: React.CSSProperties) => (
    <div
      className={className}
      style={style}
      aria-hidden="true"
      onPointerDown={onHandleDown(kind)}
      onPointerMove={onHandleMove}
      onPointerUp={onHandleUp}
      onPointerCancel={onHandleUp}
      onClick={(e) => e.stopPropagation()}
    />
  );

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !isDragging) {
      e.preventDefault();
      cal.onEventClick(task);
      return;
    }
    listeners?.onKeyDown?.(e);
  };

  const shown = preview?.progress ?? progress;
  const label = cal.t("gantt.bar", {
    title: task.title,
    start: cal.formatDate(task.start, "d MMM"),
    end: cal.formatDate(new Date(ms(task.end) - (task.allDay ? 1 : 0)), "d MMM"),
    progress: Math.round(progress),
  });
  const baselineX = task.baselineStart ? scale.toPx(task.baselineStart) : null;
  const baselineW = task.baselineStart && task.baselineEnd ? scale.toPx(task.baselineEnd) - (baselineX ?? 0) : 0;
  const top = type === "summary" ? rowHeight * 0.36 : rowHeight * 0.18;
  const height = type === "summary" ? rowHeight * 0.22 : rowHeight * 0.56;

  return (
    <>
      {baselineX !== null && baselineW > 0 && (
        <div className="agendfy-gantt-baseline" style={{ left: baselineX, width: baselineW, top: top + height + 3 }} />
      )}
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onKeyDown={onKeyDown}
        onPointerDownCapture={onGrab}
        onClick={() => cal.onEventClick(task)}
        className={cx(
          "agendfy-gantt-bar",
          `agendfy-gantt-bar--${type}`,
          critical && "agendfy-gantt-bar--critical",
          isDragging && "agendfy-gantt-bar--dragging",
          preview?.invalid && "agendfy-gantt-bar--invalid",
          cal.eventClassName(task)
        )}
        data-event-id={String(task.id)}
        aria-label={type === "milestone" ? `${cal.t("gantt.milestone")}: ${task.title}, ${cal.formatDate(task.start, "d MMM")}` : label}
        style={
          type === "milestone"
            ? { left: x - rowHeight * 0.28, top: rowHeight * 0.22, width: rowHeight * 0.56, height: rowHeight * 0.56 }
            : {
                left: x,
                width: preview?.width ?? width,
                top,
                height,
                ["--agendfy-gantt-color" as string]: task.color,
                color: type === "task" ? getContrastText(task.color) : undefined,
              }
        }
      >
        {type === "task" && (
          <>
            <div className="agendfy-gantt-progress" style={{ width: `${shown}%` }} />
            <span className="agendfy-gantt-bar-label">{cal.renderEventContent(task) ?? task.title}</span>
            {canResize && handle("progress", "agendfy-gantt-progress-handle", { left: `${shown}%` })}
            {canResize && handle("end", "agendfy-gantt-resize")}
          </>
        )}
      </div>
      {type !== "task" && (
        <span className="agendfy-gantt-side-label" style={{ left: x + (type === "milestone" ? rowHeight * 0.4 : width) + 6, top: rowHeight * 0.5 }}>
          {task.title}
        </span>
      )}
    </>
  );
}

/** Dependency arrows (behind the bars). Rows not rendered (collapsed) are skipped. */
function Links({
  rows,
  rowIndex,
  rowHeight,
  scale,
  left,
  critical,
  height,
}: {
  rows: Row[];
  rowIndex: Map<string, number>;
  rowHeight: number;
  scale: TimeScale;
  left: number;
  critical: Set<string>;
  height: number;
}) {
  const uid = useId().replace(/:/g, "");
  const paths: { key: string; d: string; critical: boolean }[] = [];
  for (const row of rows) {
    const to = row.task;
    const toIndex = rowIndex.get(String(to.id))!;
    for (const dep of dependenciesOf(to)) {
      const fromIndex = rowIndex.get(String(dep.id));
      if (fromIndex === undefined) continue;
      const from = rows[fromIndex].task;
      // FS: end → start; SS: start → start; FF: end → end; SF: start → end.
      const x1 = scale.toPx(dep.type === "SS" || dep.type === "SF" ? from.start : from.end);
      const x2 = scale.toPx(dep.type === "FF" || dep.type === "SF" ? to.end : to.start);
      const y1 = fromIndex * rowHeight + rowHeight / 2;
      const y2 = toIndex * rowHeight + rowHeight / 2;
      const out = 8;
      const d =
        x2 - out >= x1 + out
          ? `M${x1},${y1} H${x1 + out} V${y2} H${x2}`
          : `M${x1},${y1} H${x1 + out} V${(y1 + y2) / 2} H${x2 - out} V${y2} H${x2}`;
      paths.push({ key: `${dep.id}->${to.id}`, d, critical: critical.has(String(dep.id)) && critical.has(String(to.id)) });
    }
  }
  const marker = (id: string, className: string) => (
    <marker id={id} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" markerUnits="userSpaceOnUse" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" className={className} />
    </marker>
  );
  return (
    <svg className="agendfy-gantt-links" style={{ left, width: scale.totalPx, height }} aria-hidden="true">
      <defs>
        {marker(`${uid}-arrow`, "agendfy-gantt-arrow")}
        {marker(`${uid}-arrow-critical`, "agendfy-gantt-arrow agendfy-gantt-arrow--critical")}
      </defs>
      {paths.map((p) => (
        <path
          key={p.key}
          d={p.d}
          className={cx("agendfy-gantt-link", p.critical && "agendfy-gantt-link--critical")}
          markerEnd={`url(#${uid}-arrow${p.critical ? "-critical" : ""})`}
        />
      ))}
    </svg>
  );
}

/** The current time, refreshed every minute while `enabled` (for the today line). */
function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}
