// ============================================================
// 用 esbuild 把 Electron 主进程 + preload 打包为 CJS
// （Electron 33 ESM main 有 cjsPreparse bug，必须输出 .cjs）
// ============================================================

import { build } from 'esbuild';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  logLevel: 'info',
  sourcemap: false,
  define: {},
};

await build({
  ...common,
  entryPoints: [path.join(root, 'electron/main.ts')],
  outfile: path.join(root, 'dist/main/index.cjs'),
});

await build({
  ...common,
  entryPoints: [path.join(root, 'electron/preload.ts')],
  outfile: path.join(root, 'dist/main/preload.cjs'),
});

console.log('✅ main & preload 打包完成');
