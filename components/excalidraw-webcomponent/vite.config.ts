import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/main.tsx'),
      name: 'ExcalidrawWC',
      fileName: (format) => `excalidraw-wc.${format}.js`,
      formats: ['umd', 'es'],
    },
    rollupOptions: {
      // Inline everything into one bundle for easy embedding
      output: {
        inlineDynamicImports: true,
      }
    },
  },
});
