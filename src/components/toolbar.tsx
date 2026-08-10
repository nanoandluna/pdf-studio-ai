// ============================================================
// Toolbar — 顶部 Command Bar（V0.2）
// 左：文件名 · 中：高频工具（按优先级）· 右：AI/更多
// ============================================================

import { useState, type ReactNode } from 'react';
import { useDocumentStore } from '@stores/documentStore';
import { useViewerStore } from '@stores/viewerStore';
import { useWorkspaceStore } from '@stores/workspaceStore';
import { useAiStore } from '@stores/aiStore';
import {
  IconOpen, IconSave, IconUndo, IconRedo, IconSearch, IconAi, IconSettings,
  IconCommand, IconMerge, IconSplit, IconOcr, IconChevronDown, IconPanelLeft, IconPanelRight, IconChevronLeft, IconChevronRight,
} from './icons';
import { Button, IconButton } from './ui';
import { Tooltip } from './ui';

function ToolButton({
  title,
  onClick,
  active,
  disabled,
  children,
  label,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  label?: string;
}) {
  return (
    <Tooltip label={title}>
      <button
        disabled={disabled}
        onClick={onClick}
        className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors disabled:opacity-40
          ${
            active
              ? 'bg-accent-soft text-accent'
              : 'text-fg-muted hover:bg-app-panel-hover hover:text-fg'
          }`}
      >
        {children}
        {label && <span>{label}</span>}
      </button>
    </Tooltip>
  );
}

function Divider() {
  return <div className="divider-y" />;
}

export function Toolbar({ onOpenPalette }: { onOpenPalette?: () => void }): JSX.Element {
  const { document, loading, dirty, undo, redo, deletePages, openFile, save } = useDocumentStore();
  const { currentPage, nextPage, prevPage, gotoPage, zoomIn, zoomOut, fitWidth, fitPage, scale, setSearchOpen, selectedPages, clearSelection } = useViewerStore();
  const { toggleSidebar, sidebarCollapsed, toggleAiPanel, aiPanelOpen } = useWorkspaceStore();
  const [moreOpen, setMoreOpen] = useState(false);

  const dirtyFlag = useDocumentStore((s) => s.dirty);
  const docLoaded = !!document;
  const canUndo = docLoaded && useDocumentStore.getState().document !== null;

  const hasSelection = selectedPages.size > 0;

  return (
    <div className="relative flex h-10 shrink-0 items-center gap-0.5 border-b border-app-border-faint bg-app-panel px-2">
      {/* 左侧：侧栏折叠 + 文件名 */}
      <IconButton label={sidebarCollapsed ? '展开侧栏' : '折叠侧栏'} onClick={() => toggleSidebar()} size="sm">
        <IconPanelLeft width={15} height={15} />
      </IconButton>
      {document ? (
        <div className="mx-1.5 flex max-w-[260px] items-center gap-2">
          <span className="truncate text-[13px] font-medium text-fg">{document.name}</span>
          {dirty && (
            <span className="rounded-md bg-warning/12 px-1.5 py-0.5 text-[10px] font-medium text-warning">未保存</span>
          )}
        </div>
      ) : (
        <span className="mx-1.5 text-[13px] text-fg-subtle">PDF Studio AI</span>
      )}

      <div className="divider-y mx-1.5" />

      {/* 文件操作 */}
      <ToolButton title="打开 PDF (Ctrl+O)" onClick={() => openFile()}>
        <IconOpen width={15} height={15} />
      </ToolButton>
      <ToolButton title="保存 (Ctrl+S)" onClick={() => save(false)} disabled={!docLoaded || loading}>
        <IconSave width={15} height={15} />
      </ToolButton>

      <div className="divider-y mx-1.5" />

      {/* 撤销重做 */}
      <ToolButton title="撤销 (Ctrl+Z)" onClick={() => undo()} disabled={!docLoaded}>
        <IconUndo width={15} height={15} />
      </ToolButton>
      <ToolButton title="重做 (Ctrl+Shift+Z)" onClick={() => redo()} disabled={!docLoaded}>
        <IconRedo width={15} height={15} />
      </ToolButton>

      <div className="divider-y mx-1.5" />

      {/* 翻页 */}
      <ToolButton title="上一页 (PageUp)" onClick={() => prevPage()} disabled={!docLoaded}>
        <IconChevronLeft width={15} height={15} />
      </ToolButton>
      <div className="flex items-center gap-1">
        <input
          className="h-7 w-12 rounded-md bg-app-panel-hover text-center text-[13px] text-fg outline-none transition-colors focus:bg-app-panel-active"
          value={currentPage + 1}
          min={1}
          max={document?.pageCount ?? 1}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 1) gotoPage(v);
          }}
        />
        <span className="text-xs text-fg-subtle">/ {document?.pageCount ?? 0}</span>
      </div>
      <ToolButton title="下一页 (PageDown)" onClick={() => nextPage()} disabled={!docLoaded}>
        <IconChevronRight width={15} height={15} />
      </ToolButton>

      {/* 缩放（低频 → 更多菜单） */}

      <div className="flex-1" />

      {/* 搜索 */}
      <ToolButton title="搜索 (Ctrl+F)" onClick={() => setSearchOpen(true)} disabled={!docLoaded}>
        <IconSearch width={15} height={15} />
      </ToolButton>

      {/* 更多菜单 */}
      <div className="relative">
        <IconButton label="更多操作" onClick={() => setMoreOpen((o) => !o)} size="sm">
          <IconChevronDown width={14} height={14} />
        </IconButton>
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-[9400]" onClick={() => setMoreOpen(false)} />
            <div className="absolute right-0 top-full z-[9500] mt-1 w-56 rounded-lg bg-app-elevated p-1 shadow-elev2" style={{ animation: 'dropdown-in 0.12s ease' }}>
              <MoreMenuItems
                document={document}
                onMerge={() => { window.dispatchEvent(new CustomEvent('menu:merge')); setMoreOpen(false); }}
                onSplit={() => { window.dispatchEvent(new CustomEvent('menu:split')); setMoreOpen(false); }}
                onOcr={() => { window.dispatchEvent(new CustomEvent('menu:ocr')); setMoreOpen(false); }}
                onDelete={() => {
                  if (hasSelection) {
                    deletePages(Array.from(selectedPages));
                    clearSelection();
                  }
                  setMoreOpen(false);
                }}
                hasSelection={hasSelection}
                onFitWidth={fitWidth}
                onFitPage={fitPage}
                onZoomIn={zoomIn}
                onZoomOut={zoomOut}
                onSaveAs={() => save(true)}
                scale={scale}
              />
            </div>
          </>
        )}
      </div>

      <div className="divider-y mx-1.5" />

      {/* AI + 设置：Copilot 用 accent 突出 */}
      <button
        title="PDF Copilot (Ctrl+E)"
        onClick={() => toggleAiPanel()}
        className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors ${
          aiPanelOpen ? 'bg-accent-soft text-accent' : 'text-accent hover:bg-accent-soft/60'
        }`}
      >
        <IconAi width={15} height={15} />
        Copilot
      </button>
      <ToolButton title="设置" onClick={() => useAiStore.getState().setSettingsOpen(true)}>
        <IconSettings width={15} height={15} />
      </ToolButton>
      <ToolButton title="命令面板 (Ctrl+K)" onClick={() => onOpenPalette?.()}>
        <IconCommand width={15} height={15} />
      </ToolButton>
    </div>
  );
}

function MoreMenuItems({
  document,
  onMerge,
  onSplit,
  onOcr,
  onDelete,
  hasSelection,
  onFitWidth,
  onFitPage,
  onZoomIn,
  onZoomOut,
  onSaveAs,
  scale,
}: {
  document: unknown;
  onMerge: () => void;
  onSplit: () => void;
  onOcr: () => void;
  onDelete: () => void;
  hasSelection: boolean;
  onFitWidth: () => void;
  onFitPage: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onSaveAs: () => void;
  scale: number;
}): JSX.Element {
  const disabled = !document;
  const item = 'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] text-fg transition-colors hover:bg-app-panel-hover disabled:opacity-40';
  return (
    <>
      <MenuItem className={item} label="另存为…" shortcut="Ctrl+Shift+S" disabled={disabled} onClick={onSaveAs} />
      <MenuItem className={item} label="删除选中页面" disabled={disabled || !hasSelection} onClick={onDelete} danger />
      <div className="mx-2 my-1 border-t border-app-border" />
      <MenuItem className={item} label="合并 PDF…" icon={<IconMerge width={14} height={14} />} onClick={onMerge} />
      <MenuItem className={item} label="拆分 PDF…" icon={<IconSplit width={14} height={14} />} disabled={disabled} onClick={onSplit} />
      <MenuItem className={item} label="OCR 识别…" icon={<IconOcr width={14} height={14} />} disabled={disabled} onClick={onOcr} />
      <div className="mx-2 my-1 border-t border-app-border" />
      <MenuItem className={item} label={`缩放 ${Math.round(scale * 100)}%`} disabled onClick={() => undefined} />
      <MenuItem className={item} label="适合宽度" disabled={disabled} onClick={onFitWidth} />
      <MenuItem className={item} label="适合页面 (Ctrl+0)" disabled={disabled} onClick={onFitPage} />
      <MenuItem className={item} label="放大 (Ctrl++)" disabled={disabled} onClick={onZoomIn} />
      <MenuItem className={item} label="缩小 (Ctrl+-)" disabled={disabled} onClick={onZoomOut} />
    </>
  );
}

function MenuItem({
  className,
  label,
  shortcut,
  icon,
  disabled,
  danger,
  onClick,
}: {
  className: string;
  label: string;
  shortcut?: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button disabled={disabled} onClick={onClick} className={className}>
      {icon && <span className="shrink-0 text-fg-subtle">{icon}</span>}
      <span className={`flex-1 ${danger ? 'text-danger' : ''}`}>{label}</span>
      {shortcut && <span className="text-[10px] text-fg-subtle">{shortcut}</span>}
    </button>
  );
}
