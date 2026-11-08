import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import fs from 'fs';
import path from 'path';

/**
 * dist/gantt.css holds the Gantt's own styles. dist/style.css is the one
 * import for <Gantt>: the core's stylesheet (from the installed core, so the
 * versions always match) followed by the Gantt's.
 */
const styleBundle = (): Plugin => ({
  name: 'gantt-style-bundle',
  apply: 'build',
  closeBundle() {
    const dist = path.resolve(__dirname, 'dist');
    const own = fs.readFileSync(path.join(dist, 'gantt.css'), 'utf8');
    fs.writeFileSync(path.join(dist, 'style.css'), `@import "@react-agendfy/core/core.css";\n${own}`);
  },
});

export default defineConfig({
  plugins: [react(), dts({ insertTypesEntry: true }), styleBundle()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'ReactAgendfyGantt',
      formats: ['es', 'umd'],
      fileName: (format) => `index.${format}.js`,
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@react-agendfy/core', 'date-fns', '@date-fns/tz'],
      output: {
        exports: 'named',
        assetFileNames: 'gantt.[ext]',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
          '@react-agendfy/core': 'ReactAgendfyCore',
          'date-fns': 'dateFns',
          '@date-fns/tz': 'dateFnsTz',
        },
      },
    },
  },
});
