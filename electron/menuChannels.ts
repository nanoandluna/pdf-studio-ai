// ============================================================
// menuChannels — 主进程 / preload 侧的菜单频道常量（单一来源）
// renderer 侧对应的 store 映射见 src/lib/menuChannels.ts。
// 两条列表必须保持一致：tests/menuRegression.test.ts 会校验。
// ============================================================

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
