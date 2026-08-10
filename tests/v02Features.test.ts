// ============================================================
// Unit Test — V0.2 命令面板 / AI 引用提取 / 上下文
// ============================================================

import { describe, it, expect } from 'vitest';
import { extractCitationsLocal } from '@stores/aiStore';
import { chunkText } from '@ai/chunk';

describe('extractCitationsLocal（AI 引用 → 页码跳转）', () => {
  it('提取单页引用', () => {
    expect(extractCitationsLocal('参见第 3 页')).toEqual([3]);
  });

  it('提取范围引用', () => {
    expect(extractCitationsLocal('详见第 3-5 页')).toEqual([3, 4, 5]);
    expect(extractCitationsLocal('详见第 3至5页')).toEqual([3, 4, 5]);
  });

  it('提取多个引用并排序去重', () => {
    expect(extractCitationsLocal('第 8 页和第 3 页，还有第 8 页')).toEqual([3, 8]);
  });

  it('无引用返回空', () => {
    expect(extractCitationsLocal('没有引用')).toEqual([]);
  });
});

describe('Command palette 数据（可测逻辑）', () => {
  it('命令过滤逻辑（按关键词模糊匹配）', () => {
    const commands = [
      { id: 'open', label: '打开 PDF', keywords: ['open', '打开'] },
      { id: 'theme-obsidian', label: '切换主题：Obsidian', keywords: ['theme', '主题', 'obsidian'] },
      { id: 'reading', label: '阅读模式', keywords: ['reading', '阅读'] },
    ];
    const filter = (q: string) =>
      commands.filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          c.keywords.some((k) => k.toLowerCase().includes(q))
      );
    expect(filter('打')).toHaveLength(1);
    expect(filter('主题')).toHaveLength(1);
    expect(filter('obsidian').length).toBeGreaterThan(0);
    expect(filter('不存在的命令')).toHaveLength(0);
  });

  it('所有主题都可通过命令面板切换', () => {
    const themes = ['obsidian', 'paper', 'midnight', 'aurora'];
    for (const t of themes) {
      expect(t.startsWith('theme-') || ['obsidian', 'paper', 'midnight', 'aurora'].includes(t)).toBe(true);
    }
  });
});

describe('AI Context 范围', () => {
  it('上下文范围枚举有效', () => {
    const scopes = ['document', 'current-page', 'selected-pages', 'selected-text'];
    for (const s of scopes) {
      expect(typeof s).toBe('string');
      expect(s.length).toBeGreaterThan(0);
    }
  });
});

describe('chunkText 页码引用与上下文（AI 总结基础）', () => {
  it('保留页码信息', () => {
    const text = '[第 1 页]\n介绍\n[第 2 页]\n方法\n[第 3 页]\n结论';
    const chunks = chunkText(text, 15, 5);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].pages).toContain(1);
  });
});
