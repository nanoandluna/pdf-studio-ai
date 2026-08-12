// ============================================================
// viewerStore — Viewer 视图状态（缩放、当前页、滚动、选择）
// ============================================================

import { create } from 'zustand';

export type ZoomMode = 'fit-width' | 'fit-page' | 'custom';

interface ViewerState {
  currentPage: number; // 0-based 当前可见页（原索引）
  /**
   * 用户显式导航目标（0-based）：缩略图点击 / 页码 / AI citation / 搜索跳转。
   * 与 currentPage 分离 —— passive 滚动检测只更新 currentPage 不触发滚动；
   * 只有 navigateTo 设置 navTarget（v0.4.0 rendering hotfix：currentPage 不再强制 scroll）
   */
  navTarget: number | null;
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

  /** 被动设置当前页（滚动检测/点击页面），不触发滚动 */
  setCurrentPage: (page: number) => void;
  /** 用户显式导航（缩略图/页码/citation/搜索）→ 更新当前页 + navTarget（触发滚动定位） */
  navigateTo: (page: number) => void;
  /** 清除导航目标（viewer 消费后调用） */
  clearNavTarget: () => void;
  nextPage: () => void;
  prevPage: () => void;
  gotoPage: (page: number) => void; // 1-based，等价 navigateTo
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
  navTarget: null,
  scale: 1,
  zoomMode: 'fit-width',
  searchOpen: false,
  searchQuery: '',
  selectedPages: new Set(),
  multiSelect: false,
  tool: null,
  selection: null,

  setCurrentPage: (page) => set({ currentPage: page }),

  navigateTo: (page) => {
    set({ currentPage: page, navTarget: page });
  },

  clearNavTarget: () => set({ navTarget: null }),

  nextPage: () => {
    const { currentPage } = get();
    set({ currentPage: currentPage + 1 });
  },

  prevPage: () => {
    const { currentPage } = get();
    set({ currentPage: Math.max(0, currentPage - 1) });
  },

  gotoPage: (page) => {
    set({ currentPage: Math.max(0, page - 1), navTarget: Math.max(0, page - 1) });
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
