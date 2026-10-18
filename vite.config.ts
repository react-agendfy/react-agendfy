import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Root `vite` / `vite build` = the public demo (examples/basic), written to
 * ./dist. Hosting (Cloudflare "demo") builds the repo root, so this must work
 * on a fresh install without building the packages first: every
 * @react-agendfy/* import resolves to its SOURCE.
 */
const pkg = (path: string) => resolve(__dirname, 'packages', path);

export default defineConfig({
  root: resolve(__dirname, 'examples/basic'),
  plugins: [react()],
  resolve: {
    alias: {
      '@react-agendfy/core': pkg('core/src'),
      '@react-agendfy/ai': pkg('ai/src'),
      '@react-agendfy/fullcalendar-compat': pkg('fullcalendar-compat/src'),
      '@react-agendfy/plugin-export-pdf': pkg('plugins/export-pdf/src'),
      '@react-agendfy/plugin-export-reports': pkg('plugins/export-reports/src'),
      '@react-agendfy/plugin-google-calendar': pkg('plugins/google-calendar/src'),
      '@react-agendfy/plugin-theme': pkg('plugins/theme/src'),
      '@react-agendfy/plugin-timeline': pkg('plugins/timeline/src'),
      '@react-agendfy/plugin-filter': pkg('plugins/filters/src'),
    },
    // One React for the demo and every aliased package source.
    dedupe: ['react', 'react-dom'],
  },
  // VITE_* variables are read from examples/basic (its .env files).
  envDir: resolve(__dirname, 'examples/basic'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    open: true,
    port: 3000,
  },
});
