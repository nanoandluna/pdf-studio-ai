// ============================================================
// PdfLibEditEngine — 基于 pdf-lib 的页面编辑/合并/拆分/保存实现
// pdf-lib 是纯 JS 实现，无需原生模块，可在 Renderer 或 Node 运行
// ============================================================

import { PDFDocument, RotationTypes } from 'pdf-lib';
import type { PageRange } from '@domain/types';
import type { PdfEditEngine, PdfEditOperations } from './types';

/** 默认编辑操作：原样输出 */
export function identityOperations(pageCount: number): PdfEditOperations {
  return {
    pageOrder: Array.from({ length: pageCount }, (_, i) => i),
    pageRotations: {},
    deletedPages: [],
  };
}

/**
 * 按操作构建新文档：
 * 1. 先删除
 * 2. 再按 pageOrder 排序
 * 3. 应用每页旋转
 * 注意：所有 index 均为"原始文档 index"
 */
export async function applyOperations(
  src: ArrayBuffer,
  ops: PdfEditOperations
): Promise<PDFDocument> {
  const pdf = await PDFDocument.load(src, { ignoreEncryption: true });
  const originalCount = pdf.getPageCount();

  const deleted = new Set(ops.deletedPages);
  const order = ops.pageOrder.filter((i) => i >= 0 && i < originalCount && !deleted.has(i));

  // 收集需要保留的页（按排序后顺序），应用旋转
  const kept = order.filter((idx) => !deleted.has(idx));
  const pages = kept.map((idx) => pdf.getPage(idx));
  for (let i = 0; i < pages.length; i++) {
    const rot = ops.pageRotations[kept[i]] ?? 0;
    if (rot !== 0) {
      const cur = pages[i].getRotation().angle;
      pages[i].setRotation({ type: RotationTypes.Degrees, angle: (cur + rot) % 360 });
    }
  }
  // 重新排序：pdf-lib 通过 copyPages 重建实现排序
  const out = await PDFDocument.create();
  const copied = await out.copyPages(pdf, kept);
  copied.forEach((p) => out.addPage(p));
  // 复制元数据（保留全部常用字段，避免用户保存后元数据丢失）
  const meta = pdf.getTitle();
  if (meta) out.setTitle(meta);
  const author = pdf.getAuthor();
  if (author) out.setAuthor(author);
  const subject = pdf.getSubject();
  if (subject) out.setSubject(subject);
  const keywords = pdf.getKeywords();
  if (keywords) out.setKeywords(Array.isArray(keywords) ? keywords : [keywords]);
  const creator = pdf.getCreator();
  if (creator) out.setCreator(creator);
  const producer = pdf.getProducer();
  if (producer) out.setProducer(producer);
  const creationDate = pdf.getCreationDate();
  if (creationDate) out.setCreationDate(creationDate);
  const modDate = pdf.getModificationDate();
  if (modDate) out.setModificationDate(modDate);
  return out;
}

export class PdfLibEditEngine implements PdfEditEngine {
  async build(source: ArrayBuffer, operations: PdfEditOperations): Promise<Uint8Array> {
    const out = await applyOperations(source, operations);
    return out.save();
  }

  async save(source: ArrayBuffer, operations: PdfEditOperations, outputPath: string): Promise<void> {
    const bytes = await this.build(source, operations);
    // 通过宿主（IPC）写盘
    await window.pdfStudio.writeFile(outputPath, bytes);
  }

  async merge(
    inputFiles: { name: string; data: ArrayBuffer }[],
    outputPath: string
  ): Promise<{ pageCount: number }> {
    const out = await PDFDocument.create();
    for (const f of inputFiles) {
      const src = await PDFDocument.load(f.data, { ignoreEncryption: true });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    }
    const bytes = await out.save();
    await window.pdfStudio.writeFile(outputPath, bytes);
    return { pageCount: out.getPageCount() };
  }

  async split(
    source: ArrayBuffer,
    sourceName: string,
    ranges: PageRange[],
    outputDir: string
  ): Promise<string[]> {
    const src = await PDFDocument.load(source, { ignoreEncryption: true });
    const total = src.getPageCount();
    const created: string[] = [];

    for (let i = 0; i < ranges.length; i++) {
      const r = ranges[i];
      const start = Math.max(0, r.start - 1);
      const end = Math.min(total, r.end); // exclusive
      if (start >= end) continue;
      const out = await PDFDocument.create();
      const idxs = Array.from({ length: end - start }, (_, k) => start + k);
      const pages = await out.copyPages(src, idxs);
      pages.forEach((p) => out.addPage(p));
      const base = sourceName.replace(/\.pdf$/i, '');
      const filename = `${base}-part-${i + 1}.pdf`;
      const bytes = await out.save();
      const fullPath = `${outputDir}/${filename}`;
      await window.pdfStudio.writeFile(fullPath, bytes);
      created.push(fullPath);
    }
    return created;
  }
}
