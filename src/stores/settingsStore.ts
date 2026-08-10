// ============================================================
// settingsStore — 应用设置（V0.2 主题系统）
// ============================================================

import { create } from 'zustand';
import type { AppSettings, ThemeId, ThemeMode } from '@domain/types';
import { applyTheme } from '@theme/themes';

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  themeId: 'obsidian',
  language: 'zh-CN',
  aiDataNotice: true,
  sidebarCollapsed: false,
};

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  load: () => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setThemeId: (id: ThemeId) => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      const settings = await window.pdfStudio.getSettings();
      const merged = { ...DEFAULT_SETTINGS, ...settings };
      set({ settings: merged, loaded: true });
      applyTheme(merged.themeId);
    } catch {
      set({ loaded: true });
      applyTheme('obsidian');
    }
  },

  setTheme: async (theme) => {
    const next = { ...get().settings, theme };
    set({ settings: next });
    await window.pdfStudio.saveSettings(next);
  },

  setThemeId: async (id) => {
    applyTheme(id);
    const next = { ...get().settings, themeId: id };
    set({ settings: next });
    await window.pdfStudio.saveSettings(next);
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    if (next.themeId) applyTheme(next.themeId);
    await window.pdfStudio.saveSettings(next);
  },
}));
