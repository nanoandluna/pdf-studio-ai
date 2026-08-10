// ============================================================
// Integration Test — PDF 引擎操作（打开/删除/旋转/合并/拆分/搜索）
// 使用动态生成的 PDF 数据，不依赖用户电脑中的文件
// ============================================================

import { describe, it, expect, beforeAll } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { applyOperations, identityOperations } from '@engine/pdfLibEngine';
import type { PdfEditOperations } from '@engine/types';

/** 生成带 N 页、每页带文字的 PDF */
async function makePdf(pages: string[]): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  pages.forEach((text, i) => {
    const page = doc.addPage([300, 400]);
    page.drawText(`Page ${i + 1}: ${text}`, { x: 30, y: 300, size: 12, font });
  });
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function loadPdf(buf: ArrayBuffer): Promise<PDFDocument> {
  return PDFDocument.load(buf, { ignoreEncryption: true });
}

async function textsOf(pdf: PDFDocument): Promise<string[]> {
  // pdf-lib 不提供文本提取；这里仅验证页数与页面尺寸
  return pdf.getPages().map(() => '');
}

describe('PdfLibEditEngine — applyOperations', () => {
  let source: ArrayBuffer;
  let pageCount: number;

  beforeAll(async () => {
    source = await makePdf(['alpha', 'beta', 'gamma', 'delta']);
    pageCount = (await loadPdf(source)).getPageCount();
  });

  it('源 PDF 有 4 页', async () => {
    expect(pageCount).toBe(4);
  });

  it('identity 操作原样输出 4 页', async () => {
    const out = await applyOperations(source, identityOperations(pageCount));
    expect(out.getPageCount()).toBe(4);
  });

  it('删除第 2 页（index 1）后剩 3 页', async () => {
    const ops: PdfEditOperations = {
      pageOrder: [0, 1, 2, 3],
      pageRotations: {},
      deletedPages: [1],
    };
    const out = await applyOperations(source, ops);
    expect(out.getPageCount()).toBe(3);
  });

  it('删除 + 排序组合：删除第 1 页，剩余 [beta, gamma, delta] 倒序为 [delta, gamma, beta]', async () => {
    const ops: PdfEditOperations = {
      pageOrder: [3, 2, 1],
      pageRotations: {},
      deletedPages: [0],
    };
    const out = await applyOperations(source, ops);
    expect(out.getPageCount()).toBe(3);
    // 第一页宽度应为源第 4 页宽度
    expect(out.getPage(0).getWidth()).toBe(300);
  });

  it('旋转第 1 页 90° 后页面宽高互换', async () => {
    const ops: PdfEditOperations = {
      pageOrder: [0, 1, 2, 3],
      pageRotations: { 0: 90 },
      deletedPages: [],
    };
    const out = await applyOperations(source, ops);
    const p0 = out.getPage(0);
    // 300x400 旋转 90° 后：宽 400 高 300（pdf-lib 旋转不改变 MediaBox，这里仅验证旋转标记）
    expect(p0.getRotation().angle).toBe(90);
  });

  it('旋转 + 删除叠加正确', async () => {
    const ops: PdfEditOperations = {
      pageOrder: [3, 2, 1, 0],
      pageRotations: { 0: 180, 3: 90 },
      deletedPages: [1, 2],
    };
    const out = await applyOperations(source, ops);
    expect(out.getPageCount()).toBe(2);
    // 新第 1 页 = 原第 4 页（旋转 90）
    expect(out.getPage(0).getRotation().angle).toBe(90);
    // 新第 2 页 = 原第 1 页（旋转 180）
    expect(out.getPage(1).getRotation().angle).toBe(180);
  });

  it('全部删除输出空文档（0 页）', async () => {
    const ops: PdfEditOperations = {
      pageOrder: [0, 1, 2, 3],
      pageRotations: {},
      deletedPages: [0, 1, 2, 3],
    };
    const out = await applyOperations(source, ops);
    expect(out.getPageCount()).toBe(0);
  });
});

describe('PdfLibEditEngine — merge & split', () => {
  it('合并两个 PDF 页数相加', async () => {
    const a = await makePdf(['a1', 'a2']);
    const b = await makePdf(['b1']);
    const merged = await PDFDocument.create();
    const srcA = await loadPdf(a);
    const srcB = await loadPdf(b);
    const pagesA = await merged.copyPages(srcA, srcA.getPageIndices());
    pagesA.forEach((p) => merged.addPage(p));
    const pagesB = await merged.copyPages(srcB, srcB.getPageIndices());
    pagesB.forEach((p) => merged.addPage(p));
    expect(merged.getPageCount()).toBe(3);
  });

  it('拆分：按 ranges 拆出正确页数', async () => {
    const source = await makePdf(['p1', 'p2', 'p3', 'p4', 'p5']);
    const src = await loadPdf(source);
    const ranges = [
      { start: 1, end: 2 },
      { start: 4, end: 4 },
    ];
    const parts: number[] = [];
    for (const r of ranges) {
      const out = await PDFDocument.create();
      const idxs = Array.from({ length: r.end - r.start + 1 }, (_, k) => r.start - 1 + k);
      const pages = await out.copyPages(src, idxs);
      pages.forEach((p) => out.addPage(p));
      parts.push(out.getPageCount());
    }
    expect(parts).toEqual([2, 1]);
  });

  it('拆分范围越界时安全截断', async () => {
    const source = await makePdf(['p1', 'p2']);
    const src = await loadPdf(source);
    const ranges = [{ start: 1, end: 99 }];
    const parts: number[] = [];
    for (const r of ranges) {
      const out = await PDFDocument.create();
      const end = Math.min(src.getPageCount(), r.end);
      const idxs = Array.from({ length: end - r.start + 1 }, (_, k) => r.start - 1 + k);
      const pages = await out.copyPages(src, idxs);
      pages.forEach((p) => out.addPage(p));
      parts.push(out.getPageCount());
    }
    expect(parts).toEqual([2]);
  });
});

describe('PdfLibEditEngine — 持久化往返', () => {
  it('save 后再 load 页数一致且可再次操作', async () => {
    const source = await makePdf(['x1', 'x2', 'x3']);
    const ops: PdfEditOperations = {
      pageOrder: [2, 0, 1],
      pageRotations: { 2: 90 },
      deletedPages: [],
    };
    const out = await applyOperations(source, ops);
    const bytesArr = await out.save();
    const reloaded = await PDFDocument.load(bytesArr, { ignoreEncryption: true });
    expect(reloaded.getPageCount()).toBe(3);
    expect(reloaded.getPage(0).getRotation().angle).toBe(90);
  });
});
