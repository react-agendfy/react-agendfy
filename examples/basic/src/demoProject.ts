import type { Task } from "@react-agendfy/gantt";

/**
 * The demo project ("Website launch"), around today. Plain tasks: whole
 * days, `end` is the day after the last one. The "Gantt only" page uses
 * them as they are; the calendar demo adds them as all-day events.
 */
export function createDemoProject(now: Date = new Date()): Task[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const at = (offset: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset).toISOString();
  const task = (id: string, title: string, offset: number, days: number, fields: Partial<Task> = {}): Task => ({
    id,
    title,
    start: at(offset),
    end: at(offset + days),
    parentId: "proj-launch",
    progress: 0,
    ...fields,
  });
  const summary: Task = { id: "proj-launch", title: "Website launch", type: "summary", start: at(-7), end: at(21) };
  return [
    summary,
    task("proj-research", "Research", -7, 4, { progress: 100, resourceIds: ["r2"] }),
    task("proj-wireframes", "Wireframes", -3, 4, { progress: 75, dependencies: ["proj-research"], resourceIds: ["r2"] }),
    task("proj-content", "Content writing", -3, 8, { progress: 40, dependencies: ["proj-research"] }),
    // The plan said 4 days from today: the baseline shows the slip.
    task("proj-design", "Visual design", 1, 5, {
      progress: 10,
      dependencies: ["proj-wireframes"],
      baselineStart: at(0),
      baselineEnd: at(4),
    }),
    task("proj-build", "Front-end build", 6, 10, { dependencies: ["proj-design"], resourceIds: ["r1"] }),
    task("proj-qa", "QA & fixes", 16, 4, { dependencies: ["proj-build", "proj-content"] }),
    { ...task("proj-live", "Go live", 21, 0, { dependencies: [{ id: "proj-qa", lag: 24 * 60 }] }), type: "milestone", progress: undefined },
  ];
}
