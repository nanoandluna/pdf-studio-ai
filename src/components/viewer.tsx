// ============================================================
// Viewer — PDF 页面渲染 + 框选文本 + 搜索
// 每个可见页一个 canvas + svg overlay
// ============================================================

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useDocumentStore, viewEngine } from '@stores/documentStore';
import { useViewerStore } from '@stores/viewerStore';
import { useAiStore } from '@stores/aiStore';
import { useWorkspaceStore } from '@stores/workspaceStore';
import { SearchBar } from './searchBar';
import { IconSpark } from './icons';
import { calculateLayoutSize, calculateRenderRange, buildRenderKey } from './viewerMath';

export function Viewer(): JSX.Element {
  const { document, pageOrder, deletedPages, pageRotations, pageSizes } = useDocumentStore();
  const { scale, zoomMode, currentPage, navTarget, setCurrentPage, clearNavTarget } = useViewerStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const openDroppedFile = useDocumentStore((s) => s.openDroppedFile);
  // 关键修复：基于稳定字段（pageOrder / deletedPages）派生可见页，避免 store 每次 set 都
  // 触发 selector 返回新数组造成的 useEffect 链式循环（React #185）
  const visiblePageIndexes = useMemo(
    () => pageOrder.filter((i) => !deletedPages.has(i)),
    [pageOrder, deletedPages]
  );

  // 计算有效缩放（V0.3：用真实页面宽度做 Fit Width 基准，PDF 显著变大）
  const [basePageWidth, setBasePageWidth] = useState<number>(612); // pt，默认 Letter
  const effectiveScale = useMemo(() => {
    if (zoomMode === 'fit-width' && containerWidth > 0 && document) {
      // 留 56px 左右边距，让页面尽量大
      return Math.max(0.1, (containerWidth - 56) / basePageWidth);
    }
    if (zoomMode === 'fit-page') {
      return Math.max(0.1, ((containerWidth - 56) / basePageWidth) * 0.78);
    }
    return scale;
  }, [zoomMode, containerWidth, scale, document, basePageWidth]);

  // 用第一页的固有尺寸（scale=1）校准 Fit Width 基准。
  // 注意：不能用渲染后的尺寸 —— renderedSizes → basePageWidth → effectiveScale → 重渲染
  // → renderedSizes 会形成不收敛的 2 周期反馈循环，表现为页面上下持续跳动
  // （且只在首屏页处于渲染窗口、即当前页为 1~3 时触发）。
  // v0.4.0 翻转修复：getPageSize 传入附加旋转，返回「总旋转（page.rotate + extraRot）
  // 后的可视宽度」—— 与 renderPage 的 viewport 完全一致，首帧基准不会再取错方向。
  useEffect(() => {
    if (!document || visiblePageIndexes.length === 0) return;
    const first = visiblePageIndexes[0];
    const extraRot = pageRotations[first] ?? 0;
    let cancelled = false;
    viewEngine
      .getPageSize(document.id, first, extraRot)
      .then(({ width }) => {
        if (cancelled) return;
        setBasePageWidth(width);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [document, visiblePageIndexes, pageRotations]);

  // 观察容器宽度
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ============ Layout 与 Render 分离（v0.4.0 rendering hotfix）============
  // 布局尺寸 = pageSizes（原始尺寸）× effectiveScale（含总旋转），与页面是否
  // 已渲染无关 —— 未渲染页也有真实比例的稳定高度，滚动布局不随渲染而变。
  const layoutSizeOf = useCallback(
    (pageIdx: number): { w: number; h: number } =>
      calculateLayoutSize(pageSizes[pageIdx], pageRotations[pageIdx] ?? 0, effectiveScale),
    [pageSizes, pageRotations, effectiveScale]
  );

  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const renderGenRef = useRef(0);
  // 渲染目标：由滚动位置计算（viewport proximity），与 currentPage 解耦
  const [renderTarget, setRenderTarget] = useState<Set<number>>(new Set());
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const rafRef = useRef(0);
  const GAP = 28; // gap-7（页间距）

  // 滚动 → 计算可见页 ± 预取 + passive 更新当前页（不触发滚动）
  const updateFromScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || visiblePageIndexes.length === 0 || !document) return;
    const { target, currentPage: current } = calculateRenderRange(
      visiblePageIndexes,
      pageSizes,
      pageRotations,
      effectiveScale,
      el.scrollTop,
      el.clientHeight
    );
    const key = target.join(',');
    setRenderTarget((prev) => {
      const prevKey = Array.from(prev).sort((a, b) => a - b).join(',');
      return prevKey === key ? prev : new Set(target);
    });
    if (current >= 0 && current !== currentPageRef.current) {
      setCurrentPage(current); // passive：只更新高亮/缩略图，不滚动
    }
  }, [visiblePageIndexes, pageSizes, pageRotations, effectiveScale, document, setCurrentPage]);

  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      updateFromScroll();
    });
  }, [updateFromScroll]);

  // 布局变化（scale/旋转/文档/容器宽度）时重新计算可见范围
  useEffect(() => {
    updateFromScroll();
  }, [updateFromScroll, containerWidth]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // renderAll：只渲染 renderTarget 内的页（首帧等容器宽度就绪，避免低分辨率首帧）
  const renderAll = useCallback(async () => {
    if (!document || containerWidth <= 0) return;
    const gen = ++renderGenRef.current;
    const list = Array.from(renderTarget);
    for (const pageIdx of list) {
      if (renderGenRef.current !== gen) return; // 已被新一轮取代
      const canvas = canvasRefs.current[pageIdx];
      if (!canvas) continue;
      const extraRot = pageRotations[pageIdx] ?? 0;
      // render dedup：同页同 scale 同旋转不重复渲染
      const renderKey = buildRenderKey(pageIdx, effectiveScale, extraRot);
      if (canvas.dataset.renderKey === renderKey) continue;
      try {
        const size = await viewEngine.renderPage(document.id, pageIdx, effectiveScale, canvas, extraRot);
        if (renderGenRef.current !== gen) return; // 旧渲染结果丢弃
        canvas.dataset.renderKey = renderKey;
        void size; // 布局尺寸已由 pageSizes × scale 提供，渲染结果仅作确认
      } catch {
        // 忽略渲染错误（可能被新渲染取消）
      }
    }
  }, [document, renderTarget, effectiveScale, pageRotations, containerWidth]);

  useEffect(() => {
    renderAll();
  }, [renderAll]);

  // 用户显式导航（缩略图/页码/citation/搜索）→ 定位；passive 滚动不触发滚动
  useEffect(() => {
    if (navTarget === null) return;
    const el = containerRef.current?.querySelector(`[data-page="${navTarget}"]`);
    el?.scrollIntoView({ behavior: 'auto', block: 'start' });
    clearNavTarget();
  }, [navTarget, clearNavTarget]);

  if (!document) {
    return (
      <div className="flex flex-1 items-center justify-center bg-app-bg dark:bg-app-bg-dark">
        <div className="text-center text-fg-subtle">
          <div className="mb-2 text-5xl">📄</div>
          <div className="text-sm">打开一个 PDF 开始工作</div>
        </div>
      </div>
    );
  }

  const handleWheel = (e: React.WheelEvent) => {
    // Ctrl + 滚轮 = 缩放
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      useViewerStore.getState().setScale(scale * factor);
    }
  };

  return (
    <div
      className="relative flex flex-1 flex-col overflow-hidden"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDragActive(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file && file.name.toLowerCase().endsWith('.pdf')) {
          void openDroppedFile(file);
        }
      }}
    >
      <SearchBar />
      {/* 拖拽高亮遮罩 */}
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-accent/10 backdrop-blur-[1px]">
          <div className="rounded-xl border-2 border-dashed border-accent bg-app-panel px-8 py-6 text-center shadow-pop">
            <div className="text-2xl">↓</div>
            <div className="mt-1 text-sm font-medium text-accent">放开以打开 PDF</div>
          </div>
        </div>
      )}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto px-8 py-8"
        style={{ background: 'hsl(var(--background))' }}
        onWheel={handleWheel}
        onScroll={handleScroll}
        onMouseDown={() => {
          // 点击空白清除选择
        }}
      >
        <div className="mx-auto flex w-fit flex-col items-center gap-7">
          {visiblePageIndexes.map((pageIdx) => {
            const ls = layoutSizeOf(pageIdx);
            return (
              <PageCanvas
                key={pageIdx}
                pageIdx={pageIdx}
                layoutW={ls.w}
                layoutH={ls.h}
                effectiveScale={effectiveScale}
                isCurrent={pageIdx === currentPage}
                rotation={pageRotations[pageIdx] ?? 0}
                onCanvasRef={(c) => (canvasRefs.current[pageIdx] = c)}
                onPageClick={() => setCurrentPage(pageIdx)}
              />
            );
          })}
        </div>
      </div>
      {/* Selected Text → AI 浮动工具栏 */}
      <SelectionToolbar />
    </div>
  );
}

// ================== 单页渲染 ==================

function PageCanvas({
  pageIdx,
  layoutW,
  layoutH,
  effectiveScale,
  isCurrent,
  rotation,
  onCanvasRef,
  onPageClick,
}: {
  pageIdx: number;
  /** 布局宽度（= 原始页宽 × scale，含旋转）—— Layout 与 Render 分离 */
  layoutW: number;
  /** 布局高度（= 原始页高 × scale，含旋转） */
  layoutH: number;
  effectiveScale: number;
  isCurrent: boolean;
  rotation: number;
  onCanvasRef: (c: HTMLCanvasElement | null) => void;
  onPageClick: () => void;
}): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);

  // ---- 框选文本（Selected Text → AI） ----
  const [dragSel, setDragSel] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const { setTextSelection } = useViewerStore();
  const docId = useDocumentStore((s) => s.document?.id);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    dragStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragSel(null);
    onPageClick();
    svg.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragStartRef.current) {
      const svg = svgRef.current!;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDragSel({ x0: dragStartRef.current.x, y0: dragStartRef.current.y, x1: x, y1: y });
      return;
    }
  };

  const handlePointerUp = async () => {
    // 框选文字完成 → 提取选区文本
    if (dragStartRef.current) {
      const sel = dragSel;
      dragStartRef.current = null;
      setDragSel(null);
      if (sel) {
        const x = Math.min(sel.x0, sel.x1);
        const y = Math.min(sel.y0, sel.y1);
        const width = Math.abs(sel.x1 - sel.x0);
        const height = Math.abs(sel.y1 - sel.y0);
        if (width > 10 && height > 8 && docId && document) {
          try {
            const text = await viewEngine.extractTextInRect(docId, pageIdx, { x, y, width, height }, effectiveScale, rotation);
            if (text && text.length > 0) {
              setTextSelection({ pageIndex: pageIdx, text: text.slice(0, 2000), x, y, width, height });
            } else {
              setTextSelection(null);
            }
          } catch {
            setTextSelection(null);
          }
        } else {
          setTextSelection(null);
        }
      }
      return;
    }
  };

  return (
    <div
      data-page={pageIdx}
      onClick={onPageClick}
      style={{ width: layoutW, height: layoutH }}
      className={`relative rounded-[2px] transition-shadow ${isCurrent ? 'shadow-elev2 ring-1 ring-accent/40' : 'shadow-elev1 hover:shadow-elev2'}`}
    >
      <canvas ref={onCanvasRef} className="absolute inset-0 h-full w-full rounded-[2px] bg-white" />
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: 'text' }}
      >
        {/* 框选文字区域（Selected Text → AI） */}
        {dragSel && (
          <rect
            x={Math.min(dragSel.x0, dragSel.x1)}
            y={Math.min(dragSel.y0, dragSel.y1)}
            width={Math.abs(dragSel.x1 - dragSel.x0)}
            height={Math.abs(dragSel.y1 - dragSel.y0)}
            fill="hsl(var(--primary) / 0.08)"
            stroke="hsl(var(--primary) / 0.5)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}
      </svg>
      <div className="pointer-events-none absolute -top-4 left-1 text-[11px] font-medium text-fg-subtle">{pageIdx + 1}</div>
    </div>
  );
}

// ================== 标注形状 ==================

// ================== Selected Text → AI 浮动工具栏（V0.3.1） ==================
function SelectionToolbar(): JSX.Element | null {
  const selection = useViewerStore((s) => s.selection);
  const clearTextSelection = useViewerStore((s) => s.clearTextSelection);
  const sendMessage = useAiStore((s) => s.sendMessage);
  const setPanelOpen = useAiStore((s) => s.setPanelOpen);
  const setContextScope = useAiStore((s) => s.setContextScope);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // 根据选区计算工具栏位置（定位到选区下方居中）
  useEffect(() => {
    if (!selection) {
      setPos(null);
      return;
    }
    const canvas = document.querySelector<HTMLCanvasElement>(`[data-page="${selection.pageIndex}"] canvas`);
    if (!canvas) {
      setPos(null);
      return;
    }
    const cr = canvas.getBoundingClientRect();
    const selW = selection.width;
    const cx = cr.left + selection.x + selW / 2;
    const top = cr.top + selection.y + selection.height + 10;
    setPos({ left: cx, top });
  }, [selection]);

  // 滚动时隐藏（选区随页面移出视口）
  useEffect(() => {
    if (!selection) return;
    const onScroll = () => clearTextSelection();
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [selection, clearTextSelection]);

  if (!selection || !pos) return null;
  const pageLabel = selection.pageIndex + 1;
  const selectedText = selection.text;

  const ask = (prompt: string, scopeLabel: string) => {
    setPanelOpen(true);
    setContextScope('selected-text');
    sendMessage(prompt, { scope: 'selected-text', selectedText, selectionPage: pageLabel });
    clearTextSelection();
  };

  const actions = [
    { label: '✦ Ask AI', prompt: '请解释这段选中的文字，并给出关键要点。' },
    { label: '翻译', prompt: '请把这段选中的文字翻译成中文。' },
    { label: '解释', prompt: '请详细解释这段选中文字的含义。' },
    { label: '总结', prompt: '请用一两句话总结这段选中文字。' },
  ];

  return (
    <div
      className="fixed z-[8000] flex -translate-x-1/2 items-center gap-0.5 rounded-xl px-1 py-0.5 shadow-elev2 ring-1 ring-app-popover-border/40"
      style={{ left: pos.left, top: pos.top, background: 'hsl(var(--surface-popover))' }}
    >
      <span className="mx-1.5 whitespace-nowrap text-[10px] text-fg-subtle">AI Context · Selection · Page {pageLabel}</span>
      <span className="h-4 w-px bg-app-border-faint" />
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={() => ask(a.prompt, a.label)}
          className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] transition-colors ${
            a.label.startsWith('✦') ? 'text-accent hover:bg-accent-soft' : 'text-fg hover:bg-app-panel-hover'
          }`}
        >
          {a.label}
        </button>
      ))}
      <span className="h-4 w-px bg-app-border-faint" />
      <button
        onClick={clearTextSelection}
        title="取消选择"
        className="rounded-md px-2 py-1 text-[12px] text-fg-subtle transition-colors hover:bg-app-panel-hover hover:text-fg"
      >
        ✕
      </button>
    </div>
  );
}

// 类型引用（避免循环 import）
type ViewerState = ReturnType<typeof useViewerStore.getState>;
