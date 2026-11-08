/*
 * Which events reach the views: user events, data-source events, and the
 * plugin filter/search (onFilterChange / onSearch), which only apply while
 * active and survive `events` updates.
 */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Calendar } from "../index";
import type { EventProps } from "../types/types";
import type { CalendarPlugin } from "../types/plugins";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
});

const ev = (id: string, h: number): EventProps => ({
  id,
  title: id,
  start: `2026-03-11T${String(h).padStart(2, "0")}:00:00.000Z`,
  end: `2026-03-11T${String(h + 1).padStart(2, "0")}:00:00.000Z`,
});

const Titles = ({ events }: { events: EventProps[] }) => (
  <span data-testid="titles">{events.map((e) => e.title).sort().join(",")}</span>
);
const titlesView = { key: "v", type: "view", viewName: "titles", component: Titles } as CalendarPlugin;

/** Header filter + search plugin: buttons call onFilterChange/onSearch. */
const Controls = ({
  events = [],
  onFilterChange,
  onSearch,
}: {
  events?: EventProps[];
  onFilterChange?: (e: EventProps[]) => void;
  onSearch?: (term: string, results: EventProps[]) => void;
}) => (
  <div>
    <button onClick={() => onFilterChange?.(events.filter((e) => e.id !== "b"))}>hide-b</button>
    <button onClick={() => onFilterChange?.(events)}>clear-filter</button>
    <button onClick={() => onSearch?.("a", events.filter((e) => e.id === "a"))}>search-a</button>
    <button onClick={() => onSearch?.("", events)}>clear-search</button>
  </div>
);
const controls = { key: "c", type: "filter", location: "left", component: Controls } as CalendarPlugin;

const MARCH_11 = new Date("2026-03-11T12:00:00Z");
const config = { timeZone: "UTC", defaultView: "titles" as never };
const titles = () => screen.getByTestId("titles").textContent;
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

it("data-source events reach the views", async () => {
  const google = {
    key: "ds",
    type: "data-source",
    fetchEvents: async () => [ev("google", 14)],
  } as CalendarPlugin;
  render(<Calendar events={[ev("a", 10)]} currentDate={MARCH_11} plugins={[titlesView, google]} config={config} />);
  await flush();
  expect(titles()).toBe("a,google");
});

it("a plugin filter applies, and survives the host updating `events`", async () => {
  const tree = (events: EventProps[]) => (
    <Calendar events={events} currentDate={MARCH_11} plugins={[titlesView, controls]} config={config} />
  );
  const { rerender } = render(tree([ev("a", 10), ev("b", 11)]));
  fireEvent.click(await screen.findByText("hide-b"));
  expect(titles()).toBe("a");
  // The host saves a move: the filter must not silently disappear.
  rerender(tree([ev("a", 9), ev("b", 11)]));
  expect(titles()).toBe("a");
});

it("a filter that keeps everything is off, so later events are not hidden", async () => {
  let resolve!: (e: EventProps[]) => void;
  const late = {
    key: "ds",
    type: "data-source",
    fetchEvents: () => new Promise<EventProps[]>((r) => (resolve = r)),
  } as CalendarPlugin;
  render(<Calendar events={[ev("a", 10), ev("b", 11)]} currentDate={MARCH_11} plugins={[titlesView, controls, late]} config={config} />);
  fireEvent.click(await screen.findByText("hide-b"));
  fireEvent.click(screen.getByText("clear-filter"));
  await act(async () => resolve([ev("google", 14)]));
  expect(titles()).toBe("a,b,google");
});

it("search narrows while it has a term, and clears with an empty one", async () => {
  render(<Calendar events={[ev("a", 10), ev("b", 11)]} currentDate={MARCH_11} plugins={[titlesView, controls]} config={config} />);
  fireEvent.click(await screen.findByText("search-a"));
  expect(titles()).toBe("a");
  fireEvent.click(screen.getByText("clear-search"));
  expect(titles()).toBe("a,b");
});
