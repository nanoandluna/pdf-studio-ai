// ============================================================
// Unit Test — AI 工具 schema / chunk / citations
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, type PdfActionBus } from '@ai/tools';
import { chunkText } from '@ai/chunk';
import { extractCitations } from '@ai/orchestrator';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  const bus: PdfActionBus = {
    getPageCount: async () => 10,
    extractText: async (pageIndex) => {
      const m = new Map<number, string>();
      m.set(pageIndex ?? 0, 'sample text');
      return m;
    },
    searchText: async (query) => [{ pageIndex: 3, context: `found ${query}` }],
    deletePages: async (pages) => undefined,
    rotatePages: async () => undefined,
    reorderPages: async () => undefined,
    extractPages: async () => '/tmp/extract.pdf',
    mergePdf: async () => '/tmp/merged.pdf',
    summarize: async () => 'summary',
  };

  beforeEach(() => {
    registry = new ToolRegistry(bus);
    registry.buildDefaultTools();
  });

  it('注册了全部默认工具', () => {
    const names = registry.list().map((t) => t.name);
    expect(names).toContain('get_pdf_info');
    expect(names).toContain('get_page_count');
    expect(names).toContain('extract_text');
    expect(names).toContain('search_text');
    expect(names).toContain('delete_pages');
    expect(names).toContain('rotate_pages');
    expect(names).toContain('extract_pages');
    expect(names).toContain('summarize_pdf');
  });

  it('工具 schema 包含必填字段', () => {
    const deleteTool = registry.get('delete_pages')!;
    expect(deleteTool.inputSchema).toHaveProperty('properties.pages');
    expect((deleteTool.inputSchema as { required: string[] }).required).toContain('pages');
  });

  it('get_page_count 返回页数', async () => {
    const r = await registry.execute({ id: '1', name: 'get_page_count', arguments: {} });
    expect(r.ok).toBe(true);
    expect(r.output).toBe('10');
  });

  it('search_text 返回上下文', async () => {
    const r = await registry.execute({ id: '2', name: 'search_text', arguments: { query: 'hello' } });
    expect(r.ok).toBe(true);
    expect(r.output).toContain('第4页');
  });

  it('未知工具返回错误结果', async () => {
    const r = await registry.execute({ id: '3', name: 'no_such_tool', arguments: {} });
    expect(r.ok).toBe(false);
  });
});

describe('chunkText', () => {
  it('短文本返回单个 chunk', () => {
    const chunks = chunkText('短文本。只有一句。', 4000);
    expect(chunks.length).toBe(1);
  });

  it('长文本按 chunkSize 切分', () => {
    const text = '这是一个测试段落。'.repeat(500);
    const chunks = chunkText(text, 1000, 100);
    expect(chunks.length).toBeGreaterThan(1);
    // 每块不超过 chunkSize + overlap
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(1000 + 100);
    }
  });

  it('空文本返回空数组', () => {
    expect(chunkText('')).toEqual([]);
  });

  it('保留页码标记信息', () => {
    const text = '[第 1 页]\n内容一\n[第 2 页]\n内容二\n[第 3 页]\n内容三';
    const chunks = chunkText(text, 20, 5);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].pages).toContain(1);
  });
});

describe('extractCitations', () => {
  it('提取单页引用', () => {
    expect(extractCitations('参见第 3 页')).toEqual([3]);
  });

  it('提取范围引用', () => {
    expect(extractCitations('详见第 3-5 页')).toEqual([3, 4, 5]);
    expect(extractCitations('详见第 3至5页')).toEqual([3, 4, 5]);
  });

  it('提取多个引用并排序去重', () => {
    expect(extractCitations('第 8 页和第 3 页，还有第 8 页')).toEqual([3, 8]);
  });

  it('无引用返回空数组', () => {
    expect(extractCitations('没有任何引用')).toEqual([]);
  });
});
