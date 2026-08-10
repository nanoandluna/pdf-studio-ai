// ============================================================
// Chunking — 长文档 Map-Reduce 摘要
// ============================================================

export interface Chunk {
  index: number;
  text: string;
  pages: number[]; // 1-based
}

/**
 * 将全文按 ~N 字符切块，尽量在句号/换行处断开。
 * 每个 chunk 记录覆盖的页码（1-based），供引用。
 */
export function chunkText(fullText: string, chunkSize = 4000, overlap = 200): Chunk[] {
  const chunks: Chunk[] = [];
  if (!fullText) return chunks;

  let start = 0;
  let idx = 0;
  while (start < fullText.length) {
    let end = Math.min(start + chunkSize, fullText.length);
    if (end < fullText.length) {
      // 在断点附近找最近的换行/句号
      const window = fullText.slice(start, end);
      const breakIdx = Math.max(
        window.lastIndexOf('\n'),
        window.lastIndexOf('。'),
        window.lastIndexOf('. '),
        window.lastIndexOf('！'),
        window.lastIndexOf('？')
      );
      if (breakIdx > chunkSize * 0.5) {
        end = start + breakIdx + 1;
      }
    }
    chunks.push({
      index: idx,
      text: fullText.slice(start, end).trim(),
      pages: estimatePages(fullText, start, end),
    });
    // 文本已全部消费 → 结束
    if (end >= fullText.length) break;
    idx++;
    start = Math.max(end - overlap, start + 1);
    if (start >= end) break; // 防御死循环
  }
  return chunks.filter((c) => c.text.length > 0);
}

/** 估算文本区间覆盖的页码（按 "[第 N 页]" 标记） */
function estimatePages(fullText: string, start: number, end: number): number[] {
  const pages = new Set<number>();
  const re = /\[第\s*(\d+)\s*页\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fullText)) !== null) {
    const pos = m.index;
    if (pos >= start && pos <= end) {
      pages.add(Number(m[1]));
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}
