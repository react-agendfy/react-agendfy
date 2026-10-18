import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { categories, resources, type CategoryId } from "../demoEvents";
import { accentPresets } from "../themes";
import { addDaysKey, dayKey, formatTime, zonedParts } from "../lib/time";

export interface DemoOptions {
  lang: string;
  timeZone: string;
  weekStart: "auto" | "0" | "1";
  weekends: boolean;
  weekNumbers: boolean;
  hour12: boolean;
  accent: string;
}

export const languages = [
  { id: "en", label: "English" },
  { id: "pt", label: "Português" },
  { id: "pt-BR", label: "Português (BR)" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "ar", label: "العربية (RTL)" },
];

const baseZones = [
  "UTC",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Paris",
  "Africa/Luanda",
  "America/New_York",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Australia/Sydney",
];

interface SidebarProps {
  open: boolean;
  events: any[];
  visibleRange: { start: Date; end: Date; date: Date } | null;
  onGotoDate: (date: Date) => void;
  onNewEvent: () => void;
  hiddenCategories: Set<CategoryId>;
  onToggleCategory: (id: CategoryId) => void;
  activeResources: string[];
  onToggleResource: (id: string) => void;
  options: DemoOptions;
  onOptionsChange: (patch: Partial<DemoOptions>) => void;
}

function MiniMonth({
  events,
  timeZone,
  weekStartsOn,
  lang,
  visibleRange,
  onGotoDate,
}: {
  events: any[];
  timeZone: string;
  weekStartsOn: number;
  lang: string;
  visibleRange: SidebarProps["visibleRange"];
  onGotoDate: (d: Date) => void;
}) {
  const todayKey = dayKey(new Date(), timeZone);
  const [cursor, setCursor] = useState(() => todayKey.slice(0, 7)); // yyyy-MM

  // Follow the calendar when it navigates to another month.
  useEffect(() => {
    if (visibleRange) setCursor(dayKey(visibleRange.date, timeZone).slice(0, 7));
  }, [visibleRange?.date.getTime(), timeZone]);

  const eventDays = useMemo(() => {
    const days = new Set<string>();
    for (const e of events) {
      if (e.recurrence) continue;
      let k = dayKey(e.start, timeZone);
      const last = e.allDay ? addDaysKey(dayKey(e.end, timeZone), -1) : dayKey(e.end, timeZone);
      for (let i = 0; i < 31 && k <= last; i++, k = addDaysKey(k, 1)) days.add(k);
    }
    return days;
  }, [events, timeZone]);

  const [y, m] = cursor.split("-").map(Number);
  const first = `${cursor}-01`;
  const firstDow = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const gridStart = addDaysKey(first, -((firstDow - weekStartsOn + 7) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => addDaysKey(gridStart, i));

  const rangeStart = visibleRange ? dayKey(visibleRange.start, timeZone) : "";
  const rangeEnd = visibleRange ? dayKey(new Date(visibleRange.end.getTime() - 1), timeZone) : "";
  const rangeIsMonth = visibleRange && visibleRange.end.getTime() - visibleRange.start.getTime() > 8 * 86400000;

  const monthLabel = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 15))
  );
  const dows = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(lang, { weekday: "narrow", timeZone: "UTC" }).format(
      new Date(Date.UTC(2024, 0, 7 + ((weekStartsOn + i) % 7)))
    )
  );
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setCursor(d.toISOString().slice(0, 7));
  };

  return (
    <div className="panel">
      <div className="mini-month-head">
        <span style={{ textTransform: "capitalize" }}>{monthLabel}</span>
        <div>
          <button className="btn btn-ghost btn-icon" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft size={16} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="mini-month-grid">
        {dows.map((d, i) => (
          <span key={i} className="mini-month-dow">
            {d}
          </span>
        ))}
        {cells.map((k) => {
          const cls = [
            "mini-day",
            k.slice(0, 7) !== cursor && "is-outside",
            !rangeIsMonth && k >= rangeStart && k <= rangeEnd && "in-range",
            k === todayKey && "is-today",
            eventDays.has(k) && "has-events",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={k}
              className={cls}
              onClick={() => onGotoDate(new Date(`${k}T12:00:00Z`))}
              aria-label={k}
              aria-current={k === todayKey ? "date" : undefined}
            >
              {Number(k.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Switch({ checked, onChange, id }: { checked: boolean; onChange: (v: boolean) => void; id: string }) {
  return (
    <span className="switch">
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </span>
  );
}

export default function Sidebar(props: SidebarProps) {
  const { options, onOptionsChange, events } = props;
  const tz = options.timeZone;
  const weekStartsOn = options.weekStart === "auto" ? (options.lang === "en" ? 0 : 1) : Number(options.weekStart);

  const now = new Date();
  const today = zonedParts(now, tz);
  const todayKey = today.date;
  const todays = events
    .filter((e) => !e.recurrence && !e.allDay && dayKey(e.start, tz) === todayKey)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const next = todays.find((e) => new Date(e.end) > now);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events) c[e.category] = (c[e.category] ?? 0) + 1;
    return c;
  }, [events]);

  const zones = baseZones.includes(tz) ? baseZones : [tz, ...baseZones];

  return (
    <aside className={`sidebar${props.open ? " is-open" : ""}`} aria-label="Calendar controls">
      <button className="btn btn-primary btn-block" style={{ height: 42 }} onClick={props.onNewEvent}>
        <Plus size={18} /> New event
      </button>

      <div className="panel today-card">
        <div className="today-date" aria-hidden>
          <div className="today-date-month">
            {new Intl.DateTimeFormat(options.lang, { month: "short", timeZone: tz }).format(now)}
          </div>
          <div className="today-date-day">{today.day}</div>
        </div>
        <div className="today-meta">
          <strong>
            {todays.length} event{todays.length === 1 ? "" : "s"} today
          </strong>
          <span>
            {next
              ? `Next: ${next.title} · ${formatTime(next.start, tz, options.hour12)}`
              : "You're free for the rest of the day"}
          </span>
        </div>
      </div>

      <MiniMonth
        events={events}
        timeZone={tz}
        weekStartsOn={weekStartsOn}
        lang={options.lang}
        visibleRange={props.visibleRange}
        onGotoDate={props.onGotoDate}
      />

      <div className="panel">
        <h3 className="panel-title">My calendars</h3>
        <div className="check-list">
          {categories.map((c) => (
            <label key={c.id} className="check-item" style={{ ["--swatch" as any]: c.color }}>
              <input
                type="checkbox"
                checked={!props.hiddenCategories.has(c.id)}
                onChange={() => props.onToggleCategory(c.id)}
              />
              <span className="check-box" />
              <span className="check-label">{c.label}</span>
              <span className="check-count">{counts[c.id] ?? 0}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Resources</h3>
        <div className="chips">
          {resources.map((r) => (
            <button
              key={r.id}
              className="chip"
              aria-pressed={props.activeResources.includes(r.id)}
              onClick={() => props.onToggleResource(r.id)}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Brand it</h3>
        <div className="swatches">
          {accentPresets.map((p) => (
            <button
              key={p.id}
              className="swatch"
              style={{ ["--swatch" as any]: p.swatch }}
              aria-pressed={options.accent === p.id}
              aria-label={`${p.label} accent`}
              title={p.label}
              onClick={() => onOptionsChange({ accent: p.id })}
            />
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 className="panel-title">Live options</h3>
        <div className="option-row">
          <label htmlFor="opt-lang">Language</label>
          <select id="opt-lang" className="select" value={options.lang} onChange={(e) => onOptionsChange({ lang: e.target.value })}>
            {languages.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="option-row">
          <label htmlFor="opt-tz">Time zone</label>
          <select id="opt-tz" className="select" value={tz} onChange={(e) => onOptionsChange({ timeZone: e.target.value })}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
        <div className="option-row">
          <label htmlFor="opt-week">Week starts</label>
          <select
            id="opt-week"
            className="select"
            value={options.weekStart}
            onChange={(e) => onOptionsChange({ weekStart: e.target.value as DemoOptions["weekStart"] })}
          >
            <option value="auto">Locale default</option>
            <option value="0">Sunday</option>
            <option value="1">Monday</option>
          </select>
        </div>
        <div className="option-row">
          <label htmlFor="opt-weekends">Show weekends</label>
          <Switch id="opt-weekends" checked={options.weekends} onChange={(v) => onOptionsChange({ weekends: v })} />
        </div>
        <div className="option-row">
          <label htmlFor="opt-weeknums">Week numbers</label>
          <Switch id="opt-weeknums" checked={options.weekNumbers} onChange={(v) => onOptionsChange({ weekNumbers: v })} />
        </div>
        <div className="option-row">
          <label htmlFor="opt-12h">12-hour clock</label>
          <Switch id="opt-12h" checked={options.hour12} onChange={(v) => onOptionsChange({ hour12: v })} />
        </div>
      </div>

      <p className="sidebar-note">
        Everything on this page is the demo app. The calendar is styled only with
        <code> --agendfy-*</code> tokens and an <code>eventContent</code> renderer —{" "}
        <a href="https://github.com/react-agendfy/react-agendfy#customizing-the-look" target="_blank" rel="noreferrer">
          see how
        </a>
        .
      </p>
    </aside>
  );
}
