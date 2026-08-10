// ============================================================
// Unit Test — SearchIndex（全文搜索）
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { SearchIndex } from '@search/index';

describe('SearchIndex', () => {
  let idx: SearchIndex;

  beforeEach(() => {
    idx = new SearchIndex();
    idx.setPage({ pageIndex: 0, text: 'Hello World, this is page one.', source: 'text-layer' });
    idx.setPage({ pageIndex: 1, text: 'The quick brown fox jumps over the lazy dog.', source: 'text-layer' });
    idx.setPage({ pageIndex: 2, text: 'AlphaBeta keyword on page three.', source: 'text-layer' });
  });

  it('搜索命中多页', () => {
    const r = idx.search('page');
    expect(r.map((x) => x.pageIndex).sort()).toEqual([0, 2]);
  });

  it('搜索大小写不敏感', () => {
    const r = idx.search('ALPHABETA');
    expect(r).toHaveLength(1);
    expect(r[0].pageIndex).toBe(2);
  });

  it('无匹配返回空', () => {
    expect(idx.search('zzz-not-exist')).toEqual([]);
  });

  it('空查询返回空', () => {
    expect(idx.search('')).toEqual([]);
    expect(idx.search('   ')).toEqual([]);
  });

  it('OCR 结果不覆盖 text-layer', () => {
    idx.upsertOcr({ pageIndex: 0, text: 'OCR nonsense', source: 'ocr' });
    expect(idx.getText(0)).toContain('Hello World');
  });

  it('CJK 字符间空格被清理后中文搜索命中（V0.4 RC 修复）', () => {
    // 模拟 pdf.js 现代 worker 对中文字体（CID）的提取：字符间插入空格
    const raw = '基 于 深 度 学 习 的 车 辆 检 测 与 跟 踪 方 法 研 究';
    const cleaned = raw
      .replace(/\s+/g, ' ')
      .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '$1')
      .trim();
    expect(cleaned).toBe('基于深度学习的车辆检测与跟踪方法研究');
    idx.setPage({ pageIndex: 0, text: cleaned, source: 'text-layer' });
    const r = idx.search('车辆');
    expect(r).toHaveLength(1);
    const r2 = idx.search('深度学习');
    expect(r2).toHaveLength(1);
  });

  it('中文搜索不受英文空格影响', () => {
    idx.setPage({ pageIndex: 3, text: 'Transformer attention mechanism 注意力机制', source: 'text-layer' });
    const r = idx.search('注意力');
    expect(r).toHaveLength(1);
  });

  it('OCR 可补全无文本页', () => {
    idx.upsertOcr({ pageIndex: 5, text: 'scanned content here', source: 'ocr' });
    expect(idx.hasText(5)).toBe(true);
    const r = idx.search('scanned');
    expect(r).toHaveLength(1);
    expect(r[0].pageIndex).toBe(5);
  });

  it('fullText 拼接页码标记', () => {
    const t = idx.fullText();
    expect(t).toContain('[第 1 页]');
    expect(t).toContain('Hello World');
  });
});
