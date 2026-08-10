// ============================================================
// OcrDialog — OCR 识别（Tesseract.js，支持中文；进度展示）
// 结果写入 SearchIndex，支持全文搜索
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useDocumentStore, viewEngine } from '@stores/documentStore';
import { useViewerStore } from '@stores/viewerStore';
import { Modal } from './modal';
import { ocrService } from '@ocr/tesseract';
import { searchIndex } from '@search/index';
import type { OcrProgress } from '@domain/types';
import { IconLoading, IconCheck } from './icons';
import { toastSuccess, toastError } from './toast';

export function OcrDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const document = useDocumentStore((s) => s.document);
  const [lang, setLang] = useState<'chi_sim' | 'eng' | 'chi_sim+eng'>('chi_sim');
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<OcrProgress[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRunning(false);
      setProgress([]);
      setSummary(null);
      setError(null);
    }
  }, [open]);

  const pagesToOcr = useMemo(() => {
    if (!document) return [];
    if (scope === 'current') {
      return [useViewerStore.getState().currentPage];
    }
    return Array.from({ length: document.pageCount }, (_, i) => i);
  }, [document, scope]);

  const start = async () => {
    if (!document || running) return;
    setRunning(true);
    setError(null);
    setSummary(null);
    try {
      const targets = scope === 'all' ? Array.from({ length: document.pageCount }, (_, i) => i) : [useViewerStore.getState().currentPage];
      let totalChars = 0;
      let okPages = 0;

      for (let i = 0; i < targets.length; i++) {
        const pageIdx = targets[i];
        setProgress((p) => [
          ...p,
          { pageIndex: pageIdx, pageCount: targets.length, status: 'processing' as const, textLength: 0 },
        ]);
        try {
          const dataUrl = await viewEngine.renderPageToDataUrl(document.id, pageIdx, 2);
          const result = await ocrService.recognizeImage(dataUrl, pageIdx, { lang });
          searchIndex.upsertOcr({ pageIndex: pageIdx, text: result.text, source: 'ocr' });
          totalChars += result.text.length;
          okPages++;
          setProgress((p) =>
            p.map((x) => (x.pageIndex === pageIdx ? { ...x, status: 'done' as const, textLength: result.text.length } : x))
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg);
          setProgress((p) =>
            p.map((x) => (x.pageIndex === pageIdx ? { ...x, status: 'error' as const, textLength: 0 } : x))
          );
          break;
        }
      }

      if (okPages > 0) {
        setSummary(`识别完成：${okPages}/${targets.length} 页，共 ${totalChars} 字符。现在可以在搜索框中全文搜索这些内容。`);
        toastSuccess('OCR 完成，已加入搜索索引');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR 失败');
      toastError('OCR 失败');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal open={open} title="OCR 文字识别" onClose={onClose} width="w-[520px]">
      <div className="space-y-4">
        <div>
          <span className="label">识别语言</span>
          <div className="flex gap-2">
            {[
              { v: 'chi_sim' as const, l: '简体中文' },
              { v: 'eng' as const, l: '英文' },
              { v: 'chi_sim+eng' as const, l: '中英混合' },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => setLang(o.v)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${lang === o.v ? 'border-accent bg-accent-soft text-accent dark:bg-accent-soft-dark' : 'border-app-border text-gray-600 dark:border-app-border dark:text-fg-muted'}`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">识别范围</span>
          <div className="flex gap-2">
            <button
              onClick={() => setScope('all')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${scope === 'all' ? 'border-accent bg-accent-soft text-accent dark:bg-accent-soft-dark' : 'border-app-border text-gray-600 dark:border-app-border dark:text-fg-muted'}`}
            >
              全部页面（{document?.pageCount ?? 0} 页）
            </button>
            <button
              onClick={() => setScope('current')}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${scope === 'current' ? 'border-accent bg-accent-soft text-accent dark:bg-accent-soft-dark' : 'border-app-border text-gray-600 dark:border-app-border dark:text-fg-muted'}`}
            >
              当前页
            </button>
          </div>
        </div>

        {progress.length > 0 && (
          <div className="max-h-[180px] space-y-1 overflow-y-auto rounded-xl border border-app-border p-3 dark:border-app-border">
            {progress.map((p) => (
              <div key={p.pageIndex} className="flex items-center gap-2 text-xs">
                <span className="w-16 text-gray-400">第 {p.pageIndex + 1} 页</span>
                {p.status === 'processing' && <IconLoading width={12} height={12} className="text-accent" />}
                {p.status === 'done' && <IconCheck width={12} height={12} className="text-emerald-500" />}
                {p.status === 'error' && <span className="text-red-500">✕</span>}
                {p.status === 'done' && <span className="text-gray-400">{p.textLength} 字符</span>}
              </div>
            ))}
          </div>
        )}

        {summary && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
            {summary}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>关闭</button>
          <button className="btn-primary" onClick={start} disabled={running || !document}>
            {running ? (
              <>
                <IconLoading width={14} height={14} /> 识别中…
              </>
            ) : (
              '开始识别'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
