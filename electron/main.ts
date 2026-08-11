// ============================================================
// Electron Main — 窗口、IPC、文件对话框、本地存储（JSON + safeStorage）
// 打包为 CJS（esbuild），package.json main 指向 dist/main/index.cjs
// ============================================================

import electron from 'electron';
import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { buildMenuTemplate } from './menuTemplate';
import type { MenuChannel } from './menuChannels';

// esbuild --format=cjs 自动注入 __dirname
declare const __dirname: string;

const isDev = !!process.env.VITE_DEV_SERVER_URL;

// ============ 数据目录 ============
let userDataDir = '';
function dataDir(): string {
  if (!userDataDir) userDataDir = app.getPath('userData');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
  return userDataDir;
}
function fileOf(name: string): string {
  return path.join(dataDir(), name);
}

// ============ JSON 存储 ============
function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
// 原子写：先写 .tmp 再 rename，避免写一半崩溃损坏 settings.json / secrets.json
function writeJson(file: string, data: unknown): void {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

// ============ 文件访问白名单（开源安全：renderer 只能读写在对话框/最近文件中出现的路径）============
const allowedPaths = new Set<string>(); // 精确路径（对话框返回、最近文件）
const allowedDirs = new Set<string>(); // 目录前缀（提取/导出目录）
function allowPath(p: string): void {
  if (p) allowedPaths.add(path.resolve(p));
}
function allowDir(d: string): void {
  if (d) allowedDirs.add(path.resolve(d));
}
function isAllowedPath(p: string): boolean {
  if (!p) return false;
  const resolved = path.resolve(p);
  if (allowedPaths.has(resolved)) return true;
  for (const dir of allowedDirs) {
    if (resolved === dir || resolved.startsWith(dir + path.sep)) return true;
  }
  return false;
}

// ============ 文件大小限制（防止超大文件整读内存暴涨）============
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
async function readFileWithLimit(p: string): Promise<Buffer> {
  const st = await fs.promises.stat(p);
  if (st.size > MAX_FILE_SIZE) {
    throw new Error(`文件过大（${(st.size / 1024 / 1024).toFixed(1)} MB），超过 100 MB 上限`);
  }
  return fs.promises.readFile(p);
}

// ============ 安全存储（safeStorage 加密）============
// 开源安全：key 必须来自白名单；safeStorage 不可用时拒绝存储（不降级为可逆 base64）
const SECURE_KEYS = new Set(['ai.apiKey', 'ai.provider']);
function encryptValue(plain: string): string {
  if (!plain) return '';
  if (electron.safeStorage.isEncryptionAvailable()) {
    return 'v1:' + electron.safeStorage.encryptString(plain).toString('base64');
  }
  throw new Error('系统安全存储不可用，拒绝保存敏感信息');
}
function decryptValue(stored: string): string {
  if (!stored) return '';
  try {
    if (stored.startsWith('v1:')) {
      return electron.safeStorage.decryptString(Buffer.from(stored.slice(3), 'base64'));
    }
    // 历史遗留的 plain: 数据不再解密（安全策略收紧后旧降级数据失效）
  } catch {
    // 解密失败返回空
  }
  return '';
}

// ============ 窗口 ============
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: 'PDF Studio AI',
    backgroundColor: '#f7f7fb',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow = win;

  win.once('ready-to-show', () => win.show());

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // 外链用系统浏览器打开（只放行 https，拒绝 http://localhost 等内网/非加密链接）
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('maximize', () => win.webContents.send('window:maximized', true));
  win.on('unmaximize', () => win.webContents.send('window:maximized', false));
  win.on('closed', () => (mainWindow = null));
}

function sendToRenderer(channel: MenuChannel): void {
  const win = BrowserWindow.getFocusedWindow() ?? mainWindow;
  win?.webContents.send(channel);
}

function createMenu(): void {
  const template = buildMenuTemplate({ isMac: process.platform === 'darwin', isDev, send: sendToRenderer });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ============ IPC 处理器 ============
function registerIpc(): void {
  // ---- 文件对话框 ----
  ipcMain.handle('dialog:openFile', async (_e, opts) => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: opts?.title ?? '打开 PDF',
      filters: opts?.filters ?? [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['openFile'],
    });
    if (res.canceled || res.filePaths.length === 0) return { cancelled: true };
    const p = res.filePaths[0];
    allowPath(p);
    const data = await readFileWithLimit(p);
    return {
      cancelled: false,
      path: p,
      name: path.basename(p),
      data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    };
  });

  ipcMain.handle('dialog:openFiles', async (_e, opts) => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: opts?.title ?? '选择 PDF 文件',
      filters: opts?.filters ?? [{ name: 'PDF', extensions: ['pdf'] }],
      properties: ['openFile', 'multiSelections'],
    });
    if (res.canceled || res.filePaths.length === 0) return { cancelled: true, files: [] };
    const files = [];
    for (const p of res.filePaths) {
      allowPath(p);
      const data = await readFileWithLimit(p);
      files.push({
        path: p,
        name: path.basename(p),
        data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      });
    }
    return { cancelled: false, files };
  });

  ipcMain.handle('dialog:saveFile', async (_e, opts) => {
    const res = await dialog.showSaveDialog(mainWindow!, {
      title: opts?.title ?? '保存 PDF',
      defaultPath: opts?.defaultPath ?? 'document.pdf',
      filters: opts?.filters ?? [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (res.canceled || !res.filePath) return { cancelled: true, path: '' };
    allowPath(res.filePath);
    return { cancelled: false, path: res.filePath };
  });

  ipcMain.handle('dialog:selectDirectory', async () => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: '选择输出目录',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) return { path: null };
    allowDir(res.filePaths[0]);
    return { path: res.filePaths[0] };
  });

  // ---- 文件读写（白名单：只允许对话框/最近文件中出现过的路径）----
  ipcMain.handle('fs:readFile', async (_e, p: string) => {
    if (!isAllowedPath(p)) throw new Error('无权读取该路径');
    const data = await readFileWithLimit(p);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  });

  ipcMain.handle('fs:writeFile', async (_e, p: string, data: Uint8Array) => {
    if (!isAllowedPath(p)) throw new Error('无权写入该路径');
    await fs.promises.writeFile(p, Buffer.from(data));
  });

  ipcMain.handle('fs:exists', (_e, p: string) => fs.existsSync(p));

  // ---- 最近文件 ----
  ipcMain.handle('recent:list', () => readJson(fileOf('recent-files.json'), []));

  ipcMain.handle('recent:add', (_e, entry) => {
    const list = readJson<{ path: string; name: string; lastOpenedAt: number; pageCount?: number }[]>(
      fileOf('recent-files.json'), []
    );
    const next = [entry, ...list.filter((f) => f.path !== entry.path)].slice(0, 20);
    writeJson(fileOf('recent-files.json'), next);
    // 最近文件路径加入白名单（允许从最近列表重新打开）
    allowPath(entry?.path);
    // 标记不可用
    const withAvailability = next.map((f) => ({
      ...f,
      available: fs.existsSync(f.path),
    }));
    return withAvailability;
  });

  ipcMain.handle('recent:remove', (_e, p: string) => {
    const list = readJson<unknown[]>(fileOf('recent-files.json'), []).filter(
      (f) => (f as { path: string }).path !== p
    );
    writeJson(fileOf('recent-files.json'), list);
  });

  ipcMain.handle('recent:clear', () => writeJson(fileOf('recent-files.json'), []));

  // ---- 设置 ----
  ipcMain.handle('settings:get', () =>
    readJson(fileOf('settings.json'), { theme: 'system', language: 'zh-CN', aiDataNotice: true })
  );
  ipcMain.handle('settings:set', (_e, settings) => writeJson(fileOf('settings.json'), settings));

  // ---- 安全存储（key 白名单 + safeStorage 加密）----
  ipcMain.handle('secure:get', (_e, key: string) => {
    if (!SECURE_KEYS.has(key)) throw new Error('非法的存储 key');
    const secrets = readJson<Record<string, string>>(fileOf('secrets.json'), {});
    return decryptValue(secrets[key] ?? '');
  });
  ipcMain.handle('secure:set', (_e, key: string, value: string) => {
    if (!SECURE_KEYS.has(key)) throw new Error('非法的存储 key');
    const secrets = readJson<Record<string, string>>(fileOf('secrets.json'), {});
    secrets[key] = encryptValue(value); // safeStorage 不可用时抛错（不降级）
    writeJson(fileOf('secrets.json'), secrets);
  });
  ipcMain.handle('secure:delete', (_e, key: string) => {
    if (!SECURE_KEYS.has(key)) throw new Error('非法的存储 key');
    const secrets = readJson<Record<string, string>>(fileOf('secrets.json'), {});
    delete secrets[key];
    writeJson(fileOf('secrets.json'), secrets);
  });

  // ---- 应用信息 / 窗口 ----
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:platform', () => process.platform);
  ipcMain.handle('win:minimize', () => mainWindow?.minimize());
  ipcMain.handle('win:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('win:close', () => mainWindow?.close());
  ipcMain.handle('win:isMaximized', () => mainWindow?.isMaximized() ?? false);
}

// ============ 生命周期 ============
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    // 启动时预加载最近文件路径到白名单（否则重启后最近文件无法重新打开）
    try {
      const recent = readJson<{ path: string }[]>(fileOf('recent-files.json'), []);
      for (const f of recent) if (f?.path) allowPath(f.path);
    } catch {
      // 忽略预加载失败
    }
    registerIpc();
    createMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
