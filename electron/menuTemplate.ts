// ============================================================
// menuTemplate — 应用菜单模板（纯函数，可在 node 环境下测试）
// 带 click 的菜单项统一走 sendToRenderer('menu:*') → IPC → preload
// 桥接为 DOM 事件 → App.tsx 统一分发到 store action。单一入口。
// ============================================================

import type { MenuItemConstructorOptions } from 'electron';
import { type MenuChannel } from './menuChannels';

export interface MenuTemplateOptions {
  /** 是否 macOS（默认按 process.platform 判断，测试可显式传入） */
  isMac?: boolean;
  /** 开发模式（生产构建不带 DevTools 菜单） */
  isDev?: boolean;
  /** 把菜单事件投递到渲染进程（由 main.ts 注入 webContents.send） */
  send: (channel: MenuChannel) => void;
}

export function buildMenuTemplate(opts: MenuTemplateOptions): MenuItemConstructorOptions[] {
  const { isMac = process.platform === 'darwin', isDev = false, send } = opts;
  const click = (ch: MenuChannel) => () => send(ch);

  return [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: '文件',
      submenu: [
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: click('menu:open') },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: click('menu:save') },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: click('menu:save-as') },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const, label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', click: click('menu:undo') },
        { label: '重做', accelerator: 'CmdOrCtrl+Shift+Z', click: click('menu:redo') },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        ...(isDev ? [{ role: 'toggleDevTools', label: '开发者工具' } as MenuItemConstructorOptions] : []),
        { type: 'separator' },
        { label: '实际大小', accelerator: 'CmdOrCtrl+0', click: click('menu:zoom-100') },
        { label: '放大', accelerator: 'CmdOrCtrl+=', click: click('menu:zoom-in') },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', click: click('menu:zoom-out') },
        { type: 'separator' },
        { label: '适应宽度', click: click('menu:fit-width') },
        { label: '适应页面', click: click('menu:fit-page') },
        { type: 'separator' },
        { label: '阅读模式', accelerator: 'CmdOrCtrl+Shift+R', click: click('menu:reading-mode') },
        { label: '侧边栏', accelerator: 'CmdOrCtrl+B', click: click('menu:sidebar') },
        { label: 'AI 面板', accelerator: 'CmdOrCtrl+E', click: click('menu:ai-panel') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '工具',
      submenu: [
        { label: '搜索', accelerator: 'CmdOrCtrl+F', click: click('menu:search') },
        { type: 'separator' },
        { label: '合并 PDF…', click: click('menu:merge') },
        { label: '拆分 PDF…', click: click('menu:split') },
        { type: 'separator' },
        { label: 'OCR 识别…', click: click('menu:ocr') },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '关于 PDF Studio AI', click: click('menu:about') },
      ],
    },
  ];
}

/** 遍历模板并触发每个 click，返回所有被投递的频道（测试友好，不依赖 Electron 运行时） */
export function collectMenuChannels(opts: Omit<MenuTemplateOptions, 'send'>): MenuChannel[] {
  const channels: MenuChannel[] = [];
  const template = buildMenuTemplate({
    ...opts,
    send: (ch) => channels.push(ch),
  });
  const walk = (items: MenuItemConstructorOptions[]) => {
    for (const item of items) {
      const click = (item as { click?: () => void }).click;
      if (click) click();
      const sub = (item as { submenu?: MenuItemConstructorOptions[] }).submenu;
      if (sub) walk(sub);
    }
  };
  walk(template);
  return channels;
}
