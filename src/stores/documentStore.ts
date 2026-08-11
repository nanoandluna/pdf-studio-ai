// ============================================================
// documentStore — 文档生命周期、页面操作、Undo/Redo、保存
// 这是整个应用的核心状态
// ============================================================

import { create } from 'zustand';
import type { PdfDocument, PdfPage, Annotation } from '@domain/types';
import { PdfjsViewEngine } from '@engine/pdfjsEngine';
import { PdfLibEditEngine, identityOperations, applyOperations } from '@engine/pdfLibEngine';
import type { PdfEditOperations } from '@engine/types';
import { CommandHistory, type PdfCommand } from '@commands/types';
import { logger } from '@lib/logger';
import { FriendlyError, toFriendlyError } from '@lib/errors';
import { cancelAiRequests } from '@lib/aiAbort';
import { useRecentFilesStore } from './recentFilesStore';

export const viewEngine = new PdfjsViewEngine();
export const editEngine = new PdfLibEditEngine();
export const commandHistory = new CommandHistory();

/** 打开文档时的原始字节缓存（保存时重建用） */
let sourceBytes: ArrayBuffer | null = null;
let sourcePath = '';

export interface PageThumb {
  index: number; // 原索引
  label: string;
  dataUrl: string;
  width: number;
  height: number;
}

interface DocumentState {
  document: PdfDocument | null;
  /** 当前可见页面顺序（存原索引） */
  pageOrder: number[];
  /** 每页附加旋转（原索引 → 角度） */
  pageRotations: Record<number, number>;
  /** 已删除页（原索引集合） */
  deletedPages: Set<number>;
  /** 标注（按原页索引） */
  annotations: Annotation[];
  thumbnails: PageThumb[];
  loading: boolean;
  error: string | null;
  dirty: boolean;

  // ---- 动作 ----
  openFile: (path?: string) => Promise<void>;
  openBytes: (data: ArrayBuffer, path: string, name: string) => Promise<void>;
  closeDocument: () => Promise<void>;
  save: (saveAs?: boolean) => Promise<boolean>;
  getCurrentBytes: () => Promise<Uint8Array>;

  // ---- 页面操作（经 Command，支持 undo）----
  deletePages: (pageIndexes: number[]) => Promise<void>;
  rotatePages: (pageIndexes: number[], angle: number) => Promise<void>;
  reorderPages: (newOrder: number[]) => Promise<void>;
  extractPages: (pageIndexes: number[]) => Promise<string | null>;

  undo: () => Promise<void>;
  redo: () => Promise<void>;

  // ---- 标注 ----
  addAnnotation: (ann: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;

  // ---- 缩略图 ----
  loadThumbnails: () => Promise<void>;
  refreshThumbnail: (index: number) => Promise<void>;

  setError: (msg: string | null) => void;
  clearError: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  document: null,
  pageOrder: [],
  pageRotations: {},
  deletedPages: new Set(),
  annotations: [],
  thumbnails: [],
  loading: false,
  error: null,
  dirty: false,

  openFile: async (path) => {
    const store = get();
    if (path) {
      try {
        const exists = await window.pdfStudio.fileExists(path);
        if (!exists) {
          set({ error: '无法打开文件：文件可能已经被移动或删除。' });
          return;
        }
        const data = await window.pdfStudio.readFile(path);
        const name = path.split(/[\\/]/).pop() || path;
        await store.openBytes(data, path, name);
      } catch (e) {
        const err = toFriendlyError(e, '无法打开文件，请稍后重试。');
        set({ error: err.friendly, loading: false });
      }
      return;
    }
    // 无路径：弹对话框
    try {
      const res = await window.pdfStudio.openFileDialog({
        title: '打开 PDF',
        filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
      });
      if (res.cancelled) return;
      await store.openBytes(res.data, res.path, res.name);
    } catch (e) {
      const err = toFriendlyError(e, '无法打开文件，请稍后重试。');
      set({ error: err.friendly });
    }
  },

  openBytes: async (data, path, name) => {
    set({ loading: true, error: null });
    // #8：文档切换时取消在途 AI 请求（避免流式写脏/对旧 doc 提取文本）
    cancelAiRequests();
    try {
      // 释放旧文档
      const old = get().document;
      if (old) await viewEngine.dispose(old.id).catch(() => undefined);
      const doc = await viewEngine.open(data, path, name);
      sourceBytes = data;
      sourcePath = path;
      const pageCount = doc.pageCount;
      set({
        document: doc,
        pageOrder: Array.from({ length: pageCount }, (_, i) => i),
        pageRotations: {},
        deletedPages: new Set(),
        annotations: [],
        thumbnails: [],
        dirty: false,
        loading: false,
      });
      commandHistory.clear();
      // 记录最近文件
      await useRecentFilesStore.getState().add({
        path,
        name,
        lastOpenedAt: Date.now(),
        pageCount,
      });
      await get().loadThumbnails();
      logger.info('打开文档', { path, pageCount });
    } catch (e) {
      const err = toFriendlyError(e, '无法打开该 PDF：文件可能损坏或格式不受支持。');
      set({ loading: false, error: err.friendly });
    }
  },

  closeDocument: async () => {
    // #8：关闭文档时取消在途 AI 请求
    cancelAiRequests();
    const { document } = get();
    if (document) await viewEngine.dispose(document.id).catch(() => undefined);
    sourceBytes = null;
    sourcePath = '';
    commandHistory.clear();
    set({
      document: null,
      pageOrder: [],
      pageRotations: {},
      deletedPages: new Set(),
      annotations: [],
      thumbnails: [],
      dirty: false,
      error: null,
    });
  },

  getCurrentBytes: async () => {
    const { document, pageOrder, pageRotations, deletedPages } = get();
    if (!document || !sourceBytes) throw new FriendlyError('当前没有打开的文档。');
    const ops: PdfEditOperations = {
      pageOrder,
      pageRotations,
      deletedPages: Array.from(deletedPages),
    };
    return editEngine.build(sourceBytes, ops);
  },

  save: async (saveAs = false) => {
    const { document, pageOrder, pageRotations, deletedPages } = get();
    if (!document || !sourceBytes) {
      set({ error: '当前没有打开的文档，无法保存。' });
      return false;
    }
    try {
      const ops: PdfEditOperations = {
        pageOrder,
        pageRotations,
        deletedPages: Array.from(deletedPages),
      };
      const bytes = await editEngine.build(sourceBytes, ops);
      let outPath = sourcePath;
      if (saveAs || !sourcePath) {
        const res = await window.pdfStudio.saveFileDialog({
          title: '另存为 PDF',
          defaultPath: document.name.replace(/\.pdf$/i, '') + '-edited.pdf',
          filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
        });
        if (res.cancelled) return false;
        outPath = res.path;
      }
      await window.pdfStudio.writeFile(outPath, bytes);
      // 保存后：sourceBytes 更新为新内容，文档复位为"未修改"
      const savedBytes = new Uint8Array(bytes);
      sourceBytes = savedBytes.buffer.slice(savedBytes.byteOffset, savedBytes.byteOffset + savedBytes.byteLength) as ArrayBuffer;
      sourcePath = outPath;
      set({
        dirty: false,
        document: {
          ...document,
          path: outPath,
          name: outPath.split(/[\\/]/).pop() || document.name,
          modified: false,
        },
      });
      return true;
    } catch (e) {
      const err = toFriendlyError(e, '保存失败，请检查文件是否被占用或路径是否可写。');
      set({ error: err.friendly });
      return false;
    }
  },

  // ================= 页面操作命令 =================

  deletePages: async (pageIndexes) => {
    const { document, deletedPages } = get();
    if (!document) return;
    const toDelete = pageIndexes.filter((i) => !deletedPages.has(i));
    if (toDelete.length === 0) return;
    const cmd: PdfCommand = {
      id: crypto.randomUUID(),
      name: '删除页面',
      description: `删除 ${toDelete.length} 页`,
      execute: async () => {
        const next = new Set(get().deletedPages);
        toDelete.forEach((i) => next.add(i));
        set({ deletedPages: next, dirty: true });
      },
      undo: async () => {
        const next = new Set(get().deletedPages);
        toDelete.forEach((i) => next.delete(i));
        set({ deletedPages: next, dirty: true });
      },
    };
    await commandHistory.execute(cmd);
  },

  rotatePages: async (pageIndexes, angle) => {
    const { document, pageRotations } = get();
    if (!document) return;
    const norm = ((angle % 360) + 360) % 360;
    const cmd: PdfCommand = {
      id: crypto.randomUUID(),
      name: '旋转页面',
      description: `旋转 ${pageIndexes.length} 页 ${norm}°`,
      execute: async () => {
        const next = { ...get().pageRotations };
        pageIndexes.forEach((i) => {
          next[i] = ((next[i] ?? 0) + norm) % 360;
        });
        set({ pageRotations: next, dirty: true });
        // 刷新缩略图
        for (const i of pageIndexes) await get().refreshThumbnail(i);
      },
      undo: async () => {
        const next = { ...get().pageRotations };
        pageIndexes.forEach((i) => {
          next[i] = ((next[i] ?? 0) - norm + 360) % 360;
        });
        set({ pageRotations: next, dirty: true });
        for (const i of pageIndexes) await get().refreshThumbnail(i);
      },
    };
    await commandHistory.execute(cmd);
  },

  reorderPages: async (newOrder) => {
    const { document, pageOrder } = get();
    if (!document) return;
    if (newOrder.length !== pageOrder.length) return;
    if (newOrder.every((v, i) => v === pageOrder[i])) return;
    const prev = [...pageOrder];
    const cmd: PdfCommand = {
      id: crypto.randomUUID(),
      name: '调整页面顺序',
      description: '拖拽排序页面',
      execute: async () => {
        set({ pageOrder: [...newOrder], dirty: true });
      },
      undo: async () => {
        set({ pageOrder: prev, dirty: true });
      },
    };
    await commandHistory.execute(cmd);
  },

  extractPages: async (pageIndexes) => {
    const { document } = get();
    if (!document || !sourceBytes) {
      set({ error: '当前没有打开的文档。' });
      return null;
    }
    try {
      const res = await window.pdfStudio.saveFileDialog({
        title: '提取页面为 PDF',
        defaultPath: `${document.name.replace(/\.pdf$/i, '')}-extract.pdf`,
        filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
      });
      if (res.cancelled) return null;
      const ops: PdfEditOperations = {
        pageOrder: pageIndexes,
        pageRotations: {},
        deletedPages: [],
      };
      const bytes = await editEngine.build(sourceBytes, ops);
      await window.pdfStudio.writeFile(res.path, bytes);
      return res.path;
    } catch (e) {
      const err = toFriendlyError(e, '提取页面失败，请稍后重试。');
      set({ error: err.friendly });
      return null;
    }
  },

  undo: async () => {
    const cmd = await commandHistory.undo();
    if (cmd) logger.debug('Undo', { name: cmd.name });
  },

  redo: async () => {
    const cmd = await commandHistory.redo();
    if (cmd) logger.debug('Redo', { name: cmd.name });
  },

  // ================= 标注 =================

  addAnnotation: (ann) => {
    set((s) => ({ annotations: [...s.annotations, ann] }));
  },

  updateAnnotation: (id, patch) => {
    set((s) => ({
      annotations: s.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
  },

  removeAnnotation: (id) => {
    set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) }));
  },

  clearAnnotations: () => {
    set({ annotations: [] });
  },

  // ================= 缩略图 =================

  loadThumbnails: async () => {
    const { document } = get();
    if (!document) return;
    const pageCount = document.pageCount;
    const thumbs: PageThumb[] = [];
    const load = async (i: number) => {
      try {
        const dataUrl = await viewEngine.renderPageToDataUrl(document.id, i, 0.5);
        thumbs[i] = { index: i, label: String(i + 1), dataUrl, width: 0, height: 0 };
        set({ thumbnails: [...thumbs.filter(Boolean)] });
      } catch {
        // 忽略缩略图失败
      }
    };
    const CONCURRENCY = 4;
    for (let i = 0; i < pageCount; i += CONCURRENCY) {
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, pageCount - i) }, (_, k) => load(i + k))
      );
    }
  },

  refreshThumbnail: async (index) => {
    const { document, pageRotations } = get();
    if (!document) return;
    try {
      const dataUrl = await viewEngine.renderPageToDataUrl(document.id, index, 0.5);
      set((s) => ({
        thumbnails: s.thumbnails.map((t) => (t.index === index ? { ...t, dataUrl } : t)),
      }));
    } catch {
      // 忽略
    }
  },

  setError: (msg) => set({ error: msg }),
  clearError: () => set({ error: null }),
}));

// ---- 便捷选择器（已被各组件用 useMemo 派生替代，避免 selector 返回新数组引发循环） ----
// 如需在 Viewer/Sidebar 中按派生字段使用，仍可从 store 直接取 pageOrder + deletedPages。
