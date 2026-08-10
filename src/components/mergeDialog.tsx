// ============================================================
// MergeDialog — 合并 PDF（多选 + 拖拽排序 + 输出）
// ============================================================

import { useEffect, useState } from 'react';
import { Modal } from './modal';
import { editEngine } from '@stores/documentStore';
import { IconPlus, IconGrip, IconClose, IconLoading, IconFile } from './icons';
import { toastSuccess, toastError } from './toast';

interface MergeFile {
  path: string;
  name: string;
  data: ArrayBuffer;
}

export function MergeDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const [files, setFiles] = useState<MergeFile[]>([]);
  const [merging, setMerging] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) setFiles([]);
  }, [open]);

  const addFiles = async () => {
    const res = await window.pdfStudio.openFilesDialog({
      title: '选择要合并的 PDF',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
    });
    if (res.cancelled) return;
    const existing = new Set(files.map((f) => f.path));
    setFiles((prev) => [...prev, ...res.files.filter((f) => !existing.has(f.path))]);
  };

  const remove = (path: string) => setFiles((prev) => prev.filter((f) => f.path !== path));

  const move = (from: number, to: number) => {
    if (from === to) return;
    setFiles((prev) => {
      const next = [...prev];
      const [f] = next.splice(from, 1);
      next.splice(to, 0, f);
      return next;
    });
  };

  const merge = async () => {
    if (files.length < 2) {
      toastError('请至少选择 2 个 PDF 文件');
      return;
    }
    setMerging(true);
    try {
      const res = await window.pdfStudio.saveFileDialog({
        title: '保存合并后的 PDF',
        defaultPath: 'merged.pdf',
        filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
      });
      if (res.cancelled) {
        setMerging(false);
        return;
      }
      const { pageCount } = await editEngine.merge(files, res.path);
      toastSuccess(`合并完成，共 ${pageCount} 页 → ${res.path}`);
      onClose();
    } catch (e) {
      toastError(e instanceof Error ? e.message : '合并失败');
    } finally {
      setMerging(false);
    }
  };

  return (
    <Modal open={open} title="合并 PDF" onClose={onClose} width="w-[560px]">
      <div className="space-y-4">
        <div className="min-h-[180px] space-y-1 rounded-xl border border-dashed border-app-border p-3 dark:border-app-border">
          {files.length === 0 ? (
            <div className="flex h-[150px] items-center justify-center text-sm text-gray-400">
              点击下方按钮选择 PDF 文件
            </div>
          ) : (
            files.map((f, i) => (
              <div
                key={f.path}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null) move(dragIdx, i);
                  setDragIdx(null);
                }}
                className="flex items-center gap-2 rounded-lg border border-app-border bg-app-panel px-3 py-2 dark:border-app-border dark:bg-app-panel"
              >
                <IconGrip className="shrink-0 cursor-grab text-gray-300" width={14} height={14} />
                <IconFile className="shrink-0 text-red-400" width={15} height={15} />
                <span className="flex-1 truncate text-sm text-gray-700 dark:text-fg">{f.name}</span>
                <span className="text-[11px] text-gray-400">#{i + 1}</span>
                <button onClick={() => remove(f.path)} className="text-gray-300 hover:text-red-500">
                  <IconClose width={14} height={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <button className="btn-secondary w-full" onClick={addFiles}>
          <IconPlus width={14} height={14} /> 添加 PDF
        </button>

        <p className="text-[11px] text-gray-400">拖拽文件可调整合并顺序</p>

        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>取消</button>
          <button className="btn-primary" onClick={merge} disabled={merging || files.length < 2}>
            {merging ? <IconLoading width={14} height={14} /> : '合并'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
