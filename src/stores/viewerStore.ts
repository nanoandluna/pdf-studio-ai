// ============================================================
// viewerStore — Viewer 视图状态（缩放、当前页、滚动、选择）
// ============================================================

import { create } from 'zustand';

export type ZoomMode = 'fit-width' | 'fit-page' | 'custom';

interface ViewerState {
  currentPage: number; // 0-based 当前可见页（原索引）
  scale: number; // 当前缩放
  zoomMode: ZoomMode;
  /** 是否显示搜索栏 */
  searchOpen: boolean;
  searchQuery: string;
  /** 选中的页面（原索引） */
  selectedPages: Set<number>;
  /** 是否允许多选（Ctrl/Shift） */
  multiSelect: boolean;
  /** 编辑工具模式（null = 查看） */
  tool: 'select' | 'text' | 'highlight' | 'rectangle' | 'arrow' | 'pen' | 'eraser' | null;
  /** 框选文本（Selected Text → AI） */
  selection: { pageIndex: number; text: string; x: number; y: number; width: number; height: number } | null;

  setCurrentPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  gotoPage: (page: number) => void; // 1-based
  setScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitWidth: () => void;
  fitPage: () => void;
  setSearchOpen: (open: boolean) => void;
  setSearchQuery: (q: string) => void;
  selectPage: (index: number, additive: boolean) => void;
  clearSelection: () => void;
  setTool: (tool: ViewerState['tool']) => void;
  setTextSelection: (sel: ViewerState['selection']) => void;
  clearTextSelection: () => void;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

export const useViewerStore = create<ViewerState>((set, get) => ({
  currentPage: 0,
  scale: 1,
  zoomMode: 'fit-width',
  searchOpen: false,
  searchQuery: '',
  selectedPages: new Set(),
  multiSelect: false,
  tool: null,
  selection: null,

  setCurrentPage: (page) => set({ currentPage: page }),

  nextPage: () => {
    const { currentPage } = get();
    set({ currentPage: currentPage + 1 });
  },

  prevPage: () => {
    const { currentPage } = get();
    set({ currentPage: Math.max(0, currentPage - 1) });
  },

  gotoPage: (page) => {
    set({ currentPage: Math.max(0, page - 1) });
  },

  setScale: (scale) => {
    set({ scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale)), zoomMode: 'custom' });
  },

  zoomIn: () => {
    const { scale } = get();
    set({ scale: Math.min(MAX_SCALE, scale * 1.25), zoomMode: 'custom' });
  },

  zoomOut: () => {
    const { scale } = get();
    set({ scale: Math.max(MIN_SCALE, scale / 1.25), zoomMode: 'custom' });
  },

  fitWidth: () => set({ zoomMode: 'fit-width' }),
  fitPage: () => set({ zoomMode: 'fit-page' }),

  setSearchOpen: (open) => set({ searchOpen: open }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  selectPage: (index, additive) => {
    const { selectedPages, multiSelect } = get();
    if (additive && multiSelect) {
      const next = new Set(selectedPages);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      set({ selectedPages: next });
    } else {
      set({ selectedPages: new Set([index]) });
    }
  },

  clearSelection: () => set({ selectedPages: new Set() }),

  setTool: (tool) => set({ tool }),

  setTextSelection: (sel) => set({ selection: sel }),
  clearTextSelection: () => set({ selection: null }),
}));
