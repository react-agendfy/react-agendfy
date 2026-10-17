import type { Modifier } from "@dnd-kit/core";

/*
 * Snapping for time-grid drags (week/day views).
 *
 * The DragOverlay preview is position: fixed, so its transform is in
 * VIEWPORT pixels — but the grid can scroll under it while dragging (the
 * calendar's own scroll container, a host container, the page, dnd-kit's
 * auto-scroll). Snapping the raw transform to slot multiples then leaves the
 * preview off the grid lines, and any separately computed drop time can land
 * a slot away from what the user saw.
 *
 * Here the snap is computed in GRID coordinates (pointer movement + scroll
 * moved since the drag began), the preview is placed back in viewport space,
 * and the snapped grid offset is kept so the drop uses exactly the same
 * value the preview showed.
 */

type ScrollTarget = Element | Window;

const scrollPosition = (target: ScrollTarget) =>
  target instanceof Window
    ? { top: target.scrollY, left: target.scrollX }
    : { top: (target as Element).scrollTop, left: (target as Element).scrollLeft };

const scrollableAncestors = (node: Element | null): ScrollTarget[] => {
  const result: ScrollTarget[] = [];
  for (let el = node?.parentElement; el; el = el.parentElement) {
    const style = getComputedStyle(el);
    if (/(auto|scroll|overlay)/.test(style.overflow + style.overflowY + style.overflowX)) result.push(el);
  }
  if (typeof window !== "undefined") result.push(window);
  return result;
};

/** Allowed movement, in slots/columns, so the preview never leaves the grid. */
export interface GridDragBounds {
  minSlots: number;
  maxSlots: number;
  minColumns?: number;
  maxColumns?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface GridDragSnap {
  /** Measure the grid and remember scroll positions; returns false without layout (e.g. jsdom). */
  begin: (grid: Element | null, slotPx: number, columnPx?: number, bounds?: GridDragBounds) => boolean;
  /** dnd-kit modifier for the DragOverlay. */
  modifier: Modifier;
  /** Snapped grid offset of the last preview position, in slots/columns. */
  result: () => { slots: number; columns: number } | null;
  end: () => void;
}

export const createGridDragSnap = (): GridDragSnap => {
  let active = false;
  let slotPx = 0;
  let columnPx = 0;
  let origins: { target: ScrollTarget; top: number; left: number }[] = [];
  let last: { slots: number; columns: number } | null = null;
  let limits: GridDragBounds = { minSlots: -Infinity, maxSlots: Infinity };

  const scrollDelta = () =>
    origins.reduce(
      (acc, o) => {
        const now = scrollPosition(o.target);
        return { top: acc.top + now.top - o.top, left: acc.left + now.left - o.left };
      },
      { top: 0, left: 0 }
    );

  return {
    begin(grid, slot, column = 0, bounds) {
      slotPx = slot;
      columnPx = column;
      limits = bounds ?? { minSlots: -Infinity, maxSlots: Infinity };
      active = slotPx > 0;
      last = active ? { slots: 0, columns: 0 } : null;
      origins = active ? scrollableAncestors(grid).map((target) => ({ target, ...scrollPosition(target) })) : [];
      return active;
    },
    modifier: ({ transform }) => {
      if (!active) return transform;
      const scroll = scrollDelta();
      const slots = clamp(Math.round((transform.y + scroll.top) / slotPx), limits.minSlots, limits.maxSlots);
      const columns =
        columnPx > 0
          ? clamp(
              Math.round((transform.x + scroll.left) / columnPx),
              limits.minColumns ?? -Infinity,
              limits.maxColumns ?? Infinity
            )
          : 0;
      last = { slots, columns };
      return {
        ...transform,
        y: slots * slotPx - scroll.top,
        x: columnPx > 0 ? columns * columnPx - scroll.left : 0,
      };
    },
    result: () => (active ? last : null),
    end() {
      active = false;
      origins = [];
      last = null;
    },
  };
};
