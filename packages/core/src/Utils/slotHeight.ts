import type React from "react";
import type { Config, EventProps } from "../types/types";

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

/**
 * `top` of an event inside the slot it starts in: events are bucketed by
 * slot, so one starting at 10:15 in the 10:00 slot (30-min slots) sits half
 * a slot down. "0" for on-grid starts and day-continuation segments.
 */
export const slotOffsetTop = (
  event: Pick<EventProps, "start">,
  slotTime: Date | string,
  config?: Partial<Config> | null
): string => {
  const minutes =
    (new Date(event.start as string | Date).getTime() - new Date(slotTime as string | Date).getTime()) / 60000;
  if (!(minutes > 0)) return "0";
  return `${(minutes / (config?.slotDuration || 30)) * getSlotHeight(config)}px`;
};
