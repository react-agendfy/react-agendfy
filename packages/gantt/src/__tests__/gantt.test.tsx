/*
 * The gantt view and its scheduling through the real <Calendar> (jsdom: no
 * layout, so every row and day is rendered).
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Calendar, type CalendarApi, type EventProps } from "@react-agendfy/core";
import ganttPlugins, { Gantt, type GanttApi, type GanttProps, type Task } from "../index";

type DndProps = { onDragEnd?: (e: unknown) => void };
const dnd: DndProps[] = [];
jest.mock("@dnd-kit/core", () => {
  const actual = jest.requireActual("@dnd-kit/core");
  return {
    ...actual,
    DndContext: (props: DndProps & { children: React.ReactNode }) => {
      dnd.push(props);
      return <>{props.children}</>;
    },
    DragOverlay: () => null,
  };
});

beforeAll(() => {
  (global as unknown as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
});

const day = (d: number) => `2026-03-${String(d).padStart(2, "0")}T00:00:00.000Z`;
const tasks: EventProps[] = [
  { id: "p", title: "Launch", type: "summary", start: day(2), end: day(12), allDay: true },
  { id: "a", title: "Design", parentId: "p", start: day(2), end: day(5), allDay: true, progress: 100 },
  { id: "b", title: "Build", parentId: "p", start: day(5), end: day(10), allDay: true, progress: 40, dependencies: ["a"] },
  { id: "c", title: "Docs", parentId: "p", start: day(5), end: day(7), allDay: true, dependencies: ["a"] },
  { id: "m", title: "Go live", type: "milestone", parentId: "p", start: day(10), end: day(10), allDay: true, dependencies: ["b", "c"] },
  { id: "x", title: "Dentist", start: "2026-03-11T10:00:00.000Z", end: "2026-03-11T11:00:00.000Z" },
];

const renderGantt = (props: Partial<React.ComponentProps<typeof Calendar>> = {}) => {
  const apiRef = React.createRef<CalendarApi>();
  const onEventUpdate = jest.fn();
  const utils = render(
    <Calendar
      events={tasks}
      currentDate={new Date(day(11))}
      apiRef={apiRef}
      plugins={ganttPlugins}
      onEventUpdate={onEventUpdate}
      {...props}
      config={{ timeZone: "UTC", defaultView: "gantt" as never, ...props.config }}
    />
  );
  return { ...utils, apiRef, onEventUpdate };
};

const titles = (container: HTMLElement) =>
  [...container.querySelectorAll(".agendfy-gantt-title")].map((e) => e.textContent);
const bar = (container: HTMLElement, id: string) => container.querySelector<HTMLElement>(`.agendfy-gantt-bar[data-event-id="${id}"]`)!;

it("lists only tasks, as a tree, with their columns", async () => {
  const { container } = renderGantt();
  await screen.findByRole("grid", { name: /Gantt chart/ });
  expect(titles(container)).toEqual(["Launch", "Design", "Build", "Docs", "Go live"]);
  const build = [...container.querySelectorAll(".agendfy-gantt-row")][2];
  expect([...build.querySelectorAll(".agendfy-gantt-cell")].map((c) => c.textContent)).toEqual(["Build", "5 Mar", "9 Mar", "5 d", "40%"]);
  const live = [...container.querySelectorAll(".agendfy-gantt-row")][4];
  expect([...live.querySelectorAll(".agendfy-gantt-cell")].map((c) => c.textContent)).toEqual(["Go live", "10 Mar", "10 Mar", "—", "—"]);
  expect(bar(container, "m")).toHaveClass("agendfy-gantt-bar--milestone");
  expect(bar(container, "p")).toHaveClass("agendfy-gantt-bar--summary");
  // Summary progress rolls up: 3 d at 100% + 5 d at 40% + 2 d at 0% → 50%.
  const launch = [...container.querySelectorAll(".agendfy-gantt-row")][0];
  expect(launch.querySelector(".agendfy-gantt-col--progress")!.textContent).toBe("50%");
});

it("collapsing a summary hides its children", async () => {
  const { container } = renderGantt();
  fireEvent.click(await screen.findByRole("button", { name: "Collapse Launch" }));
  expect(titles(container)).toEqual(["Launch"]);
  fireEvent.click(screen.getByRole("button", { name: "Expand Launch" }));
  expect(titles(container)).toHaveLength(5);
});

it("highlights the critical path and draws the dependencies", async () => {
  const { container } = renderGantt();
  await screen.findByRole("grid");
  const critical = [...container.querySelectorAll(".agendfy-gantt-bar--critical")].map((b) => b.getAttribute("data-event-id"));
  expect(critical.sort()).toEqual(["a", "b", "m"]);
  expect(container.querySelectorAll(".agendfy-gantt-link")).toHaveLength(4);
  expect(container.querySelectorAll(".agendfy-gantt-link--critical")).toHaveLength(2);
});

it("translates the view", async () => {
  renderGantt({ config: { lang: "pt", defaultView: "gantt" as never, timeZone: "UTC" } });
  expect(await screen.findByRole("columnheader", { name: "Tarefa" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Gantt" })).toBeInTheDocument();
});

it("moving a task pushes its successors as one change; undo restores all", async () => {
  dnd.length = 0;
  const { container, apiRef, onEventUpdate } = renderGantt();
  await screen.findByRole("grid");
  // Drag Design (2–5 Mar) two days later, grabbed on its first day.
  act(() =>
    dnd[dnd.length - 1].onDragEnd?.({
      active: { id: "a", data: { current: { event: tasks[1], anchor: () => 0 } } },
      over: { id: "zone", data: { current: { zone: { date: new Date(day(4)), allDay: true } } } },
      delta: { x: 80, y: 0 },
    })
  );
  const moved = Object.fromEntries(onEventUpdate.mock.calls.map(([e]) => [e.id, [e.start, e.end]]));
  expect(moved.a).toEqual([day(4), day(7)]);
  expect(moved.b).toEqual([day(7), day(12)]);
  expect(moved.c).toEqual([day(7), day(9)]);
  expect(moved.m).toEqual([day(12), day(12)]);
  expect(moved.p).toEqual([day(4), day(12)]);
  expect(moved.x).toBeUndefined();
  expect(bar(container, "b").getAttribute("aria-label")).toMatch(/7 Mar – 11 Mar/);

  act(() => apiRef.current!.undo());
  expect(bar(container, "b").getAttribute("aria-label")).toMatch(/5 Mar – 9 Mar/);
  expect(bar(container, "a").getAttribute("aria-label")).toMatch(/2 Mar – 4 Mar/);
});

it("the grab point counts in whole days", async () => {
  dnd.length = 0;
  const { onEventUpdate } = renderGantt();
  await screen.findByRole("grid");
  // Build grabbed on its third day, dropped on 10 Mar: starts 8 Mar.
  act(() =>
    dnd[dnd.length - 1].onDragEnd?.({
      active: { id: "b", data: { current: { event: tasks[2], anchor: () => 2 * 86_400_000 } } },
      over: { id: "zone", data: { current: { zone: { date: new Date(day(10)), allDay: true } } } },
      delta: { x: 80, y: 0 },
    })
  );
  const b = onEventUpdate.mock.calls.find(([e]) => e.id === "b")![0];
  expect([b.start, b.end]).toEqual([day(8), day(13)]);
});

describe("<Gantt> on its own", () => {
  // Plain tasks: no allDay (the standalone Gantt assumes whole days).
  const plain = tasks.filter((t) => t.id !== "x").map(({ allDay: _allDay, ...t }) => t) as Task[];
  const renderStandalone = (props: Partial<GanttProps> = {}) => {
    dnd.length = 0;
    const apiRef = React.createRef<GanttApi>();
    const onTaskChange = jest.fn();
    const utils = render(
      <Gantt tasks={plain} date={day(11)} timeZone="UTC" apiRef={apiRef} onTaskChange={onTaskChange} {...props} />
    );
    return { ...utils, apiRef, onTaskChange };
  };
  const dragDesignTo = (d: number) =>
    act(() =>
      dnd[dnd.length - 1].onDragEnd?.({
        active: { id: "a", data: { current: { event: { ...plain[1], allDay: true }, anchor: () => 0 } } },
        over: { id: "zone", data: { current: { zone: { date: new Date(day(d)), allDay: true } } } },
        delta: { x: 80, y: 0 },
      })
    );

  it("has its own toolbar: period, navigation and zoom — no calendar views or export", async () => {
    const onZoomChange = jest.fn();
    renderStandalone({ onZoomChange });
    expect(await screen.findByRole("heading", { name: "March 2026" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Month" })).toBeInTheDocument(); // the zoom
    expect(screen.queryByRole("button", { name: "Gantt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: /Export/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Quarter" }));
    expect(onZoomChange).toHaveBeenLastCalledWith("quarter");
    expect(await screen.findByRole("heading", { name: "Mar – May 2026" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("heading", { name: "Apr – Jun 2026" })).toBeInTheDocument();
  });

  it("workingDays: the other days are shaded", async () => {
    const { container, unmount } = renderStandalone();
    await screen.findByRole("grid");
    expect(container.querySelectorAll(".agendfy-gantt-day--off").length).toBeGreaterThan(0); // weekends
    unmount();
    const all = renderStandalone({ workingDays: [0, 1, 2, 3, 4, 5, 6] });
    await screen.findByRole("grid");
    expect(all.container.querySelectorAll(".agendfy-gantt-day--off")).toHaveLength(0);
  });

  it("onTaskChange: one call with the task and the tasks it pushed, in the tasks' shape", async () => {
    const { onTaskChange } = renderStandalone();
    await screen.findByRole("grid");
    dragDesignTo(4);
    expect(onTaskChange).toHaveBeenCalledTimes(1);
    const [task, moved] = onTaskChange.mock.calls[0];
    expect([task.id, task.start, task.end]).toEqual(["a", day(4), day(7)]);
    expect(task).not.toHaveProperty("allDay");
    expect(moved.map((t: Task) => t.id).sort()).toEqual(["b", "c", "m", "p"]);
  });

  it("undo reports the reverted batch; a rejected promise reverts all", async () => {
    const { container, apiRef, onTaskChange } = renderStandalone();
    await screen.findByRole("grid");
    dragDesignTo(4);
    act(() => apiRef.current!.undo());
    expect(onTaskChange).toHaveBeenCalledTimes(2);
    expect(onTaskChange.mock.calls[1][0].start).toBe(day(2));
    expect(onTaskChange.mock.calls[1][1]).toHaveLength(4);

    onTaskChange.mockImplementation(() => Promise.reject(new Error("offline")));
    dragDesignTo(4);
    expect(bar(container, "b").getAttribute("aria-label")).toMatch(/7 Mar/);
    await act(async () => {});
    expect(bar(container, "b").getAttribute("aria-label")).toMatch(/5 Mar – 9 Mar/);
    expect(bar(container, "a").getAttribute("aria-label")).toMatch(/2 Mar – 4 Mar/);
  });

  it("onTaskClick gets the task; readOnly disables changes", async () => {
    const onTaskClick = jest.fn();
    const { container, onTaskChange } = renderStandalone({ onTaskClick, readOnly: true });
    await screen.findByRole("grid");
    fireEvent.click(bar(container, "b"));
    expect(onTaskClick.mock.calls[0][0]).toMatchObject({ id: "b", title: "Build" });
    expect(onTaskClick.mock.calls[0][0]).not.toHaveProperty("allDay");
    expect(container.querySelector(".agendfy-gantt-resize")).toBeNull();
    dragDesignTo(4);
    expect(onTaskChange).not.toHaveBeenCalled();
  });
});
