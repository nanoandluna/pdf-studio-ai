// ============================================================
// menuChannels — renderer 侧菜单频道常量 + store action 映射
// 主进程侧对应列表见 electron/menuChannels.ts（一致性由测试保证）
// ============================================================

import { useDocumentStore } from '@stores/documentStore';
import { useViewerStore } from '@stores/viewerStore';
import { useWorkspaceStore } from '@stores/workspaceStore';

export const MENU_CHANNELS = [
  'menu:open',
  'menu:save',
  'menu:save-as',
  'menu:undo',
  'menu:redo',
  'menu:zoom-in',
  'menu:zoom-out',
  'menu:zoom-100',
  'menu:fit-width',
  'menu:fit-page',
  'menu:reading-mode',
  'menu:sidebar',
  'menu:ai-panel',
  'menu:search',
  'menu:merge',
  'menu:split',
  'menu:ocr',
  'menu:about',
] as const;

export type MenuChannel = (typeof MENU_CHANNELS)[number];

export function isMenuChannel(v: string): v is MenuChannel {
  return (MENU_CHANNELS as readonly string[]).includes(v);
}

/**
 * 把菜单频道映射为 store action。返回 null 表示该频道需要 React state
 * 处理（merge/split/ocr/about → 打开对应对话框），由 App.tsx 接管。
 * 返回值统一包装为可安全调用的 async 函数（吞掉异常，避免 unhandled rejection）。
 */
export function menuStoreAction(channel: MenuChannel): (() => Promise<void>) | null {
  const run = (fn: () => unknown) => async () => {
    try {
      await fn();
    } catch {
      // 菜单动作不应产生 unhandled rejection
    }
  };
  switch (channel) {
    case 'menu:open':
      return run(() => useDocumentStore.getState().openFile());
    case 'menu:save':
      return run(() => useDocumentStore.getState().save(false));
    case 'menu:save-as':
      return run(() => useDocumentStore.getState().save(true));
    case 'menu:undo':
      return run(() => useDocumentStore.getState().undo());
    case 'menu:redo':
      return run(() => useDocumentStore.getState().redo());
    case 'menu:zoom-in':
      return run(() => useViewerStore.getState().zoomIn());
    case 'menu:zoom-out':
      return run(() => useViewerStore.getState().zoomOut());
    case 'menu:zoom-100':
      return run(() => useViewerStore.getState().setScale(1));
    case 'menu:fit-width':
      return run(() => useViewerStore.getState().fitWidth());
    case 'menu:fit-page':
      return run(() => useViewerStore.getState().fitPage());
    case 'menu:reading-mode':
      return run(() => useWorkspaceStore.getState().toggleReadingMode());
    case 'menu:sidebar':
      return run(() => useWorkspaceStore.getState().toggleSidebar());
    case 'menu:ai-panel':
      return run(() => useWorkspaceStore.getState().toggleAiPanel());
    case 'menu:search':
      return run(() => useViewerStore.getState().setSearchOpen(true));
    case 'menu:merge':
    case 'menu:split':
    case 'menu:ocr':
    case 'menu:about':
      return null;
  }
}
