import React, { useEffect, useMemo, useRef, useState } from "react";
import { Clock, MapPin, Repeat, StickyNote, Trash2, Users, X } from "lucide-react";
import { categories, categoryColor, resources, type CategoryId } from "../demoEvents";
import { addDaysKey, fromZoned, zonedParts } from "../lib/time";
import { categoryIcons } from "./EventContent";

/** What opens the modal: an existing event, or a draft range for a new one. */
export interface EventDraft {
  id?: string;
  title?: string;
  start: string | Date;
  end: string | Date;
  allDay?: boolean;
  category?: CategoryId;
  location?: string;
  attendees?: string[];
  resources?: { id: string; name: string }[];
  notes?: string;
  recurrence?: string;
  /** Opened from an occurrence of a recurring series. */
  seriesId?: string;
}

interface EventModalProps {
  draft: EventDraft | null;
  timeZone: string;
  onClose: () => void;
  onSave: (event: any) => void;
  onDelete: (id: string) => void;
}

export default function EventModal({ draft, timeZone, onClose, onSave, onDelete }: EventModalProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(() => toForm(draft, timeZone));

  useEffect(() => {
    setForm(toForm(draft, timeZone));
    if (draft) requestAnimationFrame(() => titleRef.current?.focus());
  }, [draft, timeZone]);

  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [draft, onClose]);

  const invalid = useMemo(() => {
    if (!form.title.trim()) return "Give the event a title";
    if (form.allDay) return form.endDate < form.startDate ? "End date is before the start" : "";
    return `${form.endDate}T${form.endTime}` <= `${form.startDate}T${form.startTime}` ? "End is before the start" : "";
  }, [form]);

  if (!draft) return null;
  const isSeries = Boolean(draft.seriesId || draft.recurrence);
  const isEdit = Boolean(draft.id);
  const color = categoryColor(form.category);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    const base = {
      ...(draft.seriesId ? {} : draft),
      title: form.title.trim(),
      category: form.category,
      color,
      location: form.location.trim() || undefined,
      attendees: form.attendees
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      resources: resources.filter((r) => form.resources.includes(r.id)),
      notes: form.notes.trim() || undefined,
    };
    if (isSeries) {
      // Series edits keep the rule and its times; only details change.
      onSave({ ...base, id: draft.seriesId ?? draft.id, __seriesPatch: true });
      return;
    }
    const start = form.allDay ? fromZoned(form.startDate, "00:00", timeZone) : fromZoned(form.startDate, form.startTime, timeZone);
    const end = form.allDay
      ? fromZoned(addDaysKey(form.endDate, 1), "00:00", timeZone) // exclusive end
      : fromZoned(form.endDate, form.endTime, timeZone);
    onSave({ ...base, start: start.toISOString(), end: end.toISOString(), allDay: form.allDay });
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit event" : "New event"}
        onSubmit={submit}
        style={{ ["--modal-accent" as any]: color }}
      >
        <div className="modal-accent" />
        <div className="modal-body">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input
              ref={titleRef}
              className="modal-title-input"
              placeholder="Add a title"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              aria-label="Title"
            />
            <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="category-picker" role="group" aria-label="Calendar">
            {categories.map((c) => {
              const Icon = categoryIcons[c.id];
              return (
                <button
                  type="button"
                  key={c.id}
                  className="category-option"
                  style={{ ["--swatch" as any]: c.color }}
                  aria-pressed={form.category === c.id}
                  onClick={() => set({ category: c.id })}
                >
                  <Icon size={14} color={c.color} aria-hidden /> {c.label}
                </button>
              );
            })}
          </div>

          {isSeries && (
            <div className="modal-note">
              <Repeat size={16} style={{ flex: "none", marginTop: 1 }} />
              <span>
                This is a recurring series. Changes apply to every occurrence; its times come from the rule.
              </span>
            </div>
          )}

          <div className="field">
            <span className="field-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <Clock size={14} /> When <small style={{ fontWeight: 500, opacity: 0.8 }}>({timeZone})</small>
              </span>
              <label className="inline-toggle">
                All day
                <span className="switch">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={form.allDay}
                    disabled={isSeries}
                    onChange={(e) => set({ allDay: e.target.checked })}
                  />
                  <span />
                </span>
              </label>
            </span>
            <div className="field-row">
              <input
                className="input"
                type="date"
                aria-label="Start date"
                value={form.startDate}
                disabled={isSeries}
                onChange={(e) => {
                  const shift = daysBetween(form.startDate, e.target.value);
                  set({ startDate: e.target.value, endDate: addDaysKey(form.endDate, shift) });
                }}
              />
              <input
                className="input"
                type="time"
                aria-label="Start time"
                value={form.startTime}
                disabled={isSeries || form.allDay}
                onChange={(e) => set({ startTime: e.target.value })}
              />
              <input
                className="input"
                type="time"
                aria-label="End time"
                value={form.endTime}
                disabled={isSeries || form.allDay}
                onChange={(e) => set({ endTime: e.target.value })}
              />
            </div>
            {(form.allDay || form.endDate !== form.startDate) && (
              <div className="field-row">
                <span className="field-label" style={{ alignSelf: "center" }}>
                  Ends on
                </span>
                <input
                  className="input"
                  type="date"
                  aria-label="End date"
                  value={form.endDate}
                  min={form.startDate}
                  disabled={isSeries}
                  onChange={(e) => set({ endDate: e.target.value })}
                  style={{ gridColumn: "span 2" }}
                />
              </div>
            )}
          </div>

          <label className="field">
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <MapPin size={14} /> Location
            </span>
            <input className="input" placeholder="Room, address or link" value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </label>

          <label className="field">
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Users size={14} /> Guests
            </span>
            <input
              className="input"
              placeholder="Comma separated, e.g. Ana Costa, Rui Lopes"
              value={form.attendees}
              onChange={(e) => set({ attendees: e.target.value })}
            />
          </label>

          <div className="field">
            <span className="field-label">Resources</span>
            <div className="chips">
              {resources.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className="chip"
                  aria-pressed={form.resources.includes(r.id)}
                  onClick={() =>
                    set({
                      resources: form.resources.includes(r.id)
                        ? form.resources.filter((x) => x !== r.id)
                        : [...form.resources, r.id],
                    })
                  }
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <StickyNote size={14} /> Notes
            </span>
            <textarea className="input" placeholder="Agenda, links, anything" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </label>
        </div>

        <div className="modal-foot">
          {isEdit && (
            <button
              type="button"
              className="btn btn-ghost btn-danger"
              onClick={() => onDelete((draft.seriesId ?? draft.id)!)}
            >
              <Trash2 size={16} /> {isSeries ? "Delete series" : "Delete"}
            </button>
          )}
          <span className="spacer" />
          {invalid && form.title && <span style={{ color: "var(--app-danger)", fontSize: 13 }}>{invalid}</span>}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={Boolean(invalid)} style={{ opacity: invalid ? 0.6 : 1 }}>
            {isEdit ? "Save" : "Create event"}
          </button>
        </div>
      </form>
    </div>
  );
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

function toForm(draft: EventDraft | null, timeZone: string) {
  if (!draft) {
    return {
      title: "",
      category: "meeting" as CategoryId,
      allDay: false,
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      location: "",
      attendees: "",
      resources: [] as string[],
      notes: "",
    };
  }
  const s = zonedParts(draft.start, timeZone);
  const e = zonedParts(draft.end, timeZone);
  return {
    title: draft.title ?? "",
    category: draft.category ?? "meeting",
    allDay: Boolean(draft.allDay),
    startDate: s.date,
    startTime: s.time,
    // all-day ends are exclusive: show the last included day
    endDate: draft.allDay ? addDaysKey(e.date, -1) < s.date ? s.date : addDaysKey(e.date, -1) : e.date,
    endTime: e.time,
    location: draft.location ?? "",
    attendees: (draft.attendees ?? []).join(", "),
    resources: (draft.resources ?? []).map((r) => String(r.id)),
    notes: draft.notes ?? "",
  };
}
