import React, { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Gantt, cascadeChange, type GanttApi, type GanttZoom, type Task } from "@react-agendfy/gantt";
import { createDemoProject } from "./demoProject";
import TaskModal from "./components/TaskModal";
import { dayKey } from "./lib/time";

const PROJECT_KEY = "agendfy-demo-project-v1";

const load = (): Task[] => {
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* private mode */
  }
  return createDemoProject();
};
const save = (tasks: Task[] | null) => {
  try {
    if (tasks) localStorage.setItem(PROJECT_KEY, JSON.stringify(tasks));
    else localStorage.removeItem(PROJECT_KEY);
  } catch {
    /* private mode */
  }
};

/**
 * The Gantt on its own: only `@react-agendfy/gantt`'s <Gantt>, in project
 * vocabulary — tasks, zoom, onTaskChange. No calendar views.
 */
export default function GanttPage({
  theme,
  lang,
  timeZone,
  tokens,
  notify,
}: {
  theme: string;
  lang: string;
  timeZone: string;
  tokens: Record<string, string>;
  notify: (message: string) => void;
}) {
  const [tasks, setTasks] = useState<Task[]>(load);
  const [zoom, setZoom] = useState<GanttZoom>("month");
  const apiRef = useRef<GanttApi>(null);
  const [newTaskOn, setNewTaskOn] = useState<string | null>(null);

  // One call per change: the task, and the tasks it pushed.
  const onTaskChange = (task: Task, moved: Task[]) => {
    setTasks((prev) => {
      const changed = new Map([task, ...moved].map((t) => [t.id, t]));
      const next = prev.map((t) => changed.get(t.id) ?? t);
      save(next);
      return next;
    });
    if (moved.length) notify(`${task.title} moved · ${moved.length} task${moved.length === 1 ? "" : "s"} pushed`);
  };

  // A new task joins the project; its summaries grow to span it.
  const create = (task: Task) => {
    setTasks((prev) => {
      const withTask = [...prev, task];
      const changed = new Map(cascadeChange(withTask, task).map((t) => [t.id, t]));
      const next = withTask.map((t) => changed.get(t.id) ?? t);
      save(next);
      return next;
    });
    setNewTaskOn(null);
    apiRef.current?.gotoDate(task.start);
    notify(`${task.title} added`);
  };

  const reset = () => {
    save(null);
    setTasks(createDemoProject());
    notify("Project reset");
  };

  return (
    <main className="main gantt-page">
      <div className="main-head">
        <div>
          <h1>Website launch</h1>
          <div className="history-actions">
            <button type="button" className="btn btn-primary" onClick={() => setNewTaskOn(dayKey(new Date(), timeZone))}>
              <Plus size={16} /> New task
            </button>
            <button type="button" className="btn" onClick={() => apiRef.current?.undo()} title="Undo (Ctrl/⌘+Z)">
              Undo
            </button>
            <button type="button" className="btn" onClick={() => apiRef.current?.redo()} title="Redo (Ctrl/⌘+Shift+Z)">
              Redo
            </button>
            <button type="button" className="btn" onClick={reset}>
              Reset project
            </button>
          </div>
          <p>
            Only <code>&lt;Gantt&gt;</code>: drag a bar and its successors follow; drag the end to resize, the
            handle at the bottom to change progress. Click an empty day to add a task there. Zoom: {zoom}.
          </p>
        </div>
      </div>
      <section className="calendar-card" aria-label="Project">
        <style>{`.agendfy.demo-gantt { ${Object.entries(tokens)
          .map(([k, v]) => `${k}: ${v};`)
          .join(" ")} }`}</style>
        <Gantt
          className="demo-gantt"
          apiRef={apiRef}
          tasks={tasks}
          zoom={zoom}
          onZoomChange={setZoom}
          onTaskChange={onTaskChange}
          onTaskClick={(task) => notify(`${task.title} · ${Math.round(task.progress ?? 0)}% done`)}
          onDateClick={(date) => setNewTaskOn(dayKey(date, timeZone))}
          onChangeRejected={(info) => notify(info.message ?? "That change is not allowed")}
          theme={theme}
          lang={lang}
          timeZone={timeZone}
        />
      </section>
      <TaskModal
        startKey={newTaskOn}
        tasks={tasks}
        timeZone={timeZone}
        onClose={() => setNewTaskOn(null)}
        onCreate={create}
      />
    </main>
  );
}
