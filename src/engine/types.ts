// ============================================================
// PDF Engine 抽象层
// 业务层绝不直接依赖具体 Engine；实现可替换（Pdfjs / PdfLib / 未来 PDFium / MuPDF）
// ============================================================

import type { PdfDocument, PageRange, SearchResult } from '@domain/types';

/** 渲染引擎（pdf.js）：打开、渲染、文本提取、搜索 */
export interface PdfViewEngine {
  open(data: ArrayBuffer, path: string, name: string): Promise<PdfDocument>;
  getPageCount(documentId: string): Promise<number>;
  /** 渲染指定页到 canvas，返回渲染的位图尺寸（extraRotation 为用户附加旋转角度） */
  renderPage(
    documentId: string,
    pageIndex: number,
    scale: number,
    canvas: HTMLCanvasElement,
    extraRotation?: number
  ): Promise<{ width: number; height: number; rotation: number }>;
  /** 获取页面尺寸（按总旋转 page.rotate + extraRotation 后的可视维度） */
  getPageSize(documentId: string, pageIndex: number, extraRotation?: number): Promise<{ width: number; height: number }>;
  extractText(documentId: string, pageIndex?: number): Promise<Map<number, string>>;
  /** 全文搜索，返回所有匹配页 */
  search(documentId: string, query: string): Promise<SearchResult[]>;
  /** 渲染页面为 PNG 数据 URL（供 OCR / 缩略图） */
  renderPageToDataUrl(documentId: string, pageIndex: number, scale: number): Promise<string>;
  /** 页面文本是否为空 */
  pageHasText(documentId: string, pageIndex: number): Promise<boolean>;
  /**
   * 提取页面中指定矩形区域内的文本（坐标 = 渲染 canvas 的 CSS 像素坐标系，相对页面左上角）
   * 用于「选中文字 → AI」的框选提取
   */
  extractTextInRect(
    documentId: string,
    pageIndex: number,
    rect: { x: number; y: number; width: number; height: number },
    scale: number,
    extraRotation?: number
  ): Promise<string>;
  dispose(documentId: string): Promise<void>;
}

/** 编辑引擎（pdf-lib）：旋转、删除、排序、合并、拆分、保存 */
export interface PdfEditEngine {
  /** 重新保存：将当前文档（含旋转/删除/排序后的状态）写出 */
  save(
    source: ArrayBuffer,
    operations: PdfEditOperations,
    outputPath: string
  ): Promise<void>;
  /** 生成保存后的新 PDF 字节（供预览/导出），不落盘 */
  build(source: ArrayBuffer, operations: PdfEditOperations): Promise<Uint8Array>;
  /** 合并多个 PDF */
  merge(inputFiles: { name: string; data: ArrayBuffer }[], outputPath: string): Promise<{ pageCount: number }>;
  /** 拆分 PDF：ranges 为 1-based 范围列表，输出到 outputDir，返回生成的文件名列表 */
  split(
    source: ArrayBuffer,
    sourceName: string,
    ranges: PageRange[],
    outputDir: string
  ): Promise<string[]>;
}

/** 编辑操作集合（描述一次保存时的变更） */
export interface PdfEditOperations {
  /** 当前页面顺序（原 index 顺序），例如 [2,0,1] 表示把原第3页移到最前 */
  pageOrder: number[];
  /** 每页旋转（0/90/180/270），key 为原 index */
  pageRotations: Record<number, number>;
  /** 需要删除的页（原 index） */
  deletedPages: number[];
}
