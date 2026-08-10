// ============================================================
// workspaceStore — 工作区布局状态（V0.2）
// Sidebar 折叠 / AI Panel 折叠+尺寸 / Reading Mode / AI Focus
// ============================================================

import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';

export type AIPanelMode = 'normal' | 'focus';

interface WorkspaceState {
  sidebarCollapsed: boolean;
  aiPanelOpen: boolean;
  aiPanelWidth: number; // px
  aiMode: AIPanelMode;
  readingMode: boolean;

  toggleSidebar: () => Promise<void>;
  setAiPanelOpen: (open: boolean) => void;
  toggleAiPanel: () => void;
  setAiPanelWidth: (w: number) => void;
  setAiMode: (m: AIPanelMode) => void;
  toggleReadingMode: () => void;
  exitReadingMode: () => void;
}

export const AI_PANEL_MIN = 320;
export const AI_PANEL_MAX = 720;

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  sidebarCollapsed: false,
  aiPanelOpen: true,
  aiPanelWidth: 380,
  aiMode: 'normal',
  readingMode: false,

  toggleSidebar: async () => {
    const next = !get().sidebarCollapsed;
    set({ sidebarCollapsed: next });
    // 持久化
    await useSettingsStore.getState().update({ sidebarCollapsed: next });
  },

  setAiPanelOpen: (open: boolean) => set({ aiPanelOpen: open }),
  toggleAiPanel: () => set((s) => ({ aiPanelOpen: !s.aiPanelOpen })),

  setAiPanelWidth: (w) => {
    const clamped = Math.max(AI_PANEL_MIN, Math.min(AI_PANEL_MAX, w));
    set({ aiPanelWidth: clamped });
  },

  setAiMode: (m) => set({ aiMode: m }),

  toggleReadingMode: () => set((s) => ({ readingMode: !s.readingMode })),
  exitReadingMode: () => set({ readingMode: false }),
}));
