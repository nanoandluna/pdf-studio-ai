// 冒烟测试：启动 Electron 加载渲染好的页面，验证 main 进程 + preload + renderer 无崩溃
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const electronExe = path.join(root, 'node_modules/electron/dist/electron.exe');
const env = { ...process.env };
delete env['ELECTRON_RUN_AS_NODE'];
delete env['NODE_OPTIONS'];

// 用一个小 main 脚本直接启动并检查
const testMain = path.join(root, 'scripts/_smoke_main.cjs');
fs.writeFileSync(testMain, `
const { app, BrowserWindow } = require('electron');
const path = require('path');
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200, height: 800, show: false,
    webPreferences: { preload: path.join(__dirname, '../dist/main/preload.cjs'), contextIsolation: true, sandbox: false }
  });
  win.loadFile(path.join(__dirname, '../dist/renderer/index.html')).then(() => {
    setTimeout(() => {
      console.log('SMOKE_OK window loaded');
      app.quit();
    }, 2000);
  }).catch((e) => { console.error('SMOKE_FAIL', e); app.exit(1); });
  win.webContents.on('render-process-gone', (_e, d) => { console.error('SMOKE_FAIL render-gone', d.reason); app.exit(1); });
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) console.log('RENDERER_LOG[' + level + ']', msg.slice(0, 300)); });
});
setTimeout(() => { console.error('SMOKE_TIMEOUT'); app.exit(2); }, 30000);
`);

const child = spawn(electronExe, [testMain, '--no-sandbox', '--disable-gpu'], { cwd: root, env, stdio: 'inherit' });
child.on('exit', (code) => {
  fs.unlinkSync(testMain);
  process.exit(code ?? 0);
});
