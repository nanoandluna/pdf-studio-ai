import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Vite 构建 Renderer（React UI）
// Electron 主进程由 scripts/build-main.mjs 用 esbuild 单独打包为 CJS
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@domain': resolve(__dirname, 'src/domain'),
      '@engine': resolve(__dirname, 'src/engine'),
      '@commands': resolve(__dirname, 'src/commands'),
      '@ai': resolve(__dirname, 'src/ai'),
      '@ocr': resolve(__dirname, 'src/ocr'),
      '@search': resolve(__dirname, 'src/search'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@components': resolve(__dirname, 'src/components'),
      '@theme': resolve(__dirname, 'src/theme'),
      '@lib': resolve(__dirname, 'src/lib'),
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    target: 'chrome120',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
