// ============================================================
// Regression Test — 原生菜单（menu:*) 链路
// 背景：主进程菜单点击走 webContents.send('menu:*')（IPC），而
// App.tsx 原本只监听 window 上的同名 DOM 事件 → IPC 与 DOM 不匹配，
// 菜单点击静默失效。修复为 preload 桥接 IPC→CustomEvent + App.tsx
// 统一用 menuStoreAction 分发。此测试锁定该链路不被破坏。
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildMenuTemplate, collectMenuChannels } from '../electron/menuTemplate';
import { MENU_CHANNELS as MAIN_MENU_CHANNELS } from '../electron/menuChannels';
import {
  MENU_CHANNELS as RENDERER_MENU_CHANNELS,
  menuStoreAction,
  isMenuChannel,
  type MenuChannel,
} from '../src/lib/menuChannels';
import { useViewerStore } from '../src/stores/viewerStore';
import { useWorkspaceStore } from '../src/stores/workspaceStore';

// ---------- node 环境下的 window stub（避免真实触碰 Electron IPC） ----------
const originalWindow = (globalThis as { window?: unknown }).window;

function installWindowStub(): void {
  (globalThis as { window?: unknown }).window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    pdfStudio: {
      openFileDialog: async () => ({ cancelled: true, filePaths: [] }),
      saveFileDialog: async () => ({ cancelled: true, filePath: '' }),
      saveSettings: async () => {},
      getSettings: async () => ({}),
      getRecentFiles: async () => [],
      addRecentFile: async () => {},
      readFile: async () => new ArrayBuffer(0),
    },
  } as unknown as Window & typeof globalThis;
}

function restoreWindow(): void {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
}

beforeEach(() => {
  installWindowStub();
  useViewerStore.setState({
    scale: 1,
    zoomMode: 'fit-width',
    searchOpen: false,
  });
  useWorkspaceStore.setState({ readingMode: false, aiPanelOpen: true, sidebarCollapsed: false });
});

afterEach(() => {
  restoreWindow();
});

// ---------- 1. 主进程与 renderer 的频道列表必须一致 ----------
describe('菜单频道列表一致性', () => {
  it('electron/menuChannels 与 src/lib/menuChannels 完全一致', () => {
    expect(RENDERER_MENU_CHANNELS).toEqual(MAIN_MENU_CHANNELS);
  });

  it('列表无重复项', () => {
    expect(new Set(RENDERER_MENU_CHANNELS).size).toBe(RENDERER_MENU_CHANNELS.length);
  });
});

// ---------- 2. 菜单模板结构 ----------
describe('菜单模板', () => {
  it('模板收集的点击频道 = 全部 MENU_CHANNELS（无遗漏 / 无拼错）', () => {
    const channels = collectMenuChannels({ isMac: false });
    for (const ch of channels) {
      expect(isMenuChannel(ch)).toBe(true);
    }
    expect(new Set(channels)).toEqual(new Set(RENDERER_MENU_CHANNELS));
  });

  it('顶层包含 文件 / 编辑 / 视图 / 工具 / 帮助', () => {
    const template = buildMenuTemplate({ isMac: false, send: () => {} });
    const labels = template.map((item) => (item as { label?: string }).label).filter(Boolean);
    expect(labels).toEqual(['文件', '编辑', '视图', '工具', '帮助']);
  });

  it('文件菜单含 打开/保存/另存为', () => {
    const template = buildMenuTemplate({ isMac: false, send: () => {} });
    const fileMenu = template[0] as { submenu: { label?: string }[] };
    const labels = fileMenu.submenu.map((i) => i.label).filter(Boolean);
    expect(labels).toContain('打开…');
    expect(labels).toContain('保存');
    expect(labels).toContain('另存为…');
  });

  it('工具菜单含 搜索/合并/拆分/OCR', () => {
    const template = buildMenuTemplate({ isMac: false, send: () => {} });
    const toolMenu = template[3] as { submenu: { label?: string }[] };
    const labels = toolMenu.submenu.map((i) => i.label).filter(Boolean);
    expect(labels).toEqual(['搜索', '合并 PDF…', '拆分 PDF…', 'OCR 识别…']);
  });

  it('关键快捷键 accelerator 存在（菜单接管后 renderer 不再重复处理）', () => {
    const template = buildMenuTemplate({ isMac: false, send: () => {} });
    const acc: string[] = [];
    const walk = (items: { accelerator?: string; submenu?: unknown[] }[]) => {
      for (const item of items) {
        if (item.accelerator) acc.push(item.accelerator);
        if (Array.isArray(item.submenu)) walk(item.submenu as { accelerator?: string; submenu?: unknown[] }[]);
      }
    };
    walk(template as { accelerator?: string; submenu?: unknown[] }[]);
    for (const expected of [
      'CmdOrCtrl+O',
      'CmdOrCtrl+S',
      'CmdOrCtrl+Shift+S',
      'CmdOrCtrl+Z',
      'CmdOrCtrl+Shift+Z',
      'CmdOrCtrl+=',
      'CmdOrCtrl+-',
      'CmdOrCtrl+0',
      'CmdOrCtrl+Shift+R',
      'CmdOrCtrl+B',
      'CmdOrCtrl+E',
      'CmdOrCtrl+F',
    ]) {
      expect(acc).toContain(expected);
    }
  });
});

// ---------- 3. menuStoreAction 对 store 的实际效果 ----------
describe('menuStoreAction 分发（viewer）', () => {
  it('menu:zoom-in 放大 scale', async () => {
    const before = useViewerStore.getState().scale;
    await menuStoreAction('menu:zoom-in')!();
    expect(useViewerStore.getState().scale).toBeGreaterThan(before);
  });

  it('menu:zoom-out 缩小 scale', async () => {
    useViewerStore.setState({ scale: 2 });
    await menuStoreAction('menu:zoom-out')!();
    expect(useViewerStore.getState().scale).toBeLessThan(2);
  });

  it('menu:zoom-100 重置为 1', async () => {
    useViewerStore.setState({ scale: 3.5 });
    await menuStoreAction('menu:zoom-100')!();
    expect(useViewerStore.getState().scale).toBe(1);
  });

  it('menu:fit-width / menu:fit-page 切换缩放模式', async () => {
    await menuStoreAction('menu:fit-width')!();
    expect(useViewerStore.getState().zoomMode).toBe('fit-width');
    await menuStoreAction('menu:fit-page')!();
    expect(useViewerStore.getState().zoomMode).toBe('fit-page');
  });

  it('menu:search 打开搜索栏', async () => {
    await menuStoreAction('menu:search')!();
    expect(useViewerStore.getState().searchOpen).toBe(true);
  });
});

describe('menuStoreAction 分发（workspace）', () => {
  it('menu:reading-mode 切换阅读模式', async () => {
    expect(useWorkspaceStore.getState().readingMode).toBe(false);
    await menuStoreAction('menu:reading-mode')!();
    expect(useWorkspaceStore.getState().readingMode).toBe(true);
    await menuStoreAction('menu:reading-mode')!();
    expect(useWorkspaceStore.getState().readingMode).toBe(false);
  });

  it('menu:ai-panel 切换 AI 面板', async () => {
    expect(useWorkspaceStore.getState().aiPanelOpen).toBe(true);
    await menuStoreAction('menu:ai-panel')!();
    expect(useWorkspaceStore.getState().aiPanelOpen).toBe(false);
  });

  it('menu:sidebar 切换侧边栏（window stub 下不抛异常）', async () => {
    await expect(menuStoreAction('menu:sidebar')!()).resolves.toBeUndefined();
    expect(useWorkspaceStore.getState().sidebarCollapsed).toBe(true);
  });
});

// ---------- 4. 需要 React state 的频道（merge/split/ocr/about）----------
describe('menuStoreAction 对对话框频道返回 null', () => {
  it('merge / split / ocr / about 交给 App.tsx（React state）处理', () => {
    for (const ch of ['menu:merge', 'menu:split', 'menu:ocr', 'menu:about'] as MenuChannel[]) {
      expect(menuStoreAction(ch)).toBeNull();
    }
  });
});

// ---------- 5. 文档类频道在无文档时安全无操作 ----------
describe('menuStoreAction 分发（document）', () => {
  it('menu:open / save / save-as / undo / redo 不抛异常（无文档，window stub）', async () => {
    for (const ch of ['menu:open', 'menu:save', 'menu:save-as', 'menu:undo', 'menu:redo'] as MenuChannel[]) {
      const fn = menuStoreAction(ch)!;
      await expect(fn()).resolves.not.toThrow();
    }
  });
});
