// ============================================================
// preload 暴露给 Renderer 的桥接 API 类型声明
// 实现见 electron/preload.ts（打包为 CJS）
// ============================================================

import type { AppSettings, RecentFileEntry } from '@domain/types';

/** 打开文件对话框返回 */
export interface OpenFileResult {
  path: string;
  name: string;
  data: ArrayBuffer;
  cancelled: boolean;
}

export interface SaveFileResult {
  path: string;
  cancelled: boolean;
}

export interface FileDialogOptions {
  /** 对话框标题 */
  title?: string;
  /** 过滤，例如 [{ name: 'PDF', extensions: ['pdf'] }] */
  filters?: { name: string; extensions: string[] }[];
  /** 多选 */
  multiSelections?: boolean;
  /** 默认路径（保存时） */
  defaultPath?: string;
}

export interface IpcBridge {
  // ---- 文件对话框与读写 ----
  openFileDialog(opts?: FileDialogOptions): Promise<OpenFileResult>;
  openFilesDialog(opts?: FileDialogOptions): Promise<{ files: { path: string; name: string; data: ArrayBuffer }[]; cancelled: boolean }>;
  saveFileDialog(opts?: FileDialogOptions): Promise<SaveFileResult>;
  selectDirectory(opts?: FileDialogOptions): Promise<{ path: string | null }>;
  readFile(path: string): Promise<ArrayBuffer>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  fileExists(path: string): Promise<boolean>;

  // ---- 最近文件 & 设置（主进程持久化，JSON + safeStorage 加密 API Key）----
  getRecentFiles(): Promise<RecentFileEntry[]>;
  addRecentFile(entry: Omit<RecentFileEntry, 'available'>): Promise<RecentFileEntry[]>;
  removeRecentFile(path: string): Promise<void>;
  clearRecentFiles(): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;

  // ---- 安全存储（API Key 加密）----
  secureGet(key: string): Promise<string | null>;
  secureSet(key: string, value: string): Promise<void>;
  secureDelete(key: string): Promise<void>;

  // ---- 应用信息 ----
  appVersion(): Promise<string>;
  platform(): Promise<string>;

  // ---- 窗口 ----
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onMaximizedChange(cb: (max: boolean) => void): () => void;
  onOpenFile(cb: (path: string) => void): () => void;
}

declare global {
  interface Window {
    pdfStudio: IpcBridge;
  }
}
