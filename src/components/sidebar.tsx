// ============================================================
// Sidebar — 左侧导航（V0.2）
// 支持 Icon 模式 / Icon+Label 模式 / Collapsed / Expanded
// 结构：文件 / 页面（缩略图）/ 工具 / 底部（设置、帮助）
// ============================================================

import { useMemo, useState } from 'react';
import { useDocumentStore } from '@stores/documentStore';
import { useViewerStore } from '@stores/viewerStore';
import { useWorkspaceStore } from '@stores/workspaceStore';
import { useAiStore } from '@stores/aiStore';
import { ConfirmDialog } from './modal';
import { ContextMenu, type MenuState } from './contextMenu';
import {
  IconOpen, IconRotate, IconTrash, IconFile, IconDrag, IconMerge, IconSplit, IconOcr,
  IconSettings, IconHelp, IconBookOpen, IconChevronDown, IconChevronRight, IconImage, IconGrip, IconColumns,
} from './icons';
import { toastSuccess } from './toast';

type Section = 'file' | 'pages' | 'tools';

export function Sidebar(): JSX.Element | null {
  const { document, pageOrder, deletedPages, thumbnails, pageRotations, deletePages, rotatePages, extractPages, reorderPages } = useDocumentStore();
  const { currentPage, navigateTo, selectedPages, selectPage, clearSelection } = useViewerStore();
  const { sidebarCollapsed, toggleSidebar } = useWorkspaceStore();
  const setSettingsOpen = useAiStore((s) => s.setSettingsOpen);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [section, setSection] = useState<Section>('pages');

  const visiblePages = useMemo(
    () => pageOrder.filter((i) => !deletedPages.has(i)),
    [pageOrder, deletedPages]
  );

  if (!document) return null;

  // ---------- 折叠模式：纯图标 ----------
  if (sidebarCollapsed) {
    return (
      <div className="flex w-12 shrink-0 flex-col items-center border-r border-app-border bg-app-panel py-2">
        <button
          title="展开侧栏"
          onClick={() => toggleSidebar()}
          className="mb-1 rounded-md p-2 text-fg-muted transition-colors hover:bg-app-panel-hover hover:text-fg"
        >
          <IconOpen width={16} height={16} />
        </button>
        <div className="my-1 h-px w-6 bg-app-border" />
        <button
          title="页面缩略图"
          onClick={() => setSection('pages')}
          className={`mb-1 rounded-md p-2 transition-colors ${section === 'pages' ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-app-panel-hover hover:text-fg'}`}
        >
          <IconImage width={16} height={16} />
        </button>
        <button
          title="工具"
          onClick={() => setSection('tools')}
          className={`mb-1 rounded-md p-2 transition-colors ${section === 'tools' ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-app-panel-hover hover:text-fg'}`}
        >
          <IconMerge width={16} height={16} />
        </button>
        <div className="flex-1" />
        <button
          title="设置"
          onClick={() => setSettingsOpen(true)}
          className="mb-1 rounded-md p-2 text-fg-muted transition-colors hover:bg-app-panel-hover hover:text-fg"
        >
          <IconSettings width={16} height={16} />
        </button>
        <button
          title="帮助"
          className="rounded-md p-2 text-fg-muted transition-colors hover:bg-app-panel-hover hover:text-fg"
        >
          <IconHelp width={16} height={16} />
        </button>
      </div>
    );
  }

  // ---------- 展开模式 ----------
  const onContextMenu = (e: React.MouseEvent, pageIndex: number) => {
    e.preventDefault();
    if (!selectedPages.has(pageIndex)) selectPage(pageIndex, false);
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: '删除页面',
          danger: true,
          icon: <IconTrash width={14} height={14} />,
          onSelect: () => setConfirmDelete(true),
        },
        {
          label: '顺时针旋转 90°',
          icon: <IconRotate width={14} height={14} />,
          onSelect: () => {
            const sel = selectedPages.size > 0 ? Array.from(selectedPages) : [pageIndex];
            rotatePages(sel, 90);
          },
        },
        {
          label: '逆时针旋转 90°',
          icon: <IconRotate width={14} height={14} className="-scale-x-100" />,
          onSelect: () => {
            const sel = selectedPages.size > 0 ? Array.from(selectedPages) : [pageIndex];
            rotatePages(sel, 270);
          },
        },
        {
          label: '提取页面…',
          icon: <IconFile width={14} height={14} />,
          onSelect: () => {
            const sel = selectedPages.size > 0 ? Array.from(selectedPages) : [pageIndex];
            extractPages(sel).then((p) => {
              if (p) toastSuccess(`已提取到 ${p}`);
            });
          },
        },
      ],
    });
  };

  const onDeleteConfirm = async () => {
    const sel = Array.from(selectedPages);
    if (sel.length > 0) {
      await deletePages(sel);
      toastSuccess(`已删除 ${sel.length} 页`);
      clearSelection();
    }
    setConfirmDelete(false);
  };

  return (
    <>
      <div className="flex w-60 shrink-0 flex-col border-r border-app-border-faint bg-app-panel">
        {/* Header：简洁 */}
        <div className="flex h-11 shrink-0 items-center justify-between px-4">
          <span className="text-caption font-medium uppercase tracking-wider">Pages</span>
          <span className="text-caption">{visiblePages.length} 页</span>
        </div>

        {/* 导航 Tabs（去边框，用背景层级） */}
        <div className="flex shrink-0 gap-1 px-3 pb-2">
          {(
            [
              { id: 'pages', label: '页面', icon: <IconImage width={13} height={13} /> },
              { id: 'tools', label: '工具', icon: <IconMerge width={13} height={13} /> },
            ] as { id: Section; label: string; icon: JSX.Element }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[12px] transition-colors ${
                section === t.id ? 'bg-app-panel-active text-fg' : 'text-fg-subtle hover:bg-app-panel-hover hover:text-fg-muted'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* 内容 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {section === 'pages' && (
            <div className="space-y-2.5">
              {visiblePages.map((origIndex) => {
                const thumb = thumbnails.find((t) => t.index === origIndex);
                const isCurrent = currentPage === origIndex;
                const isSelected = selectedPages.has(origIndex);
                return (
                  <div
                    key={origIndex}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      setDragFrom(origIndex);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(origIndex);
                    }}
                    onDragLeave={() => setDragOver((o) => (o === origIndex ? null : o))}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragFrom !== null && dragFrom !== origIndex) {
                        const fromPos = visiblePages.indexOf(dragFrom);
                        const toPos = visiblePages.indexOf(origIndex);
                        const next = [...visiblePages];
                        const [moved] = next.splice(fromPos, 1);
                        next.splice(toPos, 0, moved);
                        reorderPages(next);
                        toastSuccess('已调整页面顺序');
                      }
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    onClick={(e) => {
                      selectPage(origIndex, e.ctrlKey || e.metaKey || e.shiftKey);
                      // 用户显式导航：navigateTo 设置 navTarget（触发滚动定位到正确页）
                      navigateTo(origIndex);
                    }}
                    onContextMenu={(e) => onContextMenu(e, origIndex)}
                    className={`group relative cursor-pointer overflow-hidden rounded-lg p-1 transition-all
                      ${isSelected ? 'thumb-selected' : 'hover:bg-app-panel-hover/70'}
                      ${dragOver === origIndex && dragFrom !== origIndex ? 'bg-accent-soft ring-1 ring-accent/40' : ''}`}
                  >
                    <div className="relative overflow-hidden rounded-md">
                      {thumb ? (
                        <img
                          src={thumb.dataUrl}
                          alt={`第 ${origIndex + 1} 页`}
                          className="mx-auto block max-h-[120px] w-auto"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-[100px] items-center justify-center text-xs text-fg-subtle">加载中…</div>
                      )}
                      {pageRotations[origIndex] > 0 && (
                        <span className="absolute right-1.5 top-1.5 rounded-md bg-black/55 px-1 py-px text-[9px] font-medium text-white">
                          {pageRotations[origIndex]}°
                        </span>
                      )}
                      <span className="absolute bottom-1 right-1 hidden rounded-md bg-black/45 p-0.5 text-white group-hover:block">
                        <IconDrag width={10} height={10} />
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between px-1">
                      <span className={`text-[12px] ${isCurrent ? 'font-semibold text-accent' : 'text-fg-muted'}`}>
                        {origIndex + 1}
                      </span>
                      {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {section === 'tools' && (
            <div className="space-y-1">
              <ToolRow icon={<IconMerge width={14} height={14} />} label="合并 PDF" onClick={() => window.dispatchEvent(new CustomEvent('menu:merge'))} />
              <ToolRow icon={<IconSplit width={14} height={14} />} label="拆分 PDF" onClick={() => window.dispatchEvent(new CustomEvent('menu:split'))} />
              <ToolRow icon={<IconOcr width={14} height={14} />} label="OCR 识别" onClick={() => window.dispatchEvent(new CustomEvent('menu:ocr'))} />
              <div className="mx-1 my-2 border-t border-app-border" />
              <ToolRow icon={<IconRotate width={14} height={14} />} label="旋转选中页" disabled={selectedPages.size === 0} onClick={() => rotatePages(Array.from(selectedPages), 90)} />
              <ToolRow icon={<IconTrash width={14} height={14} />} label="删除选中页" danger disabled={selectedPages.size === 0} onClick={() => setConfirmDelete(true)} />
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="shrink-0 px-3 pb-3">
          {section === 'pages' && (
            <div className="flex gap-1">
              <button
                className="btn-ghost flex-1 text-xs"
                onClick={() => {
                  const sel = Array.from(selectedPages);
                  if (sel.length > 0) rotatePages(sel, 90);
                }}
                disabled={selectedPages.size === 0}
              >
                <IconRotate width={13} height={13} /> 旋转
              </button>
              <button
                className="btn-ghost flex-1 text-xs text-danger hover:bg-danger/10"
                onClick={() => setConfirmDelete(true)}
                disabled={selectedPages.size === 0}
              >
                <IconTrash width={13} height={13} /> 删除
              </button>
            </div>
          )}
        </div>
      </div>

      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      <ConfirmDialog
        open={confirmDelete}
        title="删除页面"
        message={
          selectedPages.size > 0 ? (
            <>确定要删除选中的 <b>{selectedPages.size}</b> 页吗？</>
          ) : (
            <>确定要删除此页吗？</>
          )
        }
        confirmLabel="删除"
        danger
        onConfirm={onDeleteConfirm}
        onCancel={() => setConfirmDelete(false)}
      >
        <p className="mt-1 text-xs text-fg-subtle">此操作可以通过撤销恢复（Ctrl+Z）。</p>
      </ConfirmDialog>
    </>
  );
}

function ToolRow({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: JSX.Element;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}): JSX.Element {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:opacity-40 ${
        danger ? 'text-danger hover:bg-danger/10' : 'text-fg hover:bg-app-panel-hover'
      }`}
    >
      <span className="shrink-0 text-fg-subtle">{icon}</span>
      {label}
    </button>
  );
}
