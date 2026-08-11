// ============================================================
// 开发模式：启动 Vite dev server + Electron
// 关键：删除 ELECTRON_RUN_AS_NODE 与 NODE_OPTIONS（沙箱环境注入）
// ============================================================

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const VITE_PORT = 5173;

async function startVite(): Promise<{ process: ReturnType<typeof spawn>; url: string }> {
  const viteBin = path.join(root, 'node_modules/vite/bin/vite.js');
  const child = spawn(process.execPath, [viteBin, '--port', String(VITE_PORT), '--strictPort'], {
    cwd: root,
    stdio: 'pipe',
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  let url = `http://localhost:${VITE_PORT}`;
  let ready = false;
  const output: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!ready) {
        console.error('Vite 启动超时，最近输出:\n' + Buffer.concat(output).toString());
        reject(new Error('Vite 启动超时'));
      }
    }, 60_000);
    child.stdout.on('data', (d) => {
      output.push(d);
      const text = d.toString();
      process.stdout.write(d);
      if (!ready && /Local:.*http:\/\/localhost:\d+/.test(text)) {
        const m = /http:\/\/localhost:\d+/.exec(text);
        if (m) url = m[0];
        ready = true;
        clearTimeout(timer);
        resolve();
      }
    });
    child.stderr.on('data', (d) => {
      output.push(d);
      process.stderr.write(d);
    });
    child.on('exit', (code) => {
      if (!ready) {
        clearTimeout(timer);
        reject(new Error(`Vite 提前退出 code=${code}`));
      }
    });
  });
  return { process: child, url };
}

async function startElectron(url: string): Promise<void> {
  // 1) 打包 main + preload
  await import('./build-main.mjs');

  const electronExe = path.join(root, 'node_modules/electron/dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
  if (!fs.existsSync(electronExe)) {
    throw new Error(`未找到 electron.exe：${electronExe}，请先运行 npm install`);
  }

  const env = { ...process.env, VITE_DEV_SERVER_URL: url };
  delete env['ELECTRON_RUN_AS_NODE'];
  delete env['NODE_OPTIONS'];

  console.log(`🚀 启动 Electron → ${url}`);
  const child = spawn(electronExe, ['.', '--no-sandbox', '--disable-gpu'], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    console.log(`Electron 退出 code=${code}`);
    process.exit(code ?? 0);
  });
  child.on('error', (e) => {
    console.error('Electron 启动失败:', e);
    process.exit(1);
  });
}

const vite = await startVite();
await startElectron(vite.url);

process.on('SIGINT', () => {
  vite.process.kill();
  process.exit(0);
});
