import { createGridDragSnap } from "./gridDragSnap";

const SLOT = 40;
const COLUMN = 150;

const setup = () => {
  const scroller = document.createElement("div");
  scroller.style.overflow = "auto";
  const grid = document.createElement("div");
  scroller.appendChild(grid);
  document.body.appendChild(scroller);
  return { scroller, grid };
};

const move = (snap: ReturnType<typeof createGridDragSnap>, x: number, y: number) =>
  snap.modifier({ transform: { x, y, scaleX: 1, scaleY: 1 } } as any);

describe("createGridDragSnap", () => {
  afterEach(() => (document.body.innerHTML = ""));

  it("snaps the preview to whole slots and reports the same offset", () => {
    const { grid } = setup();
    const snap = createGridDragSnap();
    snap.begin(grid, SLOT, COLUMN);
    expect(move(snap, 10, 95)).toMatchObject({ x: 0, y: 80 });
    expect(snap.result()).toEqual({ slots: 2, columns: 0 });
  });

  it("accounts for the grid scrolling under the pointer (the 1-hour drift)", () => {
    // Pointer moved 100px while the container scrolled 300px: the preview is
    // 400px down the GRID (10 slots), not round(100/40) = 3 slots.
    const { scroller, grid } = setup();
    const snap = createGridDragSnap();
    snap.begin(grid, SLOT, COLUMN);
    scroller.scrollTop = 300;
    const t = move(snap, 0, 100);
    expect(snap.result()).toEqual({ slots: 10, columns: 0 });
    // Back in viewport space the preview sits on a grid line.
    expect((t.y + 300) % SLOT).toBe(0);
  });

  it("keeps the preview inside the grid bounds", () => {
    const { grid } = setup();
    const snap = createGridDragSnap();
    snap.begin(grid, SLOT, COLUMN, { minSlots: -2, maxSlots: 5, minColumns: -1, maxColumns: 3 });
    move(snap, 2000, 2000);
    expect(snap.result()).toEqual({ slots: 5, columns: 3 });
    move(snap, -2000, -2000);
    expect(snap.result()).toEqual({ slots: -2, columns: -1 });
  });

  it("is inert without layout (jsdom / no slot size)", () => {
    const { grid } = setup();
    const snap = createGridDragSnap();
    expect(snap.begin(grid, 0)).toBe(false);
    const transform = { x: 7, y: 9, scaleX: 1, scaleY: 1 };
    expect(snap.modifier({ transform } as any)).toBe(transform);
    expect(snap.result()).toBeNull();
  });
});
