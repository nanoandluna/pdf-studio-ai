// ============================================================
// Search — 全文搜索（文本层 + OCR 结果合并）
// ============================================================

import type { SearchResult } from '@domain/types';

export interface PageTextEntry {
  pageIndex: number;
  text: string;
  source: 'text-layer' | 'ocr';
}

export class SearchIndex {
  private pages: Map<number, PageTextEntry> = new Map();

  setPage(entry: PageTextEntry): void {
    this.pages.set(entry.pageIndex, entry);
  }

  /** 合并/覆盖：若已有 text-layer，保留；否则用 OCR 补全 */
  upsertOcr(entry: PageTextEntry): void {
    const existing = this.pages.get(entry.pageIndex);
    if (existing && existing.source === 'text-layer' && existing.text.trim().length > 0) {
      return;
    }
    this.pages.set(entry.pageIndex, entry);
  }

  clear(): void {
    this.pages.clear();
  }

  getPageCount(): number {
    return this.pages.size;
  }

  getText(pageIndex: number): string {
    return this.pages.get(pageIndex)?.text ?? '';
  }

  hasText(pageIndex: number): boolean {
    const t = this.pages.get(pageIndex)?.text ?? '';
    return t.trim().length > 0;
  }

  /** 搜索全部文本，返回匹配页 */
  search(query: string): SearchResult[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const results: SearchResult[] = [];
    for (const [pageIndex, entry] of this.pages) {
      const text = entry.text;
      const lower = text.toLowerCase();
      const matches: { start: number; end: number }[] = [];
      let pos = lower.indexOf(q);
      while (pos !== -1) {
        matches.push({ start: pos, end: pos + q.length });
        pos = lower.indexOf(q, pos + q.length);
      }
      if (matches.length > 0) {
        const ctxStart = Math.max(0, matches[0].start - 40);
        const ctxEnd = Math.min(text.length, matches[0].end + 40);
        results.push({
          pageIndex,
          pageLabel: pageIndex + 1,
          matches,
          context: text.slice(ctxStart, ctxEnd),
        });
      }
    }
    return results;
  }

  /** 拼接全部文本（供 AI 读取） */
  fullText(maxChars = 100_000): string {
    const pages = Array.from(this.pages.entries()).sort((a, b) => a[0] - b[0]);
    let out = '';
    for (const [pageIndex, entry] of pages) {
      const t = entry.text.trim();
      if (!t) continue;
      out += `\n[第 ${pageIndex + 1} 页]\n${t}\n`;
      if (out.length > maxChars) {
        out = out.slice(0, maxChars) + '\n...(内容过长已截断)';
        break;
      }
    }
    return out.trim();
  }
}

export const searchIndex = new SearchIndex();
