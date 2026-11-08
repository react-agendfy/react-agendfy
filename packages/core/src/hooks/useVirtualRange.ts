import { RefObject, useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

/*
 * Windowing for long lists of rows or columns (RFC 001, layer 3): only the
 * items in the viewport (plus `overscan`) are rendered. Sizes are known up
 * front (a number, or a function of the index — e.g. a row height from its
 * stacked lanes), so nothing is measured per item.
 *
 * Without layout (SSR, jsdom) the viewport has no size and every item is
 * rendered: the view never comes up empty.
 */

export interface VirtualRangeOptions {
  count: number;
  /** Size of each item along the axis, px. */
  size: number | ((index: number) => number);
  /** The scrolling element. */
  viewportRef: RefObject<HTMLElement | null>;
  axis?: "x" | "y";
  /** Extra items rendered before and after the visible ones. Default 2. */
  overscan?: number;
  /** Where the list starts inside the scrolled content (e.g. after a label column), px. */
  startOffset?: number;
}

export interface VirtualItem {
  index: number;
  /** Offset from the start of the list, px. */
  offset: number;
  size: number;
}

export interface VirtualRange {
  items: VirtualItem[];
  totalSize: number;
  /** Offset of any item (rendered or not). */
  offsetOf: (index: number) => number;
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Last index whose start is <= `position` (binary search over the offsets). */
const indexAt = (offsets: number[], position: number) => {
  let lo = 0;
  let hi = offsets.length - 2; // offsets has count + 1 entries
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= position) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
};

export function useVirtualRange({
  count,
  size,
  viewportRef,
  axis = "y",
  overscan = 2,
  startOffset = 0,
}: VirtualRangeOptions): VirtualRange {
  // offsets[i] = start of item i; offsets[count] = total size.
  const offsets = useMemo(() => {
    const out = new Array<number>(count + 1);
    out[0] = 0;
    for (let i = 0; i < count; i++) out[i + 1] = out[i] + (typeof size === "number" ? size : size(i));
    return out;
  }, [count, size]);

  const [view, setView] = useState({ scroll: 0, extent: 0 });

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    // RTL horizontal scrolling reports negative scrollLeft in current browsers.
    const scroll = axis === "x" ? Math.abs(el.scrollLeft) : el.scrollTop;
    const extent = axis === "x" ? el.clientWidth : el.clientHeight;
    setView((prev) => (prev.scroll === scroll && prev.extent === extent ? prev : { scroll, extent }));
  }, [viewportRef, axis]);

  useIsoLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    measure();
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [viewportRef, measure]);

  const totalSize = offsets[count];
  const items = useMemo(() => {
    let first = 0;
    let last = count - 1;
    if (view.extent > 0 && count > 0) {
      const from = view.scroll - startOffset;
      first = Math.max(0, indexAt(offsets, from) - overscan);
      last = Math.min(count - 1, indexAt(offsets, from + view.extent) + overscan);
    }
    const out: VirtualItem[] = [];
    for (let i = first; i <= last; i++) out.push({ index: i, offset: offsets[i], size: offsets[i + 1] - offsets[i] });
    return out;
  }, [offsets, count, view, overscan, startOffset]);

  const offsetOf = useCallback((index: number) => offsets[Math.max(0, Math.min(count, index))], [offsets, count]);

  return { items, totalSize, offsetOf };
}

export default useVirtualRange;
