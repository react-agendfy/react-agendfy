import React, { useEffect, useMemo, useRef, useState } from "react";
import { Diamond, FolderTree, ListTodo, Plus, X } from "lucide-react";
import { taskType, type Task } from "@react-agendfy/gantt";
import { addDaysKey, dayKey, fromZoned } from "../lib/time";

type Kind = "task" | "milestone" | "summary";

const KINDS: { id: Kind; label: string; Icon: typeof ListTodo }[] = [
  { id: "task", label: "Task", Icon: ListTodo },
  { id: "milestone", label: "Milestone", Icon: Diamond },
  { id: "summary", label: "Summary", Icon: FolderTree },
];

const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];

interface TaskModalProps {
  /** The day the new task starts on (a "YYYY-MM-DD" key); null closes the modal. */
  startKey: string | null;
  tasks: Task[];
  timeZone: string;
  onClose: () => void;
  onCreate: (task: Task) => void;
}

/** "New task" form of the Gantt page: title, type, parent, dates, predecessors, progress. */
export default function TaskModal({ startKey, tasks, timeZone, onClose, onCreate }: TaskModalProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const blank = (start: string) => ({
    title: "",
    kind: "task" as Kind,
    parentId: tasks.find((t) => taskType(t) === "summary")?.id ?? "",
    start,
    days: 3,
    dependencies: [] as string[],
    progress: 0,
    color: COLORS[0],
  });
  const [form, setForm] = useState(() => blank(startKey ?? ""));
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!startKey) return;
    setForm(blank(startKey));
    requestAnimationFrame(() => titleRef.current?.focus());
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey]);

  const summaries = useMemo(() => tasks.filter((t) => taskType(t) === "summary"), [tasks]);
  const predecessors = useMemo(() => tasks.filter((t) => taskType(t) !== "summary"), [tasks]);

  /** The first day the task can start on: after every predecessor ends (finish-to-start). */
  const earliestKey = useMemo(() => {
    const ends = form.dependencies
      .map((id) => tasks.find((t) => String(t.id) === id))
      .filter((t): t is Task => !!t)
      // A task's end is the day after its last day: the next one can start then.
      .map((t) => dayKey(t.end, timeZone));
    return ends.length ? ends.sort().at(-1)! : "";
  }, [form.dependencies, tasks, timeZone]);

  if (!startKey) return null;

  const invalid = !form.title.trim()
    ? "Give the task a title"
    : !form.start
      ? "Pick a start date"
      : form.kind !== "milestone" && !(form.days >= 1)
        ? "A task lasts at least one day"
        : "";

  const toggleDependency = (id: string) => {
    const dependencies = form.dependencies.includes(id)
      ? form.dependencies.filter((d) => d !== id)
      : [...form.dependencies, id];
    // Picking a predecessor moves the start after it, as the scheduling would.
    const pred = tasks.find((t) => String(t.id) === id);
    const after = pred && !form.dependencies.includes(id) ? dayKey(pred.end, timeZone) : "";
    set({ dependencies, ...(after > form.start && { start: after }) });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (invalid) return;
    const start = fromZoned(form.start, "00:00", timeZone).toISOString();
    const end =
      form.kind === "milestone" ? start : fromZoned(addDaysKey(form.start, form.days), "00:00", timeZone).toISOString();
    onCreate({
      id: `task-${Date.now().toString(36)}`,
      title: form.title.trim(),
      start,
      end,
      ...(form.kind !== "task" && { type: form.kind }),
      ...(form.parentId && { parentId: form.parentId }),
      ...(form.dependencies.length && { dependencies: form.dependencies }),
      ...(form.kind === "task" && { progress: form.progress }),
      ...(form.kind !== "summary" && { color: form.color }),
    });
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="New task"
        onSubmit={submit}
        style={{ "--modal-accent": form.color } as React.CSSProperties}
      >
        <div className="modal-accent" />
        <div className="modal-body">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <input
              ref={titleRef}
              className="modal-title-input"
              placeholder="Task name"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              aria-label="Task name"
            />
            <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="category-picker" role="group" aria-label="Type">
            {KINDS.map(({ id, label, Icon }) => (
              <button
                type="button"
                key={id}
                className="category-option"
                style={{ "--swatch": "var(--app-accent)" } as React.CSSProperties}
                aria-pressed={form.kind === id}
                onClick={() => set({ kind: id })}
              >
                <Icon size={14} aria-hidden /> {label}
              </button>
            ))}
          </div>

          {form.kind === "summary" && (
            <div className="modal-note">A summary spans its tasks: add tasks to it and it grows with them.</div>
          )}

          <div className="task-form-grid">
            <label className="field">
              <span>{form.kind === "milestone" ? "Date" : "Start"}</span>
              <input
                className="input"
                type="date"
                value={form.start}
                min={earliestKey || undefined}
                onChange={(e) => set({ start: e.target.value })}
              />
            </label>
            {form.kind !== "milestone" && (
              <label className="field">
                <span>Duration (days)</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={form.days}
                  onChange={(e) => set({ days: Number(e.target.value) })}
                />
              </label>
            )}
            <label className="field">
              <span>Part of</span>
              <select className="input" value={form.parentId} onChange={(e) => set({ parentId: e.target.value })}>
                <option value="">— none —</option>
                {summaries.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {form.kind !== "summary" && predecessors.length > 0 && (
            <div className="field">
              <span className="field-label">Starts after</span>
              <div className="chips">
                {predecessors.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    className="chip"
                    aria-pressed={form.dependencies.includes(String(t.id))}
                    onClick={() => toggleDependency(String(t.id))}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.kind === "task" && (
            <label className="field">
              <span>Progress · {form.progress}%</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={form.progress}
                onChange={(e) => set({ progress: Number(e.target.value) })}
              />
            </label>
          )}

          {form.kind !== "summary" && (
            <div className="field">
              <span className="field-label">Color</span>
              <div className="swatches" role="group" aria-label="Color">
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    className="swatch"
                    style={{ background: c }}
                    aria-label={c}
                    aria-pressed={form.color === c}
                    onClick={() => set({ color: c })}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <span className="spacer" />
          {invalid && form.title && <span style={{ color: "var(--app-danger)", fontSize: 13 }}>{invalid}</span>}
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={Boolean(invalid)} style={{ opacity: invalid ? 0.6 : 1 }}>
            <Plus size={16} /> Create task
          </button>
        </div>
      </form>
    </div>
  );
}
