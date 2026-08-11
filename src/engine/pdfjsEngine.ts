// ============================================================
// PdfjsViewEngine — 基于 pdf.js 的渲染/文本/搜索实现
// 仅依赖 pdfjs-dist（浏览器/Worker 环境）
// ============================================================

import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { PdfDocument, PdfPage, SearchResult } from '@domain/types';
import type { PdfViewEngine } from './types';

// pdf.js v4+ 使用 mjs worker；在 Vite 中通过 ?url 引入
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface OpenDoc {
  doc: PDFDocumentProxy;
  path: string;
  name: string;
  fileSize: number;
}

export class PdfjsViewEngine implements PdfViewEngine {
  private docs = new Map<string, OpenDoc>();
  // 按 docId 跟踪在途渲染任务：dispose 时取消，避免与正在渲染/提取的任务撞车
  private docRenderTasks = new Map<string, Set<{ cancel: () => void }>>();

  private trackTask(docId: string, task: { cancel: () => void }): void {
    let set = this.docRenderTasks.get(docId);
    if (!set) {
      set = new Set();
      this.docRenderTasks.set(docId, set);
    }
    set.add(task);
  }
  private untrackTask(docId: string, task: { cancel: () => void }): void {
    const set = this.docRenderTasks.get(docId);
    if (set) {
      set.delete(task);
      if (set.size === 0) this.docRenderTasks.delete(docId);
    }
  }

  async open(data: ArrayBuffer, path: string, name: string): Promise<PdfDocument> {
    const id = crypto.randomUUID();
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as Record<string, unknown>;
    const fileSize = data.byteLength;
    this.docs.set(id, { doc, path, name, fileSize });
    return {
      id,
      path,
      name,
      pageCount: doc.numPages,
      modified: false,
      pageRotations: new Array(doc.numPages).fill(0),
      hasTextLayer: true,
      meta: {
        title: typeof info.Title === 'string' ? info.Title : undefined,
        author: typeof info.Author === 'string' ? info.Author : undefined,
        subject: typeof info.Subject === 'string' ? info.Subject : undefined,
        keywords: typeof info.Keywords === 'string' ? info.Keywords : undefined,
        creator: typeof info.Creator === 'string' ? info.Creator : undefined,
        producer: typeof info.Producer === 'string' ? info.Producer : undefined,
        creationDate: typeof info.CreationDate === 'string' ? info.CreationDate : undefined,
        modificationDate: typeof info.ModDate === 'string' ? info.ModDate : undefined,
        fileSize,
      },
    };
  }

  private get(docId: string): OpenDoc {
    const d = this.docs.get(docId);
    if (!d) throw new Error(`文档未打开或已释放 (${docId})`);
    return d;
  }

  private async getPage(docId: string, pageIndex: number): Promise<PDFPageProxy> {
    const { doc } = this.get(docId);
    if (pageIndex < 0 || pageIndex >= doc.numPages) {
      throw new Error(`页码越界: ${pageIndex + 1}`);
    }
    return doc.getPage(pageIndex + 1);
  }

  async getPageCount(docId: string): Promise<number> {
    return this.get(docId).doc.numPages;
  }

  async getPageSize(docId: string, pageIndex: number, extraRotation = 0): Promise<{ width: number; height: number }> {
    const page = await this.getPage(docId, pageIndex);
    // 总旋转 = PDF 自带 page.rotate + 用户附加旋转（与 renderPage 一致），
    // 返回旋转后的可视维度 —— 否则带原生旋转的 PDF 首帧 Fit Width 基准会取错（翻转）
    const rotation = (page.rotate + extraRotation) % 360;
    const viewport = page.getViewport({ scale: 1, rotation });
    return { width: viewport.width, height: viewport.height };
  }

  async renderPage(
    docId: string,
    pageIndex: number,
    scale: number,
    canvas: HTMLCanvasElement,
    extraRotation = 0
  ): Promise<{ width: number; height: number; rotation: number }> {
    const page = await this.getPage(docId, pageIndex);
    const rotation = (page.rotate + extraRotation) % 360;
    const viewport = page.getViewport({ scale, rotation });
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法获取 canvas 2D 上下文');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const task = page.render({ canvasContext: ctx, viewport });
    this.trackTask(docId, task);
    try {
      await task.promise;
    } finally {
      this.untrackTask(docId, task);
    }
    return { width: viewport.width, height: viewport.height, rotation };
  }

  async extractText(docId: string, pageIndex?: number): Promise<Map<number, string>> {
    const { doc } = this.get(docId);
    const result = new Map<number, string>();
    const pages = pageIndex === undefined ? Array.from({ length: doc.numPages }, (_, i) => i) : [pageIndex];
    for (const idx of pages) {
      // 文档已被 dispose → 提前返回已提取部分，避免撞上销毁中的 doc
      if (!this.docs.has(docId)) break;
      const page = await this.getPage(docId, idx);
      const tc = await page.getTextContent();
      const text = tc.items
        .map((it) => ('str' in it ? it.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        // 中文文本：pdf.js 某些字体（CID/ToUnicode）会在每个 CJK 字符间插入空格，
        // 导致「车辆」变成「车 辆」，搜索/AI 上下文全部失效。此处移除 CJK 字符间的空格。
        .replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g, '$1')
        .trim();
      result.set(idx, text);
    }
    return result;
  }

  async pageHasText(docId: string, pageIndex: number): Promise<boolean> {
    const texts = await this.extractText(docId, pageIndex);
    return (texts.get(pageIndex) ?? '').trim().length > 0;
  }

  async search(docId: string, query: string): Promise<SearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const { doc } = this.get(docId);
    const results: SearchResult[] = [];
    for (let i = 0; i < doc.numPages; i++) {
      const texts = await this.extractText(docId, i);
      const text = texts.get(i) ?? '';
      if (!text) continue;
      const lower = text.toLowerCase();
      const matches: { start: number; end: number }[] = [];
      let pos = lower.indexOf(q);
      while (pos !== -1) {
        matches.push({ start: pos, end: pos + q.length });
        pos = lower.indexOf(q, pos + q.length);
      }
      if (matches.length > 0) {
        // 上下文：取第一个匹配前后各 40 字符
        const ctxStart = Math.max(0, matches[0].start - 40);
        const ctxEnd = Math.min(text.length, matches[0].end + 40);
        results.push({
          pageIndex: i,
          pageLabel: i + 1,
          matches,
          context: text.slice(ctxStart, ctxEnd),
        });
      }
    }
    return results;
  }

  async renderPageToDataUrl(docId: string, pageIndex: number, scale: number): Promise<string> {
    const canvas = document.createElement('canvas');
    await this.renderPage(docId, pageIndex, scale, canvas);
    return canvas.toDataURL('image/png');
  }

  async extractTextInRect(
    docId: string,
    pageIndex: number,
    rect: { x: number; y: number; width: number; height: number },
    scale: number,
    extraRotation = 0
  ): Promise<string> {
    const page = await this.getPage(docId, pageIndex);
    const rotation = (page.rotate + extraRotation) % 360;
    const viewport = page.getViewport({ scale, rotation });

    // 矩形（CSS 坐标，原点左上）→ PDF 坐标（原点左下，Y 翻转）
    const tl = viewport.convertToPdfPoint(rect.x, rect.y);
    const br = viewport.convertToPdfPoint(rect.x + rect.width, rect.y + rect.height);
    const minX = Math.min(tl[0], br[0]);
    const maxX = Math.max(tl[0], br[0]);
    const minY = Math.min(tl[1], br[1]);
    const maxY = Math.max(tl[1], br[1]);

    const tc = await page.getTextContent();
    const lines: { y: number; x: number; text: string }[] = [];
    for (const it of tc.items) {
      if (!('str' in it) || !it.str) continue;
      const transform = it.transform; // [a,b,c,d,e,f] 其中 e,f 为 x,y（PDF 坐标，Y 向上）
      if (!transform) continue;
      const x = transform[4];
      const y = transform[5];
      if (x < minX - 2 || x > maxX + 2) continue;
      if (y < minY - 2 || y > maxY + 2) continue;
      lines.push({ y, x, text: it.str });
    }

    // 按 Y 分行（容差 = 字号一半），行内按 X 排序
    lines.sort((a, b) => b.y - a.y || a.x - b.x);
    const rowTolerance = 6;
    const rows: { y: number; parts: { x: number; text: string }[] }[] = [];
    for (const l of lines) {
      let row = rows[rows.length - 1];
      if (!row || Math.abs(row.y - l.y) > rowTolerance) {
        row = { y: l.y, parts: [] };
        rows.push(row);
      }
      row.parts.push({ x: l.x, text: l.text });
    }
    return rows
      .map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.text).join(''))
      .join('\n')
      .trim();
  }

  async dispose(docId: string): Promise<void> {
    // 先取消该文档所有在途渲染任务（防止与 destroy 撞车）
    const tasks = this.docRenderTasks.get(docId);
    if (tasks) {
      for (const t of tasks) {
        try {
          t.cancel();
        } catch {
          // 取消失败忽略
        }
      }
      this.docRenderTasks.delete(docId);
    }
    const d = this.docs.get(docId);
    if (d) {
      await d.doc.destroy().catch(() => undefined);
      this.docs.delete(docId);
    }
  }
}

export function toPdfPageMeta(p: { index: number; rotation: number; width: number; height: number }): PdfPage {
  return {
    index: p.index,
    label: String(p.index + 1),
    rotation: p.rotation,
    width: p.width,
    height: p.height,
  };
}
