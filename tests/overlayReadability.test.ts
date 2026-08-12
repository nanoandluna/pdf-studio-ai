// ============================================================
// overlayReadability.test.ts — 浮层可读性回归测试
// 目标：Overlay/Popover Surface System 必须保证
//   1. 四主题都提供 popover/dialog/backdrop token
//   2. 层级递进：dialog > popover > elevated（越高级越盖住背景）
//   3. backdrop 足够暗（不得过度透明）
//   4. 组件正确接入分层（Dialog 用 dialog 表面，浮层用 popover 表面）
// ============================================================

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf-8');

const tokensCss = read('src/theme/tokens.css');
const tailwindConfig = read('tailwind.config.js');

// 从 HSL token 中取亮度（第三个数字），用于层级比较
function lightness(token: string): number | null {
  const m = /([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/.exec(token);
  return m ? parseFloat(m[3]) : null;
}

const THEMES = ['obsidian', 'paper', 'midnight', 'aurora'] as const;

function themeBlock(theme: string): string {
  const idx = tokensCss.indexOf(`[data-theme='${theme}']`);
  expect(idx, `theme ${theme} 存在`).toBeGreaterThan(-1);
  const next = tokensCss.indexOf('[data-theme=', idx + 1);
  return tokensCss.slice(idx, next > -1 ? next : undefined);
}

describe('Surface 层级 Token（四主题）', () => {
  for (const theme of THEMES) {
    describe(theme, () => {
      const block = themeBlock(theme);

      it('提供全部浮层 token', () => {
        for (const tok of ['--surface-popover', '--surface-dialog', '--overlay-backdrop', '--popover-border']) {
          expect(block.includes(tok), `${theme} 缺少 ${tok}`).toBe(true);
        }
      });

      it('层级递进：dialog 亮度 ≥ popover 亮度 ≥ elevated 亮度', () => {
        const pop = lightness(/(--surface-popover:\s*)([^;]+)/.exec(block)?.[2] ?? '');
        const dlg = lightness(/(--surface-dialog:\s*)([^;]+)/.exec(block)?.[2] ?? '');
        const elv = lightness(/(--elevated:\s*)([^;]+)/.exec(block)?.[2] ?? '');
        expect(elv).not.toBeNull();
        expect(pop).not.toBeNull();
        expect(dlg).not.toBeNull();
        expect(pop! + 1).toBeGreaterThanOrEqual(elv!); // popover 不暗于 elevated
        expect(dlg! + 1).toBeGreaterThanOrEqual(pop!); // dialog 不暗于 popover
      });

      it('backdrop 不透明白于 40%（防过度透明）', () => {
        const m = /--overlay-backdrop:\s*(rgb\([^)]+\))/.exec(block);
        expect(m).not.toBeNull();
        // rgb(r g b / a) 或 rgba 形式
        const alpha = /\/\s*([\d.]+)\)/.exec(m![1]);
        if (alpha) {
          expect(parseFloat(alpha[1])).toBeGreaterThanOrEqual(0.4);
        }
      });
    });
  }
});

describe('Tailwind 映射', () => {
  it('提供 popover/dialog/overlay-backdrop/popover-border 语义类', () => {
    for (const cls of ['popover', 'dialog', 'overlay-backdrop', 'popover-border']) {
      expect(tailwindConfig.includes(cls), `tailwind 缺少 app.${cls}`).toBe(true);
    }
  });
});

describe('组件接入分层（不回归到 bg-app-elevated）', () => {
  const comps: [string, string, string][] = [
    // [文件, 应含类, 不应含类]
    ['src/components/commandPalette.tsx', 'bg-app-dialog', 'bg-app-elevated'],
    ['src/components/modal.tsx', 'bg-app-dialog', 'bg-app-elevated'],
    ['src/components/searchBar.tsx', 'bg-app-popover', 'bg-app-elevated'],
    ['src/components/contextMenu.tsx', 'bg-app-popover', 'bg-app-elevated'],
    ['src/components/toast.tsx', 'bg-app-popover', 'bg-app-elevated'],
    ['src/components/ui/dropdown.tsx', 'bg-app-popover', 'bg-app-elevated'],
    ['src/components/toolbar.tsx', 'bg-app-popover', 'bg-app-elevated'],
    ['src/components/viewer.tsx', 'surface-popover', 'color-mix'],
  ];
  for (const [file, must, mustNot] of comps) {
    it(`${path.basename(file)} 使用 ${must} 且不含 ${mustNot}`, () => {
      const src = read(file);
      expect(src.includes(must), `${file} 缺少 ${must}`).toBe(true);
      if (mustNot) expect(src.includes(mustNot), `${file} 不应含 ${mustNot}`).toBe(false);
    });
  }

  it('Command Palette / Modal 的 Backdrop 使用 overlay-backdrop token（非硬编码）', () => {
    const cp = read('src/components/commandPalette.tsx');
    const modal = read('src/components/modal.tsx');
    expect(cp.includes('bg-app-overlay-backdrop')).toBe(true);
    expect(cp.includes('bg-black/50')).toBe(false);
    expect(modal.includes('bg-app-overlay-backdrop')).toBe(true);
    expect(modal.includes('bg-black/50')).toBe(false);
  });
});
