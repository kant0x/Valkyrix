import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    minify: 'terser',
    rollupOptions: {
      input: {
        main: resolve(__dirname, '..', 'index.html'),
        editor: resolve(__dirname, '..', 'editor', 'index.html'),
      },
    },
  },
});
