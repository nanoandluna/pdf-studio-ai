// ============================================================
// PageRange parser — 解析 "1-5, 8, 10-12" 形式的页面范围
// ============================================================

import type { PageRange } from './types';

export class PageRangeParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageRangeParseError';
  }
}

/**
 * 解析页面范围字符串，如 "1-5, 8, 10-12"。
 * - 支持逗号分隔、单个页码、连字符范围
 * - 页码为 1-based
 * - 允许 "3-1" 这类倒序（会归一化为 1-3）
 * @throws PageRangeParseError
 */
export function parsePageRanges(input: string): PageRange[] {
  const text = (input ?? '').trim();
  if (!text) {
    throw new PageRangeParseError('请输入页面范围，例如：1-5, 8, 10-12');
  }

  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new PageRangeParseError('请输入页面范围，例如：1-5, 8, 10-12');
  }

  const ranges: PageRange[] = [];
  for (const part of parts) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!m) {
      throw new PageRangeParseError(`无法解析 "${part}"，请使用 1-5、8、10-12 格式`);
    }
    const a = Number(m[1]);
    if (a < 1) {
      throw new PageRangeParseError(`页码必须大于等于 1（"${part}"）`);
    }
    if (m[2] === undefined) {
      ranges.push({ start: a, end: a });
    } else {
      const b = Number(m[2]);
      if (b < 1) {
        throw new PageRangeParseError(`页码必须大于等于 1（"${part}"）`);
      }
      ranges.push({ start: Math.min(a, b), end: Math.max(a, b) });
    }
  }
  return ranges;
}

/** 将 ranges 展开为升序且去重的 1-based 页码数组 */
export function expandPageRanges(ranges: PageRange[], pageCount?: number): number[] {
  const set = new Set<number>();
  for (const r of ranges) {
    for (let p = r.start; p <= r.end; p++) {
      if (pageCount === undefined || p <= pageCount) {
        set.add(p);
      }
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

/** 将 1-based 页码数组格式化为范围字符串（供 UI 展示） */
export function formatPageRanges(pages: number[]): string {
  if (pages.length === 0) return '';
  const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = cur;
    prev = cur;
  }
  return parts.join(', ');
}

/** 校验页码是否在文档范围内，返回越界页码 */
export function validatePages(pages: number[], pageCount: number): { valid: number[]; outOfRange: number[] } {
  const valid = pages.filter((p) => p >= 1 && p <= pageCount);
  const outOfRange = pages.filter((p) => p < 1 || p > pageCount);
  return { valid, outOfRange };
}
