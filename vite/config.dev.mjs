import { resolve } from 'path';
import { defineConfig } from 'vite';
import { editorAssetsPlugin } from '../editor/vite/editorAssetsPlugin.mjs';

export default defineConfig({
  base: './',
  plugins: [
    editorAssetsPlugin({ rootDir: resolve(__dirname, '..') }),
  ],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, '..', 'index.html'),
        editor: resolve(__dirname, '..', 'editor', 'index.html'),
      },
    },
  },
});
