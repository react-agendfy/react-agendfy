import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PluginGoogleCalendar',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'es' : 'cjs'}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@react-agendfy/core'],
    },
    sourcemap: true,
  },
  plugins: [dts({ outDir: 'dist/types', insertTypesEntry: true, rollupTypes: true })],
});