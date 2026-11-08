import { dependenciesOf, ms, taskType, type DependencyType, type Task } from "./model";

/*
 * The scheduling engine (pure): dependency constraints, pushing successors
 * when a task moves, summary spans, the critical path. Time is continuous
 * (no working calendar yet).
 */

const MINUTE = 60_000;
const key = (id: string | number) => String(id);

/**
 * The earliest start of `task` that satisfies one dependency on `pred`:
 * FS start ≥ pred.end, SS start ≥ pred.start, FF end ≥ pred.end,
 * SF end ≥ pred.start — each plus the lag.
 */
export const earliestStartFor = (task: Task, pred: Task, type: DependencyType, lagMinutes: number): number => {
  const lag = lagMinutes * MINUTE;
  const duration = ms(task.end) - ms(task.start);
  switch (type) {
    case "SS":
      return ms(pred.start) + lag;
    case "FF":
      return ms(pred.end) + lag - duration;
    case "SF":
      return ms(pred.start) + lag - duration;
    default:
      return ms(pred.end) + lag;
  }
};

export interface Graph {
  byId: Map<string, Task>;
  /** Successor ids of each task. */
  successors: Map<string, string[]>;
  /** Children ids of each summary. */
  children: Map<string, string[]>;
  /** Topological order (predecessors first); null when there is a cycle. */
  order: string[] | null;
}

export function buildGraph(tasks: Task[]): Graph {
  const byId = new Map(tasks.map((t) => [key(t.id), t]));
  const successors = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  const indegree = new Map<string, number>([...byId.keys()].map((id) => [id, 0]));
  for (const task of tasks) {
    if (task.parentId !== undefined && byId.has(key(task.parentId))) {
      const list = children.get(key(task.parentId)) ?? [];
      list.push(key(task.id));
      children.set(key(task.parentId), list);
    }
    for (const dep of dependenciesOf(task)) {
      if (!byId.has(key(dep.id))) continue;
      const list = successors.get(key(dep.id)) ?? [];
      list.push(key(task.id));
      successors.set(key(dep.id), list);
      indegree.set(key(task.id), (indegree.get(key(task.id)) ?? 0) + 1);
    }
  }
  const queue = [...indegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of successors.get(id) ?? []) {
      indegree.set(s, indegree.get(s)! - 1);
      if (indegree.get(s) === 0) queue.push(s);
    }
  }
  return { byId, successors, children, order: order.length === byId.size ? order : null };
}

const shift = (task: Task, delta: number): Task => ({
  ...task,
  start: new Date(ms(task.start) + delta).toISOString(),
  end: new Date(ms(task.end) + delta).toISOString(),
});

/**
 * The tasks that move when `changed` gets its new start/end:
 * - a summary's descendants move by the same amount;
 * - successors start no earlier than their dependencies allow (pushed
 *   forward only, never pulled back);
 * - summaries are stretched or shrunk to span their children.
 * Returns the moved tasks (not `changed` itself). With a dependency cycle,
 * nothing is pushed.
 */
export function cascadeChange(tasks: Task[], changed: Task): Task[] {
  const graph = buildGraph(tasks.map((t) => (key(t.id) === key(changed.id) ? changed : t)));
  const current = new Map(graph.byId);
  const moved = new Set<string>();
  const set = (task: Task) => {
    current.set(key(task.id), task);
    if (key(task.id) !== key(changed.id)) moved.add(key(task.id));
  };

  // 1. A moved summary carries its descendants.
  const before = tasks.find((t) => key(t.id) === key(changed.id));
  if (before && taskType(changed) === "summary") {
    const delta = ms(changed.start) - ms(before.start);
    const stack = [...(graph.children.get(key(changed.id)) ?? [])];
    while (delta && stack.length) {
      const id = stack.pop()!;
      set(shift(current.get(id)!, delta));
      stack.push(...(graph.children.get(id) ?? []));
    }
  }

  // 2. Push successors forward, in dependency order.
  if (graph.order) {
    for (const id of graph.order) {
      const task = current.get(id)!;
      if (taskType(task) === "summary") continue;
      let earliest = -Infinity;
      for (const dep of dependenciesOf(task)) {
        const pred = current.get(key(dep.id));
        if (pred) earliest = Math.max(earliest, earliestStartFor(task, pred, dep.type, dep.lag));
      }
      if (ms(task.start) < earliest && id !== key(changed.id)) set(shift(task, earliest - ms(task.start)));
    }
  }

  // 3. Summaries span their children (deepest first).
  const depth = (id: string): number => {
    const parent = current.get(id)?.parentId;
    return parent !== undefined && current.has(key(parent)) ? 1 + depth(key(parent)) : 0;
  };
  const summaries = [...graph.children.keys()].sort((a, b) => depth(b) - depth(a));
  for (const id of summaries) {
    const kids = graph.children.get(id)!.map((c) => current.get(c)!);
    const start = Math.min(...kids.map((k) => ms(k.start)));
    const end = Math.max(...kids.map((k) => ms(k.end)));
    const summary = current.get(id)!;
    if (ms(summary.start) !== start || ms(summary.end) !== end) {
      set({ ...summary, start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    }
  }

  return [...moved].map((id) => current.get(id)!);
}

/**
 * Tasks with no slack: delaying any of them delays the end of the project.
 * Forward from the current dates, backward from the project's end, over the
 * dependencies. Summaries are left out. Empty with a cycle.
 */
export function criticalPath(tasks: Task[], toleranceMinutes = 1): Set<string> {
  const leaves = tasks.filter((t) => taskType(t) !== "summary");
  const graph = buildGraph(leaves);
  if (!graph.order || !leaves.length) return new Set();
  const projectEnd = Math.max(...leaves.map((t) => ms(t.end)));
  // Latest start of each task without moving the project's end.
  const latestStart = new Map<string, number>();
  for (const id of [...graph.order].reverse()) {
    const task = graph.byId.get(id)!;
    const duration = ms(task.end) - ms(task.start);
    let latestFinish = projectEnd;
    for (const succId of graph.successors.get(id) ?? []) {
      const succ = graph.byId.get(succId)!;
      const succLatest = latestStart.get(succId)!;
      const succDuration = ms(succ.end) - ms(succ.start);
      for (const dep of dependenciesOf(succ).filter((d) => key(d.id) === id)) {
        const lag = dep.lag * MINUTE;
        // The latest this task may finish (or start) so the successor keeps its latest start.
        const bound =
          dep.type === "SS"
            ? succLatest - lag + duration
            : dep.type === "FF"
              ? succLatest + succDuration - lag
              : dep.type === "SF"
                ? succLatest + succDuration - lag + duration
                : succLatest - lag;
        latestFinish = Math.min(latestFinish, bound);
      }
    }
    latestStart.set(id, latestFinish - duration);
  }
  const critical = new Set<string>();
  for (const [id, latest] of latestStart) {
    if (latest - ms(graph.byId.get(id)!.start) <= toleranceMinutes * MINUTE) critical.add(id);
  }
  return critical;
}

/**
 * The progress of each summary: its leaf tasks' progress weighted by their
 * length (milestones don't count). Tasks keep their own progress.
 */
export function rollupProgress(tasks: Task[]): Map<string, number> {
  const { byId, children } = buildGraph(tasks);
  const result = new Map<string, number>();
  const leaves = (id: string, seen = new Set<string>()): Task[] => {
    if (seen.has(id)) return [];
    seen.add(id);
    const kids = children.get(id);
    if (!kids?.length) return [byId.get(id)!];
    return kids.flatMap((k) => leaves(k, seen));
  };
  for (const task of tasks) {
    const id = key(task.id);
    if (taskType(task) !== "summary" || !children.get(id)?.length) {
      result.set(id, task.progress ?? 0);
      continue;
    }
    let done = 0;
    let total = 0;
    for (const leaf of leaves(id)) {
      if (taskType(leaf) === "milestone") continue;
      const length = Math.max(0, ms(leaf.end) - ms(leaf.start));
      done += (length * (leaf.progress ?? 0)) / 100;
      total += length;
    }
    result.set(id, total ? (done / total) * 100 : 0);
  }
  return result;
}
