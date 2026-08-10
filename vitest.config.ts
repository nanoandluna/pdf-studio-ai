import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
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
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,
    testTimeout: 30_000,
  },
});
