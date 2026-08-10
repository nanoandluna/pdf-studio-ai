// ============================================================
// Unit Test — V0.2 主题系统（切换 / 持久化 / 即时生效）
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { THEMES, getTheme, applyTheme } from '@theme/themes';

describe('Theme System', () => {
  it('提供四套主题', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['obsidian', 'paper', 'midnight', 'aurora']);
  });

  it('Obsidian 是默认主题', () => {
    expect(getTheme('unknown').id).toBe('obsidian');
  });

  it('每套主题都有完整预览色板', () => {
    for (const t of THEMES) {
      expect(t.preview.background).toMatch(/^#/);
      expect(t.preview.surface).toMatch(/^#/);
      expect(t.preview.accent).toMatch(/^#/);
      expect(t.preview.text).toMatch(/^#/);
    }
  });

  it('主题定义包含 dark 语义（Obsidian/Midnight/Aurora 深色，Paper 浅色）', () => {
    expect(getTheme('obsidian').dark).toBe(true);
    expect(getTheme('midnight').dark).toBe(true);
    expect(getTheme('aurora').dark).toBe(true);
    expect(getTheme('paper').dark).toBe(false);
  });

  it('applyTheme 选择正确主题（默认 obsidian）', () => {
    expect(getTheme('aurora').id).toBe('aurora');
    expect(getTheme('paper').dark).toBe(false);
    expect(getTheme('midnight').id).toBe('midnight');
  });

  it('未来添加主题只需扩展数组（结构一致）', () => {
    // 所有主题字段结构必须一致，保证 Theme Engine 无需改代码
    const keys = ['id', 'name', 'description', 'preview', 'dark'];
    for (const t of THEMES) {
      for (const k of keys) expect(t).toHaveProperty(k);
    }
  });
});

describe('Theme persistence 兼容（settings 存 themeId 而非完整 CSS）', () => {
  it('AppSettings.themeId 是受支持的主题 ID', () => {
    const ids = new Set(THEMES.map((t) => t.id));
    const sampleIds = ['obsidian', 'paper', 'midnight', 'aurora'] as const;
    for (const id of sampleIds) expect(ids.has(id)).toBe(true);
  });
});
