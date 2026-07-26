/**
 * Auto-contrast helpers for event chips.
 *
 * Given an arbitrary event background color, pick a legible foreground
 * (near-black or near-white) using the WCAG relative-luminance formula.
 * Keeps event text readable regardless of the color the user assigns.
 */

const NEAR_BLACK = "#0b0f17";
const NEAR_WHITE = "#ffffff";

/** Parse a #rgb / #rrggbb / rgb()/rgba() string into [r,g,b] (0-255). */
function parseColor(color?: string): [number, number, number] | null {
  if (!color || typeof color !== "string") return null;
  const c = color.trim().toLowerCase();

  // #rgb or #rrggbb
  const hexMatch = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    const int = parseInt(hex, 16);
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
  }

  // rgb() / rgba()
  const rgbMatch = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (rgbMatch) {
    return [
      Math.round(Number(rgbMatch[1])),
      Math.round(Number(rgbMatch[2])),
      Math.round(Number(rgbMatch[3])),
    ];
  }

  return null;
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(color?: string): number {
  const rgb = parseColor(color);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Return a legible foreground color for the given background.
 * Falls back to white when the color can't be parsed (matches prior default).
 */
export function getContrastText(background?: string): string {
  const rgb = parseColor(background);
  if (!rgb) return NEAR_WHITE;
  return relativeLuminance(background) > 0.5 ? NEAR_BLACK : NEAR_WHITE;
}

export default getContrastText;
