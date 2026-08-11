// ============================================================
// Electron Preload — 通过 contextBridge 暴露安全 API
// 打包为 CJS（esbuild），文件名为 preload.cjs
// ============================================================

import { contextBridge, ipcRenderer } from 'electron';
import { MENU_CHANNELS } from './menuChannels';

// ============ 原生菜单事件桥接 ============
// 主进程菜单点击通过 webContents.send('menu:*') 发送 IPC 事件；
// App.tsx 监听的是 window 上的同名 DOM CustomEvent。
// 这里把 IPC 事件桥接为 DOM 事件，保证原生菜单与应用内
// 工具栏/命令面板共用同一套事件链路（单一入口）。
for (const ch of MENU_CHANNELS) {
  ipcRenderer.on(ch, () => window.dispatchEvent(new CustomEvent(ch)));
}

const bridge = {
  // 文件对话框
  openFileDialog: (opts?: unknown) => ipcRenderer.invoke('dialog:openFile', opts),
  openFilesDialog: (opts?: unknown) => ipcRenderer.invoke('dialog:openFiles', opts),
  saveFileDialog: (opts?: unknown) => ipcRenderer.invoke('dialog:saveFile', opts),
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),

  // 文件读写
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, data: Uint8Array) => ipcRenderer.invoke('fs:writeFile', path, data),
  fileExists: (path: string) => ipcRenderer.invoke('fs:exists', path),

  // 最近文件
  getRecentFiles: () => ipcRenderer.invoke('recent:list'),
  addRecentFile: (entry: unknown) => ipcRenderer.invoke('recent:add', entry),
  removeRecentFile: (path: string) => ipcRenderer.invoke('recent:remove', path),
  clearRecentFiles: () => ipcRenderer.invoke('recent:clear'),

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('settings:set', settings),

  // 安全存储
  secureGet: (key: string) => ipcRenderer.invoke('secure:get', key),
  secureSet: (key: string, value: string) => ipcRenderer.invoke('secure:set', key, value),
  secureDelete: (key: string) => ipcRenderer.invoke('secure:delete', key),

  // 应用信息 / 窗口
  appVersion: () => ipcRenderer.invoke('app:version'),
  platform: () => ipcRenderer.invoke('app:platform'),
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximize: () => ipcRenderer.invoke('win:maximize'),
  close: () => ipcRenderer.invoke('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  onMaximizedChange: (cb: (max: boolean) => void) => {
    const handler = (_e: unknown, max: boolean) => cb(max);
    ipcRenderer.on('window:maximized', handler);
    return () => ipcRenderer.removeListener('window:maximized', handler);
  },
  onOpenFile: (cb: (path: string) => void) => {
    const handler = (_e: unknown, path: string) => cb(path);
    ipcRenderer.on('menu:open', handler);
    return () => ipcRenderer.removeListener('menu:open', handler);
  },
};

contextBridge.exposeInMainWorld('pdfStudio', bridge);
