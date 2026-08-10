// 用 dev 模式（vite serve + electron）跑 smoke，拿到 React 完整错误
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// 1) 启动 vite
const viteBin = path.join(root, 'node_modules/vite/bin/vite.js');
const vite = spawn(process.execPath, [viteBin, '--port', '5173', '--strictPort'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: '' },
});

await new Promise<void>((resolve) => {
  let resolved = false;
  vite.stdout.on('data', (d) => {
    if (!resolved && /Local:.*http:\/\/localhost:5173/.test(d.toString())) {
      resolved = true;
      resolve();
    }
  });
  setTimeout(resolve, 20000);
});

// 2) 写 dev 模式 smoke main
const smokeMain = path.join(root, 'scripts/_smoke_dev_main.cjs');
fs.writeFileSync(smokeMain, `
const path = require('path');
process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173';
const { app, BrowserWindow } = require('electron');
require(path.join(__dirname, '../electron/main.ts'));
// electron/main.ts 用了 .ts —— 打包成 .cjs 才能直接 require，但 dev 模式应另写
app.whenReady().then(() => {
  setTimeout(() => {
    const wins = BrowserWindow.getAllWindows();
    if (wins[0]) wins[0].webContents.openDevTools();
  }, 3000);
});
setTimeout(() => app.exit(0), 60000);
`);

// 3) 直接用 esbuild 打包 electron/main.ts + preload 为 cjs 但 loadURL vite
const electronExe = path.join(root, 'node_modules/electron/dist/electron.exe');
const env = { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' };
delete env['ELECTRON_RUN_AS_NODE'];
delete env['NODE_OPTIONS'];

// 简化：用 dist/main/index.cjs 但临时把它的 loadFile 改成 loadURL？太复杂。
// 改用纯 CJS dev main
fs.writeFileSync(smokeMain, `
const path = require('path');
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const fs = require('fs');

// dev 模式：精简 IPC（仅够打开 PDF 用）
ipcMain.handle('fs:readFile', async (_e, p) => {
  const d = await fs.promises.readFile(p);
  return d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
});
ipcMain.handle('dialog:openFile', async () => ({ cancelled: true }));
ipcMain.handle('dialog:saveFile', async () => ({ cancelled: true, path: '' }));
ipcMain.handle('recent:list', () => []);
ipcMain.handle('settings:get', () => ({ theme: 'system', language: 'zh-CN', aiDataNotice: true }));
ipcMain.handle('settings:set', () => null);
ipcMain.handle('secure:get', () => null);
ipcMain.handle('secure:set', () => null);
ipcMain.handle('recent:add', () => []);
ipcMain.handle('recent:remove', () => null);
ipcMain.handle('recent:clear', () => null);
ipcMain.handle('app:version', () => '0.1.0');
ipcMain.handle('app:platform', () => 'win32');

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1200, height: 800, show: true,
    webPreferences: { preload: path.join(__dirname, '../dist/main/preload.cjs'), contextIsolation: true, sandbox: false } });
  win.loadURL('http://localhost:5173');
  win.webContents.openDevTools();
  // 等加载完成后注入 PDF
  win.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      try {
        await win.webContents.executeJavaScript(\`(async () => {
          const data = await window.pdfStudio.readFile('C:/Users/moss/WorkBuddy/2026-08-08-21-21-01/pdf-studio-ai/tests/fixtures/sample-multi-page.pdf');
          await window.__pdfStudioTest__.document.getState().openBytes(data, 'C:/Users/moss/WorkBuddy/2026-08-08-21-21-01/pdf-studio-ai/tests/fixtures/sample-multi-page.pdf', 'sample-multi-page.pdf');
        })()\`);
      } catch (e) { console.error('dev inject err', e.message); }
    }, 3000);
  });
});
setTimeout(() => app.exit(0), 60000);
`);

const electron = spawn(electronExe, [smokeMain, '--no-sandbox', '--disable-gpu'], {
  cwd: root, env, stdio: 'inherit',
});
electron.on('exit', (c) => {
  vite.kill();
  fs.unlinkSync(smokeMain);
  process.exit(c ?? 0);
});