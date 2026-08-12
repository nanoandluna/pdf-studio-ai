// ============================================================
// Viewer — PDF 页面渲染 + 标注 overlay + 搜索高亮
// 每个可见页一个 canvas + svg overlay
// ============================================================

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useDocumentStore, viewEngine } from '@stores/documentStore';
import { useViewerStore } from '@stores/viewerStore';
import { useEditorStore } from '@stores/editorStore';
import { useAiStore } from '@stores/aiStore';
import { useWorkspaceStore } from '@stores/workspaceStore';
import type { Annotation } from '@domain/types';
import { SearchBar } from './searchBar';
import { IconSpark } from './icons';

export function Viewer(): JSX.Element {
  const { document, pageOrder, deletedPages, pageRotations, annotations, addAnnotation, updateAnnotation, removeAnnotation } = useDocumentStore();
  const { scale, zoomMode, currentPage, setCurrentPage, tool, setTool } = useViewerStore();
  const editor = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const openFile = useDocumentStore((s) => s.openFile);
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
      // 留 48px 左右边距，让页面尽量大
      return Math.max(0.1, (containerWidth - 56) / basePageWidth);
    }
    if (zoomMode === 'fit-page') {
      return Math.max(0.1, ((containerWidth - 56) / basePageWidth) * 0.78);
    }
    return scale;
  }, [zoomMode, containerWidth, scale, document, basePageWidth]);

  // 页面渲染状态
  const [renderedSizes, setRenderedSizes] = useState<Record<number, { w: number; h: number }>>({});

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

  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});

  const renderAll = useCallback(async () => {
    if (!document) return;
    // 只渲染可见页（当前页 ± 预取 2 页）
    const target = new Set<number>();
    const idx = visiblePageIndexes.indexOf(currentPage);
    if (idx >= 0) {
      for (let k = Math.max(0, idx - 2); k <= Math.min(visiblePageIndexes.length - 1, idx + 2); k++) {
        target.add(visiblePageIndexes[k]);
      }
    }
    for (const pageIdx of visiblePageIndexes) {
      const canvas = canvasRefs.current[pageIdx];
      if (!canvas) continue;
      if (!target.has(pageIdx)) continue;
      const extraRot = pageRotations[pageIdx] ?? 0;
      try {
        const size = await viewEngine.renderPage(document.id, pageIdx, effectiveScale, canvas, extraRot);
        setRenderedSizes((s) => ({ ...s, [pageIdx]: { w: size.width, h: size.height } }));
      } catch {
        // 忽略渲染错误
      }
    }
  }, [document, visiblePageIndexes, currentPage, effectiveScale, pageRotations]);

  useEffect(() => {
    renderAll();
  }, [renderAll]);

  // 滚动到当前页
  const scrollToPage = useCallback((pageIdx: number) => {
    const el = containerRef.current?.querySelector(`[data-page="${pageIdx}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => scrollToPage(currentPage), 50);
    return () => clearTimeout(timer);
  }, [currentPage, scrollToPage]);

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
          const path = (file as File & { path?: string }).path;
          if (path) {
            openFile(path);
          } else {
            file.arrayBuffer().then((buf) => {
              useDocumentStore.getState().openBytes(buf, file.name, file.name);
            }).catch(() => {
              useDocumentStore.getState().setError('无法读取该文件，请确认文件未损坏。');
            });
          }
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
        onMouseDown={() => {
          // 点击空白清除选择
        }}
      >
        <div className="mx-auto flex w-fit flex-col items-center gap-7">
          {visiblePageIndexes.map((pageIdx) => (
            <PageCanvas
              key={pageIdx}
              pageIdx={pageIdx}
              containerWidth={containerWidth}
              effectiveScale={effectiveScale}
              isCurrent={pageIdx === currentPage}
              rotation={pageRotations[pageIdx] ?? 0}
              annotations={annotations.filter((a) => a.pageIndex === pageIdx)}
              size={renderedSizes[pageIdx]}
              onCanvasRef={(c) => (canvasRefs.current[pageIdx] = c)}
              onPageClick={() => setCurrentPage(pageIdx)}
            />
          ))}
        </div>
      </div>
      {/* 编辑工具栏（覆盖在右下角） */}
      {document && (
        <EditToolbarOverlay
          tool={tool}
          setTool={setTool}
        />
      )}
      {/* Selected Text → AI 浮动工具栏 */}
      <SelectionToolbar />
    </div>
  );
}

// ================== 单页渲染 ==================

function PageCanvas({
  pageIdx,
  containerWidth,
  effectiveScale,
  isCurrent,
  rotation,
  annotations,
  size,
  onCanvasRef,
  onPageClick,
}: {
  pageIdx: number;
  containerWidth: number;
  effectiveScale: number;
  isCurrent: boolean;
  rotation: number;
  annotations: Annotation[];
  size?: { w: number; h: number };
  onCanvasRef: (c: HTMLCanvasElement | null) => void;
  onPageClick: () => void;
}): JSX.Element {
  const editor = useEditorStore();
  const { addAnnotation, updateAnnotation } = useDocumentStore();
  const { setTool, tool } = useViewerStore();
  const svgRef = useRef<SVGSVGElement>(null);

  const w = size?.w ?? 600;
  const h = size?.h ?? 800;

  const normToSvg = (p: { x: number; y: number }) => ({ x: p.x * w, y: p.y * h });

  // ---- 框选文本（Selected Text → AI） ----
  const [dragSel, setDragSel] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const { setTextSelection } = useViewerStore();
  const docId = useDocumentStore((s) => s.document?.id);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!tool || tool === 'select') {
      // 选择/查看模式：记录拖拽起点用于框选文字
      const svg = svgRef.current!;
      const rect = svg.getBoundingClientRect();
      dragStartRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setDragSel(null);
      onPageClick();
      return;
    }
    if (tool === 'eraser') {
      const pt = pointFromEvent(e);
      // 删除最近的标注
      const hit = annotations.find((a) => {
        const x = pt.x * w, y = pt.y * h;
        if (a.rect) {
          return x >= a.rect.x && x <= a.rect.x + a.rect.width && y >= a.rect.y && y <= a.rect.y + a.rect.height;
        }
        if (a.points) {
          return a.points.some((p) => Math.abs(p.x * w - x) < 6 && Math.abs(p.y * h - y) < 6);
        }
        return false;
      });
      if (hit) updateAnnotation(hit.id, { opacity: 0 });
      return;
    }
    e.preventDefault();
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    editor.beginStroke(tool, x, y);
    svg.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if ((!tool || tool === 'select') && dragStartRef.current) {
      const svg = svgRef.current!;
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDragSel({ x0: dragStartRef.current.x, y0: dragStartRef.current.y, x1: x, y1: y });
      return;
    }
    if (!editor.pending.kind) return;
    const svg = svgRef.current!;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    editor.extendStroke(x, y);
  };

  const handlePointerUp = async () => {
    // 框选文字完成 → 提取选区文本
    if ((!tool || tool === 'select') && dragStartRef.current) {
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
    const stroke = editor.finishStroke();
    if (!stroke || !stroke.kind) return;
    const id = crypto.randomUUID();
    const common = {
      id,
      pageIndex: pageIdx,
      color: editor.strokeColor,
      opacity: editor.opacity,
      createdAt: Date.now(),
    };
    if (stroke.kind === 'text') {
      // 文本需要弹出输入框 —— 用 prompt 简版（V0.1）
      const text = window.prompt('输入文本：', '');
      if (text) {
        addAnnotation({ ...common, kind: 'text', text, x: stroke.start?.x ?? 0.5, y: stroke.start?.y ?? 0.1, fontSize: editor.fontSize });
      }
    } else if (stroke.kind === 'highlight') {
      const start = stroke.start!;
      const last = stroke.points[stroke.points.length - 1];
      const rect = normalizeRect(start, last);
      addAnnotation({ ...common, kind: 'highlight', rect });
    } else if (stroke.kind === 'rectangle') {
      const start = stroke.start!;
      const last = stroke.points[stroke.points.length - 1];
      const rect = normalizeRect(start, last);
      addAnnotation({ ...common, kind: 'rectangle', rect });
    } else if (stroke.kind === 'arrow') {
      addAnnotation({ ...common, kind: 'arrow', points: stroke.points });
    } else if (stroke.kind === 'pen') {
      addAnnotation({ ...common, kind: 'pen', points: stroke.points });
    }
    setTool('select');
  };

  return (
    <div
      data-page={pageIdx}
      onClick={onPageClick}
      className={`relative rounded-[2px] transition-shadow ${isCurrent ? 'shadow-elev2 ring-1 ring-accent/40' : 'shadow-elev1 hover:shadow-elev2'}`}
    >
      <canvas ref={onCanvasRef} className="block rounded-[2px] bg-white" />
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ cursor: cursorForTool(tool) }}
      >
        {annotations.map((a) => (
          <AnnotationShape key={a.id} ann={a} w={w} h={h} />
        ))}
        {/* 进行中的绘制 */}
        {editor.pending.kind && (
          <PendingShape pending={editor.pending} w={w} h={h} color={editor.strokeColor} opacity={editor.opacity} width={editor.strokeWidth} />
        )}
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

function AnnotationShape({ ann, w, h }: { ann: Annotation; w: number; h: number }): JSX.Element {
  const common = { fill: ann.color, stroke: ann.color, opacity: ann.opacity };
  switch (ann.kind) {
    case 'highlight':
      return <rect x={ann.rect!.x} y={ann.rect!.y} width={ann.rect!.width} height={ann.rect!.height} {...common} opacity={0.35} rx={2} />;
    case 'rectangle':
      return <rect x={ann.rect!.x} y={ann.rect!.y} width={ann.rect!.width} height={ann.rect!.height} fill="none" stroke={ann.color} strokeWidth={1.5} opacity={ann.opacity} />;
    case 'arrow': {
      const pts = ann.points ?? [];
      if (pts.length < 2) return <g />;
      const start = pts[0], end = pts[pts.length - 1];
      const s = { x: start.x * w, y: start.y * h };
      const en = { x: end.x * w, y: end.y * h };
      return <g stroke={ann.color} strokeWidth={1.5} fill={ann.color} opacity={ann.opacity}>
        <line x1={s.x} y1={s.y} x2={en.x} y2={en.y} />
        <ArrowHead from={s} to={en} size={8} />
      </g>;
    }
    case 'pen': {
      const pts = ann.points ?? [];
      if (pts.length < 2) return <g />;
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * w} ${p.y * h}`).join(' ');
      return <path d={d} fill="none" stroke={ann.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={ann.opacity} />;
    }
    case 'text':
      return (
        <text x={ann.x! * w} y={ann.y! * h} fontSize={ann.fontSize ?? 14} fill={ann.color} opacity={ann.opacity} style={{ userSelect: 'none' }}>
          {ann.text}
        </text>
      );
    default:
      return <g />;
  }
}

function PendingShape({ pending, w, h, color, opacity, width }: {
  pending: { kind: string | null; points: { x: number; y: number }[]; start: { x: number; y: number } | null };
  w: number; h: number; color: string; opacity: number; width: number;
}): JSX.Element {
  if (!pending.start || pending.points.length === 0 || !pending.kind) return <g />;
  const start = { x: pending.start.x * w, y: pending.start.y * h };
  const last = { x: pending.points[pending.points.length - 1].x * w, y: pending.points[pending.points.length - 1].y * h };
  if (pending.kind === 'pen') {
    const d = pending.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * w} ${p.y * h}`).join(' ');
    return <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" opacity={opacity} />;
  }
  if (pending.kind === 'rectangle' || pending.kind === 'highlight') {
    const rect = normalizeRect(pending.start, pending.points[pending.points.length - 1]);
    return <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill="none" stroke={color} strokeWidth={1.5} opacity={pending.kind === 'highlight' ? 0.4 : opacity} />;
  }
  if (pending.kind === 'arrow') {
    return <g stroke={color} strokeWidth={1.5} fill={color} opacity={opacity}>
      <line x1={start.x} y1={start.y} x2={last.x} y2={last.y} />
      <ArrowHead from={start} to={last} size={8} />
    </g>;
  }
  return <g />;
}

function ArrowHead({ from, to, size }: { from: { x: number; y: number }; to: { x: number; y: number }; size: number }): JSX.Element {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const p1 = { x: to.x - size * Math.cos(angle - Math.PI / 6), y: to.y - size * Math.sin(angle - Math.PI / 6) };
  const p2 = { x: to.x - size * Math.cos(angle + Math.PI / 6), y: to.y - size * Math.sin(angle + Math.PI / 6) };
  return (
    <polygon points={`${to.x},${to.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`} />
  );
}

function normalizeRect(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

function cursorForTool(tool: string | null): string {
  switch (tool) {
    case 'text': return 'text';
    case 'highlight': return 'cell';
    case 'rectangle': return 'crosshair';
    case 'arrow': return 'crosshair';
    case 'pen': return 'crosshair';
    case 'eraser': return 'not-allowed';
    default: return 'default';
  }
}

function pointFromEvent(e: React.PointerEvent): { x: number; y: number } {
  const target = e.currentTarget as SVGElement;
  const rect = target.getBoundingClientRect();
  return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
}

// ================== 编辑工具栏 Overlay（V0.3 浮动式） ==================
// 默认隐藏；选择标注工具时显示（工具完成后自动回到 select 并隐藏）

function EditToolbarOverlay({ tool, setTool }: { tool: string | null; setTool: (t: ViewerState['tool']) => void }) {
  const { strokeColor, setColor } = useEditorStore();
  const { clearAnnotations, annotations } = useDocumentStore();

  const tools = [
    { id: 'text', label: '文本', icon: <span className="text-[12px] font-semibold">T</span> },
    { id: 'highlight', label: '高亮', icon: <span className="text-[13px]">🖍</span> },
    { id: 'rectangle', label: '矩形', icon: <span className="text-[13px]">▭</span> },
    { id: 'arrow', label: '箭头', icon: <span className="text-[13px]">↗</span> },
    { id: 'pen', label: '画笔', icon: <span className="text-[13px]">✏️</span> },
    { id: 'eraser', label: '擦除', icon: <span className="text-[13px]">🧽</span> },
  ];

  // 非 select 工具或已有标注时才显示（工具是隐形的）
  const visible = tool !== 'select' || annotations.length > 0;
  if (!visible) return null;

  return (
    <div
      className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-xl px-1.5 py-1 shadow-elev2 ring-1 ring-app-popover-border/40"
      style={{ background: 'hsl(var(--surface-popover))' }}
    >
      {tools.map((t) => (
        <button
          key={t.id}
          title={t.label}
          onClick={() => setTool(t.id as ViewerState['tool'])}
          className={`flex h-7 w-8 items-center justify-center rounded-md text-[13px] transition-colors ${
            tool === t.id ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-app-panel-hover hover:text-fg'
          }`}
        >
          {t.icon}
        </button>
      ))}
      <div className="divider-y mx-1" />
      <div className="flex items-center gap-1 px-1">
        {['#e5484d', '#ffb224', '#46a758', '#3e63dd', '#8e4ec6', '#111111'].map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => setColor(c)}
            className={`h-3.5 w-3.5 rounded-full transition-transform hover:scale-110 ${
              strokeColor === c ? 'ring-2 ring-accent/60 ring-offset-1' : ''
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
      {annotations.length > 0 && (
        <>
          <div className="divider-y mx-1" />
          <button
            title="清除全部标注"
            onClick={() => clearAnnotations()}
            className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-fg-muted transition-colors hover:bg-app-panel-hover hover:text-danger"
          >
            🗑 清除
          </button>
        </>
      )}
    </div>
  );
}

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
