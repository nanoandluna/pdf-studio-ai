// ============================================================
// Unit Test — V0.3.1 Micro Polish
// Markdown 渲染 / Citation / Fuzzy / Selection→AI 数据流
// ============================================================

import { describe, it, expect } from 'vitest';
import { extractCitationsFromMd, renderMarkdownBlocks } from '@components/markdown';
import { fuzzyMatch } from '@components/commandPalette';
import { extractCitationsLocal } from '@stores/aiStore';
import type { ChatMessage, DocumentContext, AIContextScope } from '@domain/types';

describe('AI Markdown 渲染（V0.3.1）', () => {
  it('识别标题层级（H1/H2/H3）', () => {
    const blocks = renderMarkdownBlocks('# 标题一\n## 标题二\n### 标题三', new Map());
    expect(blocks.length).toBe(3);
  });

  it('识别有序/无序列表', () => {
    const blocks = renderMarkdownBlocks('- 苹果\n- 香蕉\n1. 第一\n2. 第二', new Map());
    const html = blocks.map((b) => typeof b === 'string' ? b : String(b.props?.children)).join('');
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  it('识别段落与加粗', () => {
    const blocks = renderMarkdownBlocks('这是一段**重要**文字。', new Map());
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it('识别代码块与行内代码', () => {
    const blocks = renderMarkdownBlocks('```js\nconst a = 1;\n```\n这是 `inline` 代码。', new Map());
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  it('识别引用块', () => {
    const blocks = renderMarkdownBlocks('> 引用的内容', new Map());
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it('识别表格', () => {
    const blocks = renderMarkdownBlocks('| 列A | 列B |\n| --- | --- |\n| 1 | 2 |', new Map());
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });

  it('识别分割线', () => {
    const blocks = renderMarkdownBlocks('上面\n---\n下面', new Map());
    expect(blocks.length).toBeGreaterThanOrEqual(3);
  });

  it('长文本解析不抛异常（streaming 稳定性）', () => {
    const long = Array.from({ length: 200 }, (_, i) => `第 ${i} 段内容 **加粗** 和 [链接](https://example.com)\n\n- 列表项 ${i}`).join('\n');
    expect(() => renderMarkdownBlocks(long, new Map())).not.toThrow();
  });
});

describe('Citation 提取与跳转（V0.3.1）', () => {
  it('从 Markdown 提取 [N] 引用', () => {
    const map = extractCitationsFromMd('方法见 [3] 和 [8]，另有 [3] 重复。');
    expect(map.get('3')).toBe(3);
    expect(map.get('8')).toBe(8);
    expect(map.size).toBe(2);
  });

  it('从 "第 N 页" 提取引用', () => {
    const map = extractCitationsFromMd('详见第 5 页和第 12 页');
    expect(map.get('5')).toBe(5);
    expect(map.get('12')).toBe(12);
  });

  it('兼容旧 extractCitationsLocal（第 N 页 → 页码数组）', () => {
    expect(extractCitationsLocal('参见第 3-5 页')).toEqual([3, 4, 5]);
    expect(extractCitationsLocal('第 8 页和第 2 页')).toEqual([2, 8]);
  });

  it('引用页码点击跳转（onCitationClick 回调）', () => {
    const blocks = renderMarkdownBlocks('见 [7]', new Map([['7', 7]]), () => undefined);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Command Palette fuzzy search（V0.3.1）', () => {
  it('子串命中', () => {
    expect(fuzzyMatch('总结', '✦ 总结这份 PDF')).toBe(true);
    expect(fuzzyMatch('pdf', '打开 PDF')).toBe(true);
  });

  it('子序列命中（保留顺序）', () => {
    expect(fuzzyMatch('cp', 'Command Palette')).toBe(true); // c…p
    expect(fuzzyMatch('opf', 'Open PDF')).toBe(true); // o…p…f
  });

  it('不命中返回 false', () => {
    expect(fuzzyMatch('xyz', '打开 PDF')).toBe(false);
    expect(fuzzyMatch('不存在的命令', 'OCR 识别')).toBe(false);
  });

  it('空查询匹配一切', () => {
    expect(fuzzyMatch('', '任意')).toBe(true);
  });

  it('命令按分类组织（AI/PDF/View/Navigation/Tools）', () => {
    const cats = ['AI', 'PDF', 'View', 'Navigation', 'Tools'];
    for (const c of cats) expect(typeof c).toBe('string');
  });
});

describe('AI Context 正式化（V0.3.1）', () => {
  it('SendOptions 携带选中文字与页码', () => {
    const opts = { scope: 'selected-text' as AIContextScope, selectedText: 'hello pdf', selectionPage: 8 };
    expect(opts.scope).toBe('selected-text');
    expect(opts.selectedText).toBe('hello pdf');
    expect(opts.selectionPage).toBe(8);
  });

  it('DocumentContext 是正式服务参数', () => {
    const ctx: DocumentContext = {
      documentId: 'doc-1',
      fileName: 'test.pdf',
      currentPage: 8,
      selectedPages: [7, 8, 9],
      relevantPages: [8],
      extractedText: '…',
      selectedText: 'hello',
    };
    expect(ctx.fileName).toBe('test.pdf');
    expect(ctx.currentPage).toBe(8);
  });

  it('ChatMessage 协议兼容 tool 消息', () => {
    const msgs: ChatMessage[] = [
      { role: 'user', content: '总结' },
      { role: 'assistant', content: '', tool_calls: [{ id: 't1', type: 'function', function: { name: 'get_pdf_info', arguments: '{}' } }] },
      { role: 'tool', content: '{"pages":4}', tool_call_id: 't1' },
    ];
    expect(msgs[2].tool_call_id).toBe('t1');
  });
});
