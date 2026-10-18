/**
 * Accent presets for the demo. Each one only overrides react-agendfy's
 * public design tokens (--agendfy-*) on the calendar's container — the same
 * thing any app does to brand the calendar.
 */
export interface AccentPreset {
  id: string;
  label: string;
  swatch: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

export const accentPresets: AccentPreset[] = [
  {
    id: "indigo",
    label: "Indigo",
    swatch: "#6366f1",
    light: {},
    dark: {},
  },
  {
    id: "ocean",
    label: "Ocean",
    swatch: "#0284c7",
    light: {
      "--agendfy-color-accent": "#0284c7",
      "--agendfy-color-accent-hover": "#0369a1",
      "--agendfy-color-accent-soft": "#e0f2fe",
      "--agendfy-color-today-wash": "#f0f9ff",
    },
    dark: {
      "--agendfy-color-accent": "#38bdf8",
      "--agendfy-color-accent-hover": "#7dd3fc",
      "--agendfy-color-accent-soft": "#0c2a3d",
      "--agendfy-color-today-wash": "#0b2233",
    },
  },
  {
    id: "forest",
    label: "Forest",
    swatch: "#059669",
    light: {
      "--agendfy-color-accent": "#059669",
      "--agendfy-color-accent-hover": "#047857",
      "--agendfy-color-accent-soft": "#d1fae5",
      "--agendfy-color-today-wash": "#ecfdf5",
    },
    dark: {
      "--agendfy-color-accent": "#34d399",
      "--agendfy-color-accent-hover": "#6ee7b7",
      "--agendfy-color-accent-soft": "#0f2e25",
      "--agendfy-color-today-wash": "#0c241d",
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    swatch: "#ea580c",
    light: {
      "--agendfy-color-accent": "#ea580c",
      "--agendfy-color-accent-hover": "#c2410c",
      "--agendfy-color-accent-soft": "#ffedd5",
      "--agendfy-color-today-wash": "#fff7ed",
    },
    dark: {
      "--agendfy-color-accent": "#fb923c",
      "--agendfy-color-accent-hover": "#fdba74",
      "--agendfy-color-accent-soft": "#3a1d0c",
      "--agendfy-color-today-wash": "#2b1609",
    },
  },
  {
    id: "rose",
    label: "Rose",
    swatch: "#e11d48",
    light: {
      "--agendfy-color-accent": "#e11d48",
      "--agendfy-color-accent-hover": "#be123c",
      "--agendfy-color-accent-soft": "#ffe4e6",
      "--agendfy-color-today-wash": "#fff1f2",
    },
    dark: {
      "--agendfy-color-accent": "#fb7185",
      "--agendfy-color-accent-hover": "#fda4af",
      "--agendfy-color-accent-soft": "#3b111b",
      "--agendfy-color-today-wash": "#2c0d14",
    },
  },
  {
    id: "graphite",
    label: "Graphite",
    swatch: "#334155",
    light: {
      "--agendfy-color-accent": "#334155",
      "--agendfy-color-accent-hover": "#1e293b",
      "--agendfy-color-accent-soft": "#e2e8f0",
      "--agendfy-color-today-wash": "#f1f5f9",
    },
    dark: {
      "--agendfy-color-accent": "#cbd5e1",
      "--agendfy-color-accent-hover": "#e2e8f0",
      "--agendfy-color-accent-soft": "#273244",
      "--agendfy-color-today-wash": "#1a2230",
    },
  },
];
