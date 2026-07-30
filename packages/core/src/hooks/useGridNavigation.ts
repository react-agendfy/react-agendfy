import { useCallback, useEffect, useRef, useState } from "react";

export interface GridNavigationOptions {
  /** Total number of navigable cells in the grid. */
  cellCount: number;
  /** Number of columns per row (7 for a month grid). */
  columns: number;
  /** Index that receives tabIndex={0} before the user moves focus. */
  defaultIndex?: number;
  /** Fired when the user presses Enter or Space on the focused cell. */
  onActivateCell?: (index: number) => void;
}

export interface GridCellNavProps {
  tabIndex: 0 | -1;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocus: () => void;
  setRef: (el: HTMLElement | null) => void;
}

/**
 * Roving-tabindex keyboard navigation for a 2D grid (WAI-ARIA grid pattern).
 *
 * Exactly one cell is tabbable at a time; Arrow keys move focus by one cell
 * (left/right) or one row (up/down), Home/End jump to the start/end of the
 * current row, and Enter/Space activate the focused cell.
 */
export function useGridNavigation({
  cellCount,
  columns,
  defaultIndex = 0,
  onActivateCell,
}: GridNavigationOptions) {
  const [focusedIndex, setFocusedIndex] = useState(defaultIndex);
  const cellRefs = useRef<(HTMLElement | null)[]>([]);
  const userMovedRef = useRef(false);

  // Keep the roving index valid when the grid shrinks, and follow the
  // default index (e.g. month changes) until the user takes over.
  useEffect(() => {
    if (!userMovedRef.current) {
      setFocusedIndex(Math.min(Math.max(defaultIndex, 0), Math.max(cellCount - 1, 0)));
    } else if (focusedIndex >= cellCount) {
      setFocusedIndex(Math.max(cellCount - 1, 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellCount, defaultIndex]);

  const moveFocus = useCallback(
    (next: number) => {
      const clamped = Math.min(Math.max(next, 0), cellCount - 1);
      userMovedRef.current = true;
      setFocusedIndex(clamped);
      cellRefs.current[clamped]?.focus();
    },
    [cellCount]
  );

  const getCellProps = useCallback(
    (index: number): GridCellNavProps => ({
      tabIndex: index === focusedIndex ? 0 : -1,
      onFocus: () => {
        userMovedRef.current = true;
        setFocusedIndex(index);
      },
      setRef: (el: HTMLElement | null) => {
        cellRefs.current[index] = el;
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        // Only handle keys targeted at the cell itself, not at nested
        // interactive children (events inside a day cell).
        if (e.target !== e.currentTarget) return;
        switch (e.key) {
          case "ArrowRight":
            e.preventDefault();
            moveFocus(index + 1);
            break;
          case "ArrowLeft":
            e.preventDefault();
            moveFocus(index - 1);
            break;
          case "ArrowDown":
            e.preventDefault();
            moveFocus(index + columns);
            break;
          case "ArrowUp":
            e.preventDefault();
            moveFocus(index - columns);
            break;
          case "Home":
            e.preventDefault();
            moveFocus(index - (index % columns));
            break;
          case "End":
            e.preventDefault();
            moveFocus(index - (index % columns) + columns - 1);
            break;
          case "Enter":
          case " ":
            if (onActivateCell) {
              e.preventDefault();
              onActivateCell(index);
            }
            break;
          default:
            break;
        }
      },
    }),
    [focusedIndex, columns, moveFocus, onActivateCell]
  );

  return { focusedIndex, getCellProps, moveFocus };
}

export default useGridNavigation;
