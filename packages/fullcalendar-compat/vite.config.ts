import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), dts({ outDir: 'dist/types', insertTypesEntry: true, rollupTypes: true })],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ReactAgendfyFullCalendarCompat',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'es' : 'cjs'}.js`,
    },
    rollupOptions: {
      // The calendar itself is a peer: one copy of core (and its CSS) in the app.
      external: ['react', 'react-dom', 'react/jsx-runtime', '@react-agendfy/core'],
      // Default (FullCalendar-style import) + named helpers in CJS too.
      output: { exports: 'named' },
    },
    sourcemap: true,
  },
});
