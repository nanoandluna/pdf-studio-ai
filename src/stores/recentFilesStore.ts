// ============================================================
// recentFilesStore — 最近文件
// ============================================================

import { create } from 'zustand';
import type { RecentFileEntry } from '@domain/types';

interface RecentFilesState {
  files: RecentFileEntry[];
  load: () => Promise<void>;
  add: (entry: Omit<RecentFileEntry, 'available'>) => Promise<void>;
  remove: (path: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useRecentFilesStore = create<RecentFilesState>((set) => ({
  files: [],

  load: async () => {
    try {
      const files = await window.pdfStudio.getRecentFiles();
      set({ files });
    } catch {
      set({ files: [] });
    }
  },

  add: async (entry) => {
    try {
      const files = await window.pdfStudio.addRecentFile(entry);
      set({ files });
    } catch {
      // 静默失败，不影响主流程
    }
  },

  remove: async (path) => {
    await window.pdfStudio.removeRecentFile(path);
    set((s) => ({ files: s.files.filter((f) => f.path !== path) }));
  },

  clear: async () => {
    await window.pdfStudio.clearRecentFiles();
    set({ files: [] });
  },
}));
