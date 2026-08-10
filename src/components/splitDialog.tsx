// ============================================================
// SplitDialog — 拆分 PDF（全部页 / 指定范围，如 1-5, 8, 10-12）
// ============================================================

import { useEffect, useState } from 'react';
import { useDocumentStore } from '@stores/documentStore';
import { Modal } from './modal';
import { parsePageRanges, expandPageRanges, PageRangeParseError } from '@domain/pageRange';
import { editEngine } from '@stores/documentStore';
import { IconLoading, IconFolder } from './icons';
import { toastSuccess, toastError } from './toast';

type SplitMode = 'all' | 'ranges';

export function SplitDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const document = useDocumentStore((s) => s.document);
  const [mode, setMode] = useState<SplitMode>('all');
  const [rangesText, setRangesText] = useState('');
  const [outputDir, setOutputDir] = useState<string>('');
  const [splitting, setSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode('all');
      setRangesText('');
      setError(null);
    }
  }, [open]);

  const pickDir = async () => {
    const res = await window.pdfStudio.selectDirectory();
    if (res.path) setOutputDir(res.path);
  };

  const split = async () => {
    if (!document) return;
    setError(null);

    let ranges;
    if (mode === 'all') {
      const n = document.pageCount;
      ranges = [{ start: 1, end: n }];
    } else {
      try {
        ranges = parsePageRanges(rangesText);
      } catch (e) {
        setError(e instanceof PageRangeParseError ? e.message : '范围格式错误');
        return;
      }
    }

    if (!outputDir) {
      const res = await window.pdfStudio.selectDirectory();
      if (!res.path) return;
      setOutputDir(res.path);
    }
    const dir = outputDir;

    setSplitting(true);
    try {
      const data = await window.pdfStudio.readFile(document.path);
      const created = await editEngine.split(data, document.name, ranges, dir);
      toastSuccess(`拆分完成，生成 ${created.length} 个文件`);
      onClose();
    } catch (e) {
      toastError(e instanceof Error ? e.message : '拆分失败');
    } finally {
      setSplitting(false);
    }
  };

  const preview = mode === 'ranges' && rangesText.trim() ? safePreview(rangesText, document?.pageCount ?? 0) : null;

  return (
    <Modal open={open} title="拆分 PDF" onClose={onClose} width="w-[520px]">
      <div className="space-y-4">
        <div>
          <span className="label">拆分方式</span>
          <div className="flex gap-2">
            <button
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${mode === 'all' ? 'border-accent bg-accent-soft text-accent dark:bg-accent-soft-dark' : 'border-app-border text-gray-600 dark:border-app-border dark:text-fg-muted'}`}
              onClick={() => setMode('all')}
            >
              每页一个文件
            </button>
            <button
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${mode === 'ranges' ? 'border-accent bg-accent-soft text-accent dark:bg-accent-soft-dark' : 'border-app-border text-gray-600 dark:border-app-border dark:text-fg-muted'}`}
              onClick={() => setMode('ranges')}
            >
              指定范围
            </button>
          </div>
        </div>

        {mode === 'ranges' && (
          <div>
            <span className="label">页面范围（1-based，逗号分隔）</span>
            <input
              className="input font-mono"
              value={rangesText}
              onChange={(e) => setRangesText(e.target.value)}
              placeholder="例如：1-5, 8, 10-12"
            />
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
            {preview && (
              <p className="mt-1 text-[11px] text-gray-400">
                将生成 {preview.length} 个文件（共 {expandPageRanges(preview, document?.pageCount ?? 0).length} 页）
              </p>
            )}
          </div>
        )}

        <div>
          <span className="label">输出目录</span>
          <div className="flex items-center gap-2">
            <input className="input flex-1" value={outputDir} onChange={(e) => setOutputDir(e.target.value)} placeholder="选择输出目录" readOnly />
            <button className="btn-secondary" onClick={pickDir}>
              <IconFolder width={14} height={14} /> 选择
            </button>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">生成文件命名：{document?.name.replace(/\.pdf$/i, '')}-part-1.pdf 等</p>
        </div>

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={split} disabled={splitting || !document}>
            {splitting ? <IconLoading width={14} height={14} /> : '拆分'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function safePreview(text: string, pageCount: number): { start: number; end: number }[] | null {
  try {
    const ranges = parsePageRanges(text);
    return ranges.map((r) => ({ start: Math.min(r.start, pageCount), end: Math.min(r.end, pageCount) }));
  } catch {
    return null;
  }
}
