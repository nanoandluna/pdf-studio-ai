// ============================================================
// StatusBar — 底部状态栏（V0.2）
// ============================================================

import { useDocumentStore } from '@stores/documentStore';
import { useViewerStore } from '@stores/viewerStore';
import { useAiStore } from '@stores/aiStore';
import { useWorkspaceStore } from '@stores/workspaceStore';
import { Badge } from './ui';

export function StatusBar(): JSX.Element {
  const document = useDocumentStore((s) => s.document);
  const dirty = useDocumentStore((s) => s.dirty);
  const { scale, zoomMode } = useViewerStore();
  const thinking = useAiStore((s) => s.thinking);
  const readingMode = useWorkspaceStore((s) => s.readingMode);

  return (
    <div className="flex h-7 shrink-0 items-center gap-3 border-t border-app-border-faint bg-app-panel px-3.5 text-[11px] text-fg-subtle">
      {document ? (
        <>
          <span className="max-w-[280px] truncate font-medium text-fg-muted">{document.name}</span>
          <span>{document.pageCount} 页</span>
          {dirty && <Badge tone="warning" dot>未保存</Badge>}
          {readingMode && <Badge tone="accent" dot>阅读模式</Badge>}
        </>
      ) : (
        <span>未打开文档</span>
      )}
      <div className="flex-1" />
      {thinking && (
        <span className="flex items-center gap-1.5 text-accent">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          AI 思考中…
        </span>
      )}
      <span className="tabular-nums">
        缩放 {Math.round(scale * 100)}%
        {zoomMode !== 'custom' && `（${zoomMode === 'fit-width' ? '适合宽度' : '适合页面'}）`}
      </span>
    </div>
  );
}
