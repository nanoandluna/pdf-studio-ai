// ============================================================
// viewerMath — Viewer 布局/渲染纯函数（v0.4.0 rendering hotfix）
// Layout 与 Render 分离的核心计算，全部可单元测试。
// ============================================================

/** 页面间间距（与 viewer 的 gap-7 对应） */
export const PAGE_GAP = 28;
/** 预取页数（可见页前后） */
export const PREFETCH_PAGES = 2;

export interface RawPageSize {
  w: number;
  h: number;
  rotate: number;
}

/**
 * 布局尺寸 = 原始尺寸 × scale（含总旋转 page.rotate + 用户附加旋转）。
 * 未渲染页也用此尺寸占位 → 滚动布局不随渲染而变。
 */
export function calculateLayoutSize(raw: RawPageSize | undefined, extraRot: number, scale: number): { w: number; h: number } {
  const rawW = raw?.w ?? 612;
  const rawH = raw?.h ?? Math.round((rawW * 4) / 3);
  const totalRot = ((raw?.rotate ?? 0) + extraRot) % 360;
  const swap = totalRot % 180 !== 0;
  return { w: (swap ? rawH : rawW) * scale, h: (swap ? rawW : rawH) * scale };
}

/**
 * 计算每页的 offsetTop（累计布局高度，含页间距）。
 * @returns offsetTop 数组（与 pageIndexes 同序）+ 总高度
 */
export function calculatePageOffsets(
  pageIndexes: number[],
  rawSizes: Record<number, RawPageSize>,
  rotations: Record<number, number>,
  scale: number,
  gap = PAGE_GAP
): { offsets: number[]; totalHeight: number } {
  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < pageIndexes.length; i++) {
    offsets.push(acc);
    const { h } = calculateLayoutSize(rawSizes[pageIndexes[i]], rotations[pageIndexes[i]] ?? 0, scale);
    acc += h;
    if (i < pageIndexes.length - 1) acc += gap; // 末尾不追加间距
  }
  return { offsets, totalHeight: acc };
}

export interface RenderRange {
  /** 需要渲染的页索引（可见 ± 预取） */
  target: number[];
  /** 当前页（距视口中心最近的页；-1 表示无） */
  currentPage: number;
}

/**
 * 由滚动位置计算渲染范围 + 当前页。
 * 纯函数：输入 offsets（每页 offsetTop）与页高，输出 target 与 currentPage。
 */
export function calculateRenderRange(
  pageIndexes: number[],
  rawSizes: Record<number, RawPageSize>,
  rotations: Record<number, number>,
  scale: number,
  scrollTop: number,
  viewportHeight: number,
  prefetch = PREFETCH_PAGES,
  gap = PAGE_GAP
): RenderRange {
  const { offsets } = calculatePageOffsets(pageIndexes, rawSizes, rotations, scale, gap);
  const top = scrollTop;
  const bottom = scrollTop + viewportHeight;
  const center = (top + bottom) / 2;
  const visible: number[] = [];
  let current = -1;
  let best = Infinity;
  for (let k = 0; k < pageIndexes.length; k++) {
    const idx = pageIndexes[k];
    const { h } = calculateLayoutSize(rawSizes[idx], rotations[idx] ?? 0, scale);
    const pageTop = offsets[k];
    const pageBottom = offsets[k] + h;
    if (pageBottom >= top && pageTop <= bottom) visible.push(idx);
    const dist = Math.abs((pageTop + pageBottom) / 2 - center);
    if (dist < best) {
      best = dist;
      current = idx;
    }
  }
  const target: number[] = [];
  if (visible.length > 0) {
    const firstIdx = pageIndexes.indexOf(visible[0]);
    const lastIdx = pageIndexes.indexOf(visible[visible.length - 1]);
    for (let k = Math.max(0, firstIdx - prefetch); k <= Math.min(pageIndexes.length - 1, lastIdx + prefetch); k++) {
      target.push(pageIndexes[k]);
    }
  }
  return { target, currentPage: current };
}

/** 渲染去重 key：同页同 scale 同旋转不重复渲染 */
export function buildRenderKey(pageIdx: number, scale: number, extraRot: number): string {
  return `${pageIdx}:${scale.toFixed(4)}:${extraRot}`;
}
