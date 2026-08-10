// ============================================================
// Electron Main — 窗口、IPC、文件对话框、本地存储（JSON + safeStorage）
// 打包为 CJS（esbuild），package.json main 指向 dist/main/index.cjs
// ============================================================

import electron from 'electron';
import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

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
function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ============ 安全存储（safeStorage 加密）============
function encryptValue(plain: string): string {
  if (!plain) return '';
  if (electron.safeStorage.isEncryptionAvailable()) {
    return 'v1:' + electron.safeStorage.encryptString(plain).toString('base64');
  }
  // 降级：Base64 编码（不加密，记录警告）
  console.warn('safeStorage 不可用，API Key 将以可逆编码保存');
  return 'plain:' + Buffer.from(plain, 'utf-8').toString('base64');
}
function decryptValue(stored: string): string {
  if (!stored) return '';
  try {
    if (stored.startsWith('v1:')) {
      return electron.safeStorage.decryptString(Buffer.from(stored.slice(3), 'base64'));
    }
    if (stored.startsWith('plain:')) {
      return Buffer.from(stored.slice(6), 'base64').toString('utf-8');
    }
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

  // 外链用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('maximize', () => win.webContents.send('window:maximized', true));
  win.on('unmaximize', () => win.webContents.send('window:maximized', false));
  win.on('closed', () => (mainWindow = null));
}

function createMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: '文件',
      submenu: [
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('menu:open') },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu:save') },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow?.webContents.send('menu:save-as') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '工具',
      submenu: [
        { label: '合并 PDF…', click: () => mainWindow?.webContents.send('menu:merge') },
        { label: '拆分 PDF…', click: () => mainWindow?.webContents.send('menu:split') },
        { type: 'separator' },
        { label: 'OCR 识别…', click: () => mainWindow?.webContents.send('menu:ocr') },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于 PDF Studio AI', click: () => mainWindow?.webContents.send('menu:about') },
      ],
    },
  ];
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
    const data = await fs.promises.readFile(p);
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
      const data = await fs.promises.readFile(p);
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
    return { cancelled: false, path: res.filePath };
  });

  ipcMain.handle('dialog:selectDirectory', async () => {
    const res = await dialog.showOpenDialog(mainWindow!, {
      title: '选择输出目录',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) return { path: null };
    return { path: res.filePaths[0] };
  });

  // ---- 文件读写 ----
  ipcMain.handle('fs:readFile', async (_e, p: string) => {
    const data = await fs.promises.readFile(p);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  });

  ipcMain.handle('fs:writeFile', async (_e, p: string, data: Uint8Array) => {
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

  // ---- 安全存储 ----
  ipcMain.handle('secure:get', (_e, key: string) => {
    const secrets = readJson<Record<string, string>>(fileOf('secrets.json'), {});
    return decryptValue(secrets[key] ?? '');
  });
  ipcMain.handle('secure:set', (_e, key: string, value: string) => {
    const secrets = readJson<Record<string, string>>(fileOf('secrets.json'), {});
    secrets[key] = encryptValue(value);
    writeJson(fileOf('secrets.json'), secrets);
  });
  ipcMain.handle('secure:delete', (_e, key: string) => {
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
