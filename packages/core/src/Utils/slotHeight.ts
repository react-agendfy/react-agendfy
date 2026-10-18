import type React from "react";
import type { Config } from "../types/types";

/** Default height of one time-grid slot, in px (week/day views). */
export const DEFAULT_SLOT_HEIGHT = 40;

/**
 * The single source of truth for the time-grid slot height: `config.slotHeight`
 * (px) when it is a positive number, otherwise DEFAULT_SLOT_HEIGHT. Every JS
 * computation (event top/height, now line, grid lines, resize) uses this, and
 * the views mirror it to the `--agendfy-slot-height` CSS variable so the slot
 * rows rendered by CSS always match.
 */
export const getSlotHeight = (config?: Partial<Config> | null): number => {
  const value = Number(config?.slotHeight);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SLOT_HEIGHT;
};

/** Inline style that mirrors the slot height to CSS (`--agendfy-slot-height`). */
export const slotHeightStyle = (config?: Partial<Config> | null): React.CSSProperties =>
  ({ "--agendfy-slot-height": `${getSlotHeight(config)}px` } as React.CSSProperties);
