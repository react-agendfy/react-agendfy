import type { ThemePlugin } from '@react-agendfy/core';

/**
 * Dark theme plugin.
 *
 * The calendar core now owns the built-in dark mode (via `.agendfy[data-theme]`
 * and the OS `prefers-color-scheme` media query) and applies a matching
 * plugin's `cssVariables` to the calendar root element (scoped, multi-instance
 * safe) rather than to `document.documentElement`.
 *
 * `cssVariables` here is a COMPLETE override of every L2 semantic token so the
 * plugin also works standalone. `activate`/`deactivate` keep their original
 * public shape but accept an optional target element (default:
 * `document.documentElement`) so callers can scope the mutation.
 */
const darkThemePlugin: ThemePlugin = {
  key: 'dark-theme',
  type: 'theme',
  themeName: 'dark',
  description: 'Dark theme with modern aesthetics',
  cssVariables: {
    '--agendfy-color-ground': '#0b0f17',
    '--agendfy-color-surface': '#141a24',
    '--agendfy-color-surface-2': '#1b2330',
    '--agendfy-color-surface-hover': '#212b3a',
    '--agendfy-color-border': '#263140',
    '--agendfy-color-border-strong': '#364357',
    '--agendfy-color-text': '#e6ecf5',
    '--agendfy-color-text-muted': '#93a3b8',
    '--agendfy-color-text-faint': '#5c6b81',
    '--agendfy-color-accent': '#6b7bff',
    '--agendfy-color-accent-hover': '#8591ff',
    '--agendfy-color-accent-soft': '#1e2547',
    '--agendfy-color-now': '#ff7a7e',
    '--agendfy-color-today-wash': '#171e39',
    '--agendfy-color-event-fg': '#0b0f17',
    '--agendfy-shadow-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
    '--agendfy-shadow-md':
      '0 4px 10px -2px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
    '--agendfy-shadow-lg':
      '0 12px 24px -6px rgba(0, 0, 0, 0.6), 0 4px 8px -4px rgba(0, 0, 0, 0.5)',
  },
  activate(target?: HTMLElement) {
    const el =
      target || (typeof document !== 'undefined' ? document.documentElement : undefined);
    if (!el) return;
    el.setAttribute('data-theme', 'dark');
    Object.entries(this.cssVariables!).forEach(([k, v]) => {
      el.style.setProperty(k, v);
    });
  },
  deactivate(target?: HTMLElement) {
    const el =
      target || (typeof document !== 'undefined' ? document.documentElement : undefined);
    if (!el) return;
    if (el.getAttribute('data-theme') === 'dark') el.removeAttribute('data-theme');
    Object.keys(this.cssVariables!).forEach(k => {
      el.style.removeProperty(k);
    });
  }
} as ThemePlugin;

export default darkThemePlugin;
