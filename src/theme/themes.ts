// ============================================================
// Theme System — 主题定义与 API
// V0.2 四套主题：Obsidian（默认）/ Paper / Midnight / Aurora
// 未来新增主题只需在这里添加定义 + 在 tokens.css 添加 CSS 变量
// ============================================================

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  /** 预览色板（设置页 ThemeCard 使用） */
  preview: {
    background: string;
    surface: string;
    accent: string;
    text: string;
  };
  /** 语义：深色系 = true（影响 color-scheme / 默认文字色） */
  dark: boolean;
}

export type ThemeId = 'obsidian' | 'paper' | 'midnight' | 'aurora';

export const THEMES: Theme[] = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    description: '专业 / 开发者 / AI 深色 · 默认主题',
    preview: {
      background: '#0B0D10',
      surface: '#16181D',
      accent: '#6E6AF6',
      text: '#E6E7EB',
    },
    dark: true,
  },
  {
    id: 'paper',
    name: 'Paper',
    description: '阅读 / 论文 / 办公 · 暖白',
    preview: {
      background: '#FAF9F6',
      surface: '#FFFFFF',
      accent: '#2B59C3',
      text: '#23272E',
    },
    dark: false,
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'AI / 科技 / 深蓝黑',
    preview: {
      background: '#05070F',
      surface: '#0C1226',
      accent: '#38BDF8',
      text: '#DCE7F5',
    },
    dark: true,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: '高级 AI · 玻璃质感',
    preview: {
      background: '#0A0A14',
      surface: '#151526',
      accent: '#A78BFA',
      text: '#ECE9F7',
    },
    dark: true,
  },
];

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** 将主题应用到 document（CSS 变量由 [data-theme] 选择器驱动） */
export function applyTheme(themeId: ThemeId): void {
  const root = document.documentElement;
  root.dataset.theme = themeId;
  const theme = getTheme(themeId);
  // 兼容旧的 dark: 变体
  root.classList.toggle('dark', theme.dark);
  // color-scheme 影响原生控件（滚动条、输入框等）
  root.style.colorScheme = theme.dark ? 'dark' : 'light';
}
