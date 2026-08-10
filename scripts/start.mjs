// ============================================================
// 生产模式启动：构建后直接运行 Electron（加载 dist/renderer）
// ============================================================

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const electronExe = path.join(root, 'node_modules/electron/dist/electron.exe');
if (!fs.existsSync(electronExe)) {
  throw new Error(`未找到 electron.exe：${electronExe}`);
}
if (!fs.existsSync(path.join(root, 'dist/renderer/index.html'))) {
  throw new Error('dist/renderer 不存在，请先运行 npm run build');
}

const env = { ...process.env };
delete env['ELECTRON_RUN_AS_NODE'];
delete env['NODE_OPTIONS'];

console.log('🚀 启动 PDF Studio AI（生产模式）');
const child = spawn(electronExe, ['.', '--no-sandbox', '--disable-gpu'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (e) => {
  console.error('Electron 启动失败:', e);
  process.exit(1);
});
