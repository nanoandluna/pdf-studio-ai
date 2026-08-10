// ============================================================
// editorStore — 标注编辑状态（当前工具、进行中的绘制）
// ============================================================

import { create } from 'zustand';

interface EditorState {
  /** 当前正在绘制的标注（未完成） */
  pending: {
    kind: 'text' | 'highlight' | 'rectangle' | 'arrow' | 'pen' | null;
    points: { x: number; y: number }[];
    start: { x: number; y: number } | null;
  };
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;

  beginStroke: (kind: EditorState['pending']['kind'], x: number, y: number) => void;
  extendStroke: (x: number, y: number) => void;
  finishStroke: () => { kind: string; points: { x: number; y: number }[]; start: { x: number; y: number } | null } | null;
  cancelStroke: () => void;
  setColor: (c: string) => void;
  setStrokeWidth: (w: number) => void;
  setOpacity: (o: number) => void;
  setFontSize: (s: number) => void;
}

const DEFAULT_COLORS = ['#e5484d', '#ffb224', '#46a758', '#3e63dd', '#8e4ec6', '#111111'];

export const editorColors = DEFAULT_COLORS;

export const useEditorStore = create<EditorState>((set, get) => ({
  pending: { kind: null, points: [], start: null },
  strokeColor: '#3e63dd',
  strokeWidth: 2,
  opacity: 0.8,
  fontSize: 14,

  beginStroke: (kind, x, y) => {
    if (!kind) return;
    set({
      pending: { kind, points: [{ x, y }], start: { x, y } },
    });
  },

  extendStroke: (x, y) => {
    const { pending } = get();
    if (!pending.kind) return;
    set({
      pending: { ...pending, points: [...pending.points, { x, y }] },
    });
  },

  finishStroke: () => {
    const { pending } = get();
    if (!pending.kind) return null;
    const result = { kind: pending.kind, points: pending.points, start: pending.start };
    set({ pending: { kind: null, points: [], start: null } });
    return result;
  },

  cancelStroke: () => {
    set({ pending: { kind: null, points: [], start: null } });
  },

  setColor: (c) => set({ strokeColor: c }),
  setStrokeWidth: (w) => set({ strokeWidth: w }),
  setOpacity: (o) => set({ opacity: o }),
  setFontSize: (s) => set({ fontSize: s }),
}));
