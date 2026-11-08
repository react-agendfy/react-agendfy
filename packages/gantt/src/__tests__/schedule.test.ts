import { buildGraph, cascadeChange, criticalPath, earliestStartFor, rollupProgress } from "../schedule";
import { isTask, type Task } from "../model";

const day = (d: number, h = 9) => new Date(Date.UTC(2026, 2, d, h)).toISOString();
const task = (id: string, from: number, to: number, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  start: day(from),
  end: day(to),
  type: "task",
  ...extra,
});

describe("isTask", () => {
  it("events with a task type or task fields", () => {
    expect(isTask({ id: "a", title: "", start: day(1), end: day(2), type: "milestone" })).toBe(true);
    expect(isTask({ id: "a", title: "", start: day(1), end: day(2), progress: 0 })).toBe(true);
    expect(isTask({ id: "a", title: "", start: day(1), end: day(2), dependencies: ["b"] })).toBe(true);
    expect(isTask({ id: "a", title: "", start: day(1), end: day(2) })).toBe(false);
  });
});

describe("earliestStartFor", () => {
  const pred = task("p", 1, 3);
  const t = task("t", 1, 2); // 1 day long
  it("FS, SS, FF, SF with lag (minutes)", () => {
    expect(earliestStartFor(t, pred, "FS", 0)).toBe(Date.parse(day(3)));
    expect(earliestStartFor(t, pred, "FS", 60)).toBe(Date.parse(day(3, 10)));
    expect(earliestStartFor(t, pred, "SS", 0)).toBe(Date.parse(day(1)));
    expect(earliestStartFor(t, pred, "FF", 0)).toBe(Date.parse(day(2)));
    expect(earliestStartFor(t, pred, "SF", 0)).toBe(Date.parse(day(0)));
  });
});

describe("cascadeChange", () => {
  const plan = () => [
    task("a", 1, 3),
    task("b", 3, 5, { dependencies: ["a"] }),
    task("c", 6, 7, { dependencies: [{ id: "b", type: "FS", lag: 24 * 60 }] }),
    task("d", 10, 11, { dependencies: ["a"] }),
  ];

  it("pushes successors forward, transitively, keeping their durations", () => {
    const moved = cascadeChange(plan(), task("a", 2, 4));
    expect(moved.map((t) => [t.id, t.start, t.end])).toEqual([
      ["b", day(4), day(6)],
      ["c", day(7), day(8)],
    ]);
  });

  it("never pulls successors back; d had room to spare", () => {
    expect(cascadeChange(plan(), task("a", 0, 2))).toEqual([]);
  });

  it("a summary carries its children and spans them", () => {
    const tasks = [
      task("s", 1, 6, { type: "summary" }),
      task("x", 1, 3, { parentId: "s" }),
      task("y", 3, 6, { parentId: "s", dependencies: ["x"] }),
      task("z", 6, 7, { dependencies: ["s"] }),
    ];
    const moved = cascadeChange(tasks, task("s", 3, 8, { type: "summary" }));
    const byId = Object.fromEntries(moved.map((t) => [t.id, [t.start, t.end]]));
    expect(byId.x).toEqual([day(3), day(5)]);
    expect(byId.y).toEqual([day(5), day(8)]);
    expect(byId.z).toEqual([day(8), day(9)]);
  });

  it("a child that grows stretches its summary", () => {
    const tasks = [task("s", 1, 5, { type: "summary" }), task("x", 1, 3, { parentId: "s" }), task("y", 3, 5, { parentId: "s" })];
    expect(cascadeChange(tasks, task("y", 3, 7, { parentId: "s" }))).toEqual([
      expect.objectContaining({ id: "s", start: day(1), end: day(7) }),
    ]);
  });

  it("a dependency cycle pushes nothing", () => {
    const cyclic = [task("a", 1, 2, { dependencies: ["b"] }), task("b", 2, 3, { dependencies: ["a"] })];
    expect(buildGraph(cyclic).order).toBeNull();
    expect(cascadeChange(cyclic, task("a", 5, 6, { dependencies: ["b"] }))).toEqual([]);
  });
});

describe("criticalPath", () => {
  it("the chain that sets the project's end; tasks with slack are not on it", () => {
    const tasks = [
      task("a", 1, 3),
      task("b", 3, 6, { dependencies: ["a"] }),
      task("c", 3, 4, { dependencies: ["a"] }), // 2 days of slack before the end (6)
      task("s", 1, 6, { type: "summary" }),
    ];
    expect([...criticalPath(tasks)].sort()).toEqual(["a", "b"]);
  });

  it("respects lags", () => {
    const tasks = [task("a", 1, 2), task("b", 3, 4, { dependencies: [{ id: "a", lag: 24 * 60 }] })];
    expect([...criticalPath(tasks)].sort()).toEqual(["a", "b"]);
  });
});

describe("rollupProgress", () => {
  it("weights the leaves of a summary by their length; milestones don't count", () => {
    const tasks = [
      task("p", 1, 10, { type: "summary" }),
      task("a", 1, 3, { parentId: "p", progress: 100 }),
      task("q", 3, 10, { parentId: "p", type: "summary" }),
      task("b", 3, 9, { parentId: "q", progress: 50 }),
      task("m", 9, 9, { parentId: "q", type: "milestone" }),
    ];
    const r = rollupProgress(tasks);
    expect(r.get("q")).toBe(50);
    // a: 2 days at 100%, b: 6 days at 50% → 5 of 8 days.
    expect(r.get("p")).toBeCloseTo(62.5);
    expect(r.get("a")).toBe(100);
  });
});
