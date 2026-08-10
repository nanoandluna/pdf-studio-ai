// ============================================================
// OCR — Tesseract.js 封装（WASM，无需系统安装 Tesseract）
// 支持中文；缺语言包时返回友好错误而不是崩溃
// ============================================================

import { createWorker, type Worker } from 'tesseract.js';
import type { OcrProgress } from '@domain/types';
import { logger } from '@lib/logger';
import { FriendlyError } from '@lib/errors';

export interface OcrPageResult {
  pageIndex: number;
  text: string;
  confidence: number;
  /** 命中词条的边界框 [{text, bbox}] */
  words: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[];
}

export interface OcrOptions {
  lang?: string;
  onProgress?: (p: OcrProgress) => void;
}

const LANG_ALIAS: Record<string, string> = {
  zh: 'chi_sim',
  chs: 'chi_sim',
  'zh-cn': 'chi_sim',
  'zh-hans': 'chi_sim',
  en: 'eng',
};

export class TesseractOcrService {
  private worker: Worker | null = null;
  private workerPromise: Promise<Worker> | null = null;
  private currentLang = '';

  private async getWorker(lang: string): Promise<Worker> {
    const resolved = LANG_ALIAS[lang.toLowerCase()] ?? lang;
    if (this.worker && this.currentLang === resolved) return this.worker;
    if (this.worker) {
      await this.worker.terminate().catch(() => undefined);
      this.worker = null;
      this.workerPromise = null;
    }
    if (!this.workerPromise) {
      this.workerPromise = createWorker(resolved, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') logger.debug('OCR 进度', m);
        },
      }).then((w) => {
        this.worker = w;
        this.currentLang = resolved;
        return w;
      });
    }
    return this.workerPromise;
  }

  async isAvailable(lang = 'chi_sim'): Promise<{ ok: boolean; message?: string }> {
    try {
      const w = await this.getWorker(lang);
      return { ok: !!w };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, message: msg };
    }
  }

  /**
   * 识别单张图片（dataURL 或 Blob）
   * @param imageData 图片数据（png dataURL / blob url / file）
   * @param pageIndex 页码（仅用于进度回调）
   */
  async recognizeImage(imageData: string, pageIndex: number, opts?: OcrOptions): Promise<OcrPageResult> {
    const lang = opts?.lang ?? 'chi_sim';
    try {
      const w = await this.getWorker(lang);
      const { data } = await w.recognize(imageData);
      const words = (data.words ?? []).map((wd) => ({
        text: wd.text,
        bbox: {
          x0: wd.bbox.x0,
          y0: wd.bbox.y0,
          x1: wd.bbox.x1,
          y1: wd.bbox.y1,
        },
      }));
      return {
        pageIndex,
        text: data.text ?? '',
        confidence: data.confidence ?? 0,
        words,
      };
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      logger.error('OCR 识别失败', { pageIndex, detail });
      if (/language|lstm|traineddata|lang/i.test(detail)) {
        throw new FriendlyError(
          `OCR 语言包 (${lang}) 不可用。首次使用需要联网下载语言模型，请检查网络后重试。`,
          detail
        );
      }
      throw new FriendlyError('OCR 识别失败，请稍后重试。', detail);
    }
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate().catch(() => undefined);
      this.worker = null;
      this.workerPromise = null;
    }
  }
}

export const ocrService = new TesseractOcrService();
