/**
 * Demo events, always RELATIVE TO TODAY: whatever day someone opens the
 * demo, today is busy, the weeks around it are populated, and the months
 * before and after are never empty.
 *
 * Deterministic (seeded per day offset), so a reload shows the same
 * calendar — only "today" moves. Events carry a category, a location and
 * attendees: the demo's custom event content renders them.
 */

export interface DemoResource {
  id: string;
  name: string;
  type: string;
}

export const resources: DemoResource[] = [
  { id: "r1", name: "Atlas room", type: "room" },
  { id: "r2", name: "John Silva", type: "person" },
  { id: "r3", name: "Projector", type: "equipment" },
  { id: "r4", name: "Company-wide", type: "group" },
];

export type CategoryId = "meeting" | "focus" | "client" | "personal" | "travel" | "release";

export const categories: { id: CategoryId; label: string; color: string }[] = [
  { id: "meeting", label: "Meetings", color: "#6366f1" },
  { id: "client", label: "Clients", color: "#0ea5e9" },
  { id: "focus", label: "Deep work", color: "#14b8a6" },
  { id: "release", label: "Releases", color: "#22c55e" },
  { id: "personal", label: "Personal", color: "#f43f5e" },
  { id: "travel", label: "Travel & time off", color: "#f59e0b" },
];

export const categoryColor = (id?: string) =>
  categories.find((c) => c.id === id)?.color ?? "#6366f1";

const people = ["Ana Costa", "John Silva", "Maya Chen", "Rui Lopes", "Sara Kim", "Leo Martins", "Ivy Brown"];

const DAY_RANGE = 75; // days before and after today

type Template = {
  title: string;
  minutes: number;
  category: CategoryId;
  resources: string[];
  location?: string;
  attendees?: number;
};

const workTemplates: Template[] = [
  { title: "Client call — Acme", minutes: 45, category: "client", resources: ["r1"], location: "Zoom", attendees: 3 },
  { title: "Design review", minutes: 60, category: "meeting", resources: ["r1", "r3"], location: "Atlas room", attendees: 4 },
  { title: "1:1 with John", minutes: 30, category: "meeting", resources: ["r2"], location: "Café corner", attendees: 2 },
  { title: "Sprint planning", minutes: 90, category: "meeting", resources: ["r1"], location: "Atlas room", attendees: 6 },
  { title: "Deep work: API v3", minutes: 120, category: "focus", resources: [] },
  { title: "Product demo", minutes: 60, category: "client", resources: ["r1", "r3"], location: "Atlas room", attendees: 5 },
  { title: "Interview — Frontend", minutes: 60, category: "meeting", resources: ["r2"], location: "Google Meet", attendees: 3 },
  { title: "Budget review", minutes: 30, category: "meeting", resources: [], location: "Finance", attendees: 3 },
  { title: "Customer workshop", minutes: 120, category: "client", resources: ["r1", "r3"], location: "Lisbon HQ", attendees: 7 },
  { title: "Code review", minutes: 45, category: "focus", resources: [] },
];

const personalTemplates: Template[] = [
  { title: "Gym", minutes: 60, category: "personal", resources: [], location: "FitLab" },
  { title: "Brunch with friends", minutes: 90, category: "personal", resources: [], location: "Time Out Market", attendees: 4 },
  { title: "Football match", minutes: 120, category: "personal", resources: [], location: "Stadium" },
  { title: "Groceries", minutes: 45, category: "personal", resources: [] },
];

/** Small deterministic PRNG (mulberry32). */
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function createDemoEvents(now: Date = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const byId = (ids: string[]) => resources.filter((r) => ids.includes(r.id));

  /** Local date `offset` days from today at h:m. */
  const at = (offset: number, h = 0, m = 0) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, h, m);

  const attendeesFor = (count = 0, seed = 0) =>
    Array.from({ length: count }, (_, i) => people[(((seed + i * 3) % people.length) + people.length) % people.length]);

  const events: any[] = [];
  const timed = (id: string, offset: number, h: number, m: number, t: Template, seed = 0) => {
    const start = at(offset, h, m);
    events.push({
      id,
      title: t.title,
      start: start.toISOString(),
      end: new Date(start.getTime() + t.minutes * 60000).toISOString(),
      category: t.category,
      color: categoryColor(t.category),
      location: t.location,
      attendees: attendeesFor(t.attendees, seed),
      resources: byId(t.resources),
    });
  };
  const allDay = (id: string, offset: number, days: number, title: string, category: CategoryId, location?: string) =>
    events.push({
      id,
      title,
      start: at(offset).toISOString(),
      end: at(offset + days).toISOString(), // exclusive end
      allDay: true,
      category,
      color: categoryColor(category),
      location,
      attendees: [],
      resources: byId(["r4"]),
    });

  // --- Today: a full, realistic day (with overlaps for the column layout) --
  timed("demo-today-1", 0, 10, 0, workTemplates[0], 1);
  timed("demo-today-2", 0, 10, 30, workTemplates[1], 2);
  timed("demo-today-3", 0, 13, 0, { title: "Lunch with Rui", minutes: 60, category: "personal", resources: [], location: "Taberna", attendees: 2 }, 3);
  timed("demo-today-4", 0, 15, 0, { title: "Deep work: roadmap", minutes: 120, category: "focus", resources: [] });
  // Something coming up soon, whatever the hour the demo is opened.
  const soon = new Date(now.getTime() + 60 * 60000);
  const soonStart = new Date(soon.getFullYear(), soon.getMonth(), soon.getDate(), soon.getHours(), 0);
  events.push({
    id: "demo-today-soon",
    title: "Investor update",
    start: soonStart.toISOString(),
    end: new Date(soonStart.getTime() + 45 * 60000).toISOString(),
    category: "client",
    color: categoryColor("client"),
    location: "Boardroom",
    attendees: attendeesFor(4, 5),
    resources: byId(["r1", "r3"]),
  });

  // --- Every other day in ±DAY_RANGE: denser near today -------------------
  for (let offset = -DAY_RANGE; offset <= DAY_RANGE; offset++) {
    if (offset === 0) continue;
    const random = rng(offset + 1000);
    const weekday = at(offset).getDay();
    const weekend = weekday === 0 || weekday === 6;
    const near = Math.abs(offset) <= 14;
    const count = weekend
      ? random() < 0.3 ? 1 : 0
      : near
        ? 1 + Math.floor(random() * 3)
        : random() < 0.6 ? 1 + Math.floor(random() * 2) : 0;
    const hours = weekend ? [10, 11, 16, 18] : [9, 10, 11, 13, 14, 15, 16];
    const pool = weekend ? personalTemplates : workTemplates;
    const used = new Set<number>();
    for (let i = 0; i < count; i++) {
      let hour = hours[Math.floor(random() * hours.length)];
      while (used.has(hour)) hour = hours[(hours.indexOf(hour) + 1) % hours.length];
      used.add(hour);
      const minute = random() < 0.5 ? 0 : 30;
      timed(`demo-${offset}-${i}`, offset, hour, minute, pool[Math.floor(random() * pool.length)], offset + i);
    }
  }

  // --- Multi-day all-day events --------------------------------------------
  allDay("demo-conference", 8, 3, "React Summit", "travel", "Amsterdam");
  allDay("demo-vacation", -24, 5, "Vacation", "travel", "Algarve");
  allDay("demo-offsite", 40, 2, "Team offsite", "travel", "Sintra");
  allDay("demo-holiday", -45, 1, "Public holiday", "personal");
  allDay("demo-release", 3, 1, "v2.1 release", "release");

  // --- Recurring events (expanded by the calendar, with an exception) -----
  const standupStart = at(-120, 9, 0);
  // The most recent weekday before today: its standup is "cancelled".
  let cancelledOffset = -1;
  while ([0, 6].includes(at(cancelledOffset).getDay())) cancelledOffset--;
  const cancelled = at(cancelledOffset, 9, 0);
  events.push({
    id: "demo-standup",
    title: "Team standup",
    start: standupStart.toISOString(),
    end: new Date(standupStart.getTime() + 15 * 60000).toISOString(),
    category: "meeting",
    color: categoryColor("meeting"),
    location: "Atlas room",
    attendees: attendeesFor(5, 0),
    recurrence: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;COUNT=170",
    // One cancelled occurrence, to show exdate.
    exdate: [cancelled.toISOString()],
    resources: byId(["r1"]),
  });
  const reviewStart = at(-90, 16, 0);
  events.push({
    id: "demo-monthly-review",
    title: "Monthly business review",
    start: reviewStart.toISOString(),
    end: new Date(reviewStart.getTime() + 60 * 60000).toISOString(),
    category: "client",
    color: categoryColor("client"),
    location: "Boardroom",
    attendees: attendeesFor(6, 2),
    recurrence: "FREQ=MONTHLY;BYSETPOS=1;BYDAY=MO;COUNT=8",
    resources: byId(["r1", "r2"]),
  });

  return events;
}
