import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // garante resolução local do core durante desenvolvimento
      '@react-agendfy/core': resolve(__dirname, '../../packages/core/src'),
      '@react-agendfy/ai': resolve(__dirname, '../../packages/ai/src'),
      // The plugin's sources (its CSS is imported by the entry).
      '@react-agendfy/plugin-timeline': resolve(__dirname, '../../packages/plugins/timeline/src/index.tsx')
    },
    // One React for the app and the library sources: two copies break hooks
    // ("Invalid hook call").
    dedupe: ['react', 'react-dom']
  },
  // The library is aliased to its sources, and its views are lazy chunks: the
  // dependencies they import are only discovered when a view first opens.
  // Pre-bundling them up front avoids a mid-session re-optimization, which
  // leaves the page holding two copies of React until a full reload.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      '@date-fns/tz',
      '@date-fns/utc',
      '@dnd-kit/core',
      '@dnd-kit/modifiers',
      '@dnd-kit/utilities',
      'date-fns',
      're-resizable',
      'rrule'
    ]
  },
  server: { port: 5173 }
});
