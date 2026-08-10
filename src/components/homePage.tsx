// ============================================================
// HomePage — 未打开文档时的首页（打开 / 拖拽 / 最近文件）
// ============================================================

import { useDocumentStore } from '@stores/documentStore';
import { useRecentFilesStore } from '@stores/recentFilesStore';
import { IconOpen, IconDoc, IconClose } from './icons';
import { toastError } from './toast';

export function HomePage(): JSX.Element {
  const openFile = useDocumentStore((s) => s.openFile);
  const files = useRecentFilesStore((s) => s.files);
  const remove = useRecentFilesStore((s) => s.remove);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toastError('仅支持 PDF 文件');
      return;
    }
    // Electron 渲染进程无法直接读本地路径 —— 通过主进程按路径打开
    const path = (file as File & { path?: string }).path;
    if (path) {
      openFile(path);
    } else {
      // 兜底：用 File 对象转 ArrayBuffer
      file.arrayBuffer().then((buf) => {
        useDocumentStore.getState().openBytes(buf, file.name, file.name);
      }).catch(() => toastError('无法读取该文件'));
    }
  };

  return (
    <div
      className="flex flex-1 items-center justify-center overflow-y-auto"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div className="w-full max-w-xl px-8 py-10 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent dark:bg-accent-soft">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
            <path d="M14 2v6h6" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-fg dark:text-fg">PDF Studio AI</h1>
        <p className="mt-1.5 text-sm text-fg-muted dark:text-fg-muted">Local-First + AI-Native 的 PDF 工作台</p>

        <div className="mt-8 flex justify-center">
          <button className="btn-primary px-6 py-2.5 text-sm" onClick={() => openFile()}>
            <IconOpen width={16} height={16} /> 打开 PDF
          </button>
        </div>
        <p className="mt-3 text-xs text-fg-subtle">或将 PDF 拖拽到窗口</p>

        {files.length > 0 && (
          <div className="mt-10 text-left">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">最近文件</span>
              <button
                className="text-[11px] text-fg-subtle hover:text-danger"
                onClick={() => useRecentFilesStore.getState().clear()}
              >
                清空
              </button>
            </div>
            <div className="space-y-1">
              {files.map((f) => (
                <div
                  key={f.path}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    f.available
                      ? 'cursor-pointer hover:bg-app-panel-hover'
                      : 'opacity-45'
                  }`}
                  onClick={() => f.available && openFile(f.path)}
                >
                  <IconDoc className="shrink-0 text-red-400" width={16} height={16} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-fg dark:text-fg">
                      {f.name}
                      {!f.available && <span className="ml-2 rounded bg-app-panel-hover px-1.5 py-0.5 text-[10px] text-fg-muted dark:bg-app-panel-hover dark:text-fg-muted">unavailable</span>}
                    </div>
                    <div className="text-[11px] text-fg-subtle">
                      {new Date(f.lastOpenedAt).toLocaleString()}
                      {f.pageCount ? ` · ${f.pageCount} 页` : ''}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(f.path);
                    }}
                    className="shrink-0 rounded-lg p-1 text-fg-subtle opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  >
                    <IconClose width={13} height={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
