import React, { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Check, ListChecks, Sparkles, Wand2, X, Search } from "lucide-react";
import {
  useAgenda,
  useAvailability,
  useBatchParser,
  useConflictResolution,
  useEventEditing,
  detectConflicts,
  type AgendaResult,
  type AvailabilityResult,
  type BatchParseResult,
  type ConflictResolution,
  type EventEditResult,
  type AIAdapter,
} from "@react-agendfy/ai";
import { categoryColor } from "../demoEvents";
import { formatTime } from "../lib/time";

type Tab = "create" | "edit" | "find" | "day" | "conflicts";

interface AIDrawerProps {
  open: boolean;
  onClose: () => void;
  adapter?: AIAdapter;
  events: any[];
  timeZone: string;
  hour12: boolean;
  onCreate: (events: any[]) => void;
  onUpdate: (event: any) => void;
  onDelete: (id: string) => void;
  onPickSlot: (start: string, end: string) => void;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "create", label: "Create", icon: <Sparkles size={16} /> },
  { id: "edit", label: "Edit", icon: <Wand2 size={16} /> },
  { id: "find", label: "Find time", icon: <Search size={16} /> },
  { id: "day", label: "My day", icon: <ListChecks size={16} /> },
  { id: "conflicts", label: "Conflicts", icon: <AlertTriangle size={16} /> },
];

const examples: Record<"create" | "edit" | "find", string[]> = {
  create: ["Lunch with Maya tomorrow at 1pm", "Standup 9:30, design sync 11am and gym at 6pm", "Dentist Friday 4pm for 30 min"],
  edit: ["Move the investor update to 5pm", "Rename deep work to Focus time", "Cancel lunch with Rui"],
  find: ["1 hour free tomorrow afternoon", "30 minutes this week before noon", "2 hours on Friday"],
};

export default function AIDrawer(props: AIDrawerProps) {
  const { open, onClose, adapter, events, timeZone, hour12 } = props;
  const [tab, setTab] = useState<Tab>("create");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [batchResult, setBatchResult] = useState<BatchParseResult | null>(null);
  const [editResult, setEditResult] = useState<EventEditResult | null | "none">(null);
  const [findResult, setFindResult] = useState<AvailabilityResult | null>(null);
  const [dayResult, setDayResult] = useState<AgendaResult | null>(null);
  const [conflicts, setConflicts] = useState<ConflictResolution[] | null>(null);

  const opts = { timeZone, locale: "en-US" };
  const batch = useBatchParser(adapter, opts);
  const editor = useEventEditing(adapter, opts);
  const availability = useAvailability(adapter, { timeZone });
  const agenda = useAgenda(adapter, { period: "day", timeZone });
  const conflictRes = useConflictResolution(adapter, { timeZone });
  const loading = batch.loading || editor.loading || availability.loading || agenda.loading || conflictRes.loading;

  const timed = events.filter((e) => !e.recurrence);
  const t = (iso: string | Date) => formatTime(iso, timeZone, hour12);
  const day = (iso: string | Date) =>
    new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", timeZone }).format(new Date(iso));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const run = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    if (tab === "create") run(async () => setBatchResult(await batch.parse(input)));
    if (tab === "edit") run(async () => setEditResult((await editor.edit(input, timed)) ?? "none"));
    if (tab === "find") run(async () => setFindResult(await availability.check(input, timed)));
  };

  const switchTab = (id: Tab) => {
    setTab(id);
    setInput("");
    setError("");
    if (id === "day" && !dayResult) run(async () => setDayResult(await agenda.generate(timed)));
    if (id === "conflicts") {
      run(async () => {
        const found = detectConflicts(timed, { timeZone });
        setConflicts(found.length ? (await conflictRes.resolve(timed, found)) ?? [] : []);
      });
    }
  };

  const titleOf = (id: string) => events.find((e) => e.id === id)?.title ?? id;
  const edited = editResult && editResult !== "none" ? events.find((e) => e.id === editResult.eventId) : null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="AI assistant">
        <div className="drawer-head">
          <span className="brand-mark" aria-hidden>
            <Sparkles size={16} />
          </span>
          <div style={{ flex: 1 }}>
            <h2>AI assistant</h2>
            <p>
              {adapter
                ? "Connected to an LLM through @react-agendfy/ai."
                : "Running the built-in offline parser: no API key, nothing leaves the browser."}
            </p>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="segmented" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((x) => (
              <button key={x.id} aria-pressed={tab === x.id} onClick={() => switchTab(x.id)}>
                {x.icon}
                {x.label}
              </button>
            ))}
          </div>

          {(tab === "create" || tab === "edit" || tab === "find") && (
            <>
              <form onSubmit={submit} style={{ display: "flex", gap: 8 }}>
                <input
                  className="input"
                  autoFocus
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    tab === "create" ? "Describe one or more events…" : tab === "edit" ? "What should change?" : "What kind of slot?"
                  }
                  aria-label="Request"
                />
                <button className="btn btn-primary" disabled={loading || !input.trim()}>
                  {loading ? "…" : tab === "find" ? "Search" : "Preview"}
                </button>
              </form>
              <div className="ai-examples">
                {examples[tab].map((ex) => (
                  <button key={ex} className="ai-example" onClick={() => setInput(ex)}>
                    {ex}
                  </button>
                ))}
              </div>
            </>
          )}

          {error && <div className="modal-note" style={{ color: "var(--app-danger)" }}>{error}</div>}

          {tab === "create" && batchResult && (
            <div className="ai-result">
              <div className="ai-result-head">
                {batchResult.events.length} event{batchResult.events.length === 1 ? "" : "s"} understood
                {batchResult.events.length > 0 && (
                  <button
                    className="btn btn-primary"
                    style={{ height: 30 }}
                    onClick={() => {
                      props.onCreate(batchResult.events.map((r) => r.event));
                      setBatchResult(null);
                      setInput("");
                    }}
                  >
                    <Check size={15} /> Add to calendar
                  </button>
                )}
              </div>
              {batchResult.events.map((r, i) => (
                <div className="ai-result-item" key={i}>
                  <span className="check-box" style={{ ["--swatch" as any]: categoryColor("meeting"), background: "var(--swatch)" }} />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{r.event.title}</div>
                    <div className="muted">
                      {day(r.event.start)} · {r.event.allDay ? "All day" : `${t(r.event.start)} – ${t(r.event.end)}`}
                    </div>
                  </div>
                  <span className="badge">{r.confidence}</span>
                </div>
              ))}
              {batchResult.failed.map((f, i) => (
                <div className="ai-result-item" key={`f${i}`}>
                  <AlertTriangle size={16} color="var(--app-danger)" />
                  <div className="grow muted">
                    “{f.input}” — {f.error}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "edit" && editResult === "none" && <div className="ai-empty">No matching event found.</div>}
          {tab === "edit" && editResult && editResult !== "none" && (
            <div className="ai-result">
              <div className="ai-result-head">
                <span style={{ textTransform: "capitalize" }}>{editResult.action}</span>
                <span className="badge">{editResult.confidence}</span>
              </div>
              <div className="ai-result-item">
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{edited?.title ?? editResult.eventId}</div>
                  {edited && (
                    <div className="muted">
                      {day(edited.start)} · {t(edited.start)} – {t(edited.end)}
                    </div>
                  )}
                  {editResult.action !== "delete" && editResult.updates && (
                    <div className="muted" style={{ color: "var(--app-accent)", marginTop: 4 }}>
                      →{" "}
                      {editResult.updates.title && `“${editResult.updates.title}” `}
                      {editResult.updates.start && `${day(editResult.updates.start)} ${t(editResult.updates.start)}`}
                      {editResult.updates.end && ` – ${t(editResult.updates.end)}`}
                    </div>
                  )}
                </div>
                <button
                  className={`btn ${editResult.action === "delete" ? "btn-danger" : "btn-primary"}`}
                  style={{ height: 30 }}
                  disabled={!edited}
                  onClick={() => {
                    if (!edited) return;
                    if (editResult.action === "delete") props.onDelete(edited.id);
                    else props.onUpdate({ ...edited, ...editResult.updates });
                    setEditResult(null);
                    setInput("");
                  }}
                >
                  {editResult.action === "delete" ? "Delete" : "Apply"}
                </button>
              </div>
            </div>
          )}

          {tab === "find" && findResult && (
            <div className="ai-result">
              <div className="ai-result-head" style={{ fontWeight: 500 }}>
                {findResult.answer}
              </div>
              {findResult.slots.length === 0 && <div className="ai-empty">No free slot matches.</div>}
              {findResult.slots.slice(0, 6).map((s) => (
                <div className="ai-result-item" key={s.start}>
                  <CalendarClock size={16} color="var(--app-accent)" />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{day(s.start)}</div>
                    <div className="muted">
                      {t(s.start)} – {t(s.end)} · {s.durationMinutes} min free
                    </div>
                  </div>
                  <button className="btn" style={{ height: 30 }} onClick={() => props.onPickSlot(s.start, s.end)}>
                    Book
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "day" && (
            <div className="ai-result">
              <div className="ai-result-head">
                Today
                {dayResult && (
                  <span className="badge">
                    {dayResult.stats.eventCount} events · {dayResult.stats.totalMeetingHours}h
                  </span>
                )}
              </div>
              {!dayResult && <div className="ai-empty">{loading ? "Thinking…" : "Nothing yet."}</div>}
              {dayResult?.items.length === 0 && <div className="ai-empty">A free day. Enjoy it.</div>}
              {dayResult?.items.map((i) => (
                <div className="ai-result-item" key={i.event.id}>
                  <span style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: i.event.color }} />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{i.event.title}</div>
                    <div className="muted">
                      {t(i.event.start)} – {t(i.event.end)} · {i.durationMinutes} min
                    </div>
                  </div>
                </div>
              ))}
              {dayResult?.summary && (
                <div className="ai-result-item muted" style={{ display: "block" }}>
                  {dayResult.summary}
                </div>
              )}
            </div>
          )}

          {tab === "conflicts" && (
            <div className="ai-result">
              <div className="ai-result-head">
                Overlaps & double bookings
                {conflicts && <span className="badge">{conflicts.length}</span>}
              </div>
              {!conflicts && <div className="ai-empty">{loading ? "Checking…" : ""}</div>}
              {conflicts?.length === 0 && <div className="ai-empty">No conflicts. Nicely planned.</div>}
              {conflicts?.map((c, i) => (
                <div className="ai-result-item" key={i} style={{ alignItems: "flex-start" }}>
                  <AlertTriangle size={16} color="#f59e0b" style={{ marginTop: 2, flex: "none" }} />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>
                      {titleOf(c.conflict.eventIds[0])} × {titleOf(c.conflict.eventIds[1])}
                    </div>
                    <div className="muted">
                      {day(c.conflict.overlapStart)} · {t(c.conflict.overlapStart)} – {t(c.conflict.overlapEnd)}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>
                      {c.suggestion}
                    </div>
                  </div>
                  {c.proposedFix && (
                    <button
                      className="btn btn-primary"
                      style={{ height: 30 }}
                      onClick={() => {
                        const ev = events.find((e) => e.id === c.proposedFix!.eventId);
                        if (ev) props.onUpdate({ ...ev, start: c.proposedFix!.newStart, end: c.proposedFix!.newEnd });
                        setConflicts((all) => all?.filter((x) => x !== c) ?? null);
                      }}
                    >
                      Fix
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="ai-hint">
            Everything here is a preview until you apply it. In production, route the LLM through your backend
            with <code>httpAdapter</code> — keys never belong in the browser.
          </p>
        </div>
      </aside>
    </>
  );
}
