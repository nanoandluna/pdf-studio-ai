// ============================================================
// viewerRendering.test.ts — Viewer 渲染/布局回归测试
// v0.4.0 rendering hotfix：Layout 与 Render 分离 + 滚动驱动 lazy render
// 覆盖：DPR scale / layout placeholder / lazy render / visibility /
// currentPage passive / render dedup / page jump
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateLayoutSize,
  calculatePageOffsets,
  calculateRenderRange,
  buildRenderKey,
  PAGE_GAP,
} from '../src/components/viewerMath';
import { useViewerStore } from '../src/stores/viewerStore';

// 5 页 A4（595.28 × 841.89 pt）示例
const A4 = { w: 595.28, h: 841.89, rotate: 0 };
const rawSizes: Record<number, { w: number; h: number; rotate: number }> = {
  0: A4, 1: A4, 2: A4, 3: A4, 4: A4,
};
const pageIndexes = [0, 1, 2, 3, 4];
const rotations: Record<number, number> = {};
const SCALE = 2;

describe('Layout 与 Render 分离（placeholder 高度稳定）', () => {
  it('calculateLayoutSize：原始尺寸 × scale', () => {
    const s = calculateLayoutSize(A4, 0, 2);
    expect(s.w).toBeCloseTo(1190.56, 2);
    expect(s.h).toBeCloseTo(1683.78, 2);
  });

  it('calculateLayoutSize：90/270 旋转时宽高互换', () => {
    const s = calculateLayoutSize(A4, 90, 1);
    expect(s.w).toBeCloseTo(841.89, 2);
    expect(s.h).toBeCloseTo(595.28, 2);
  });

  it('calculateLayoutSize：page.rotate + 用户旋转叠加（180 不互换）', () => {
    const raw90 = { ...A4, rotate: 90 };
    const s = calculateLayoutSize(raw90, 90, 1); // 90+90=180 → 不互换
    expect(s.w).toBeCloseTo(595.28, 2);
  });

  it('未渲染页也有真实比例布局高度（placeholder 非 0/150px）', () => {
    const { offsets, totalHeight } = calculatePageOffsets(pageIndexes, rawSizes, rotations, SCALE);
    // 每页高 1683.78 + gap 28
    expect(offsets.length).toBe(5);
    expect(totalHeight).toBeCloseTo(5 * 1683.78 + 4 * PAGE_GAP, 1);
    // 页面之间高度差 = 页高 + gap（布局稳定，不塌缩）
    expect(offsets[1] - offsets[0]).toBeCloseTo(1683.78 + PAGE_GAP, 1);
  });

  it('同 scale 下连续计算布局稳定（无振荡）', () => {
    const a = calculatePageOffsets(pageIndexes, rawSizes, rotations, SCALE);
    const b = calculatePageOffsets(pageIndexes, rawSizes, rotations, SCALE);
    expect(a.totalHeight).toBe(b.totalHeight);
  });
});

describe('Lazy Render（滚动驱动，可见 ± 预取）', () => {
  it('顶部：只渲染 0-2（可见 0 + 预取）', () => {
    const r = calculateRenderRange(pageIndexes, rawSizes, rotations, SCALE, 0, 800);
    expect(r.target).toEqual([0, 1, 2]);
    expect(r.currentPage).toBe(0);
  });

  it('滚到第 3 页：渲染 1-4（不含未见的第 1 页以外）', () => {
    // 第 3 页（index 2）offsetTop = 2*(1683.78+28) = 3423.56
    const offset2 = 2 * (1683.78 + PAGE_GAP);
    const r = calculateRenderRange(pageIndexes, rawSizes, rotations, SCALE, offset2 - 200, 800);
    expect(r.target).toContain(2);
    expect(r.currentPage).toBe(2);
  });

  it('滚到第 5 页：target 含 4，currentPage=4（不再只有 0-2）', () => {
    const offset4 = 4 * (1683.78 + PAGE_GAP);
    const r = calculateRenderRange(pageIndexes, rawSizes, rotations, SCALE, offset4 - 100, 800);
    expect(r.target).toContain(4);
    expect(r.currentPage).toBe(4);
  });

  it('page jump：从顶部直接滚到末尾，target 正确（无空白页依赖点击）', () => {
    const { totalHeight } = calculatePageOffsets(pageIndexes, rawSizes, rotations, SCALE);
    const r = calculateRenderRange(pageIndexes, rawSizes, rotations, SCALE, totalHeight - 800, 800);
    expect(r.currentPage).toBe(4);
    expect(r.target).toEqual([2, 3, 4]);
  });

  it('快速滚动：target 集合有限（不渲染全部 5 页）', () => {
    const r = calculateRenderRange(pageIndexes, rawSizes, rotations, SCALE, 0, 800, 1);
    expect(r.target.length).toBeLessThanOrEqual(3);
  });
});

describe('Render Dedup', () => {
  it('buildRenderKey：同页同 scale 同旋转 → 相同 key', () => {
    expect(buildRenderKey(0, 1.92, 0)).toBe(buildRenderKey(0, 1.92, 0));
  });
  it('buildRenderKey：scale 或旋转变化 → 不同 key', () => {
    expect(buildRenderKey(0, 1.92, 0)).not.toBe(buildRenderKey(0, 2, 0));
    expect(buildRenderKey(0, 1.92, 0)).not.toBe(buildRenderKey(0, 1.92, 90));
  });
  it('buildRenderKey：同参数不重复渲染（dedup 依据）', () => {
    const set = new Set([buildRenderKey(3, 1.5, 0), buildRenderKey(3, 1.5, 0)]);
    expect(set.size).toBe(1);
  });
});

describe('currentPage passive vs navigateTo（导航分离）', () => {
  const store = useViewerStore;

  beforeEach(() => {
    store.setState({ currentPage: 0, navTarget: null });
  });

  it('setCurrentPage（passive）：只改当前页，不设 navTarget（不触发滚动）', () => {
    store.getState().setCurrentPage(3);
    const s = store.getState();
    expect(s.currentPage).toBe(3);
    expect(s.navTarget).toBeNull();
  });

  it('navigateTo（用户导航）：设置 currentPage + navTarget（触发滚动）', () => {
    store.getState().navigateTo(2);
    const s = store.getState();
    expect(s.currentPage).toBe(2);
    expect(s.navTarget).toBe(2);
  });

  it('clearNavTarget：消费后清除', () => {
    store.getState().navigateTo(4);
    store.getState().clearNavTarget();
    expect(store.getState().navTarget).toBeNull();
    expect(store.getState().currentPage).toBe(4);
  });

  it('gotoPage（1-based）等价 navigateTo', () => {
    store.getState().gotoPage(3); // 1-based → 0-based 2
    expect(store.getState().currentPage).toBe(2);
    expect(store.getState().navTarget).toBe(2);
  });
});
