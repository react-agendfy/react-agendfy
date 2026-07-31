import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ReactAgendfyAI',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'es' : 'cjs'}.js`,
      cssFileName: 'style',
    },
    rollupOptions: {
      // @anthropic-ai/sdk is an OPTIONAL peer dependency and is only ever
      // loaded via a runtime dynamic import inside src/adapters/claude.ts.
      // It must stay external so consumers that never use the Claude adapter
      // do not need it installed.
      external: ['react', 'react-dom', 'react/jsx-runtime', '@anthropic-ai/sdk'],
    },
    sourcemap: true,
  },
  plugins: [dts({ outDir: 'dist/types', insertTypesEntry: true, rollupTypes: true })],
});
