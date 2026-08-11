// ============================================================
// markdownSecurity.test.ts — Markdown 渲染 XSS 防护回归测试
// 开源前安全修复（#2）：外链 href 必须 https:// 白名单，
// javascript:/data:/http:// 等一律渲染为纯文本。
// ============================================================

import { describe, it, expect } from 'vitest';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderMarkdownBlocks } from '@components/markdown';

function html(content: string): string {
  const blocks = renderMarkdownBlocks(content, new Map());
  return renderToStaticMarkup(createElement(Fragment, null, blocks));
}

describe('Markdown 链接协议白名单（XSS 防护）', () => {
  it('https 外链正常渲染为 a[href] + noopener noreferrer', () => {
    const h = html('[官网](https://example.com)');
    expect(h).toContain('href="https://example.com"');
    expect(h).toContain('noopener noreferrer');
  });

  it('javascript: 链接不渲染为可点击 a（降级为纯文本）', () => {
    const h = html('[点我](javascript:alert(1))');
    expect(h).not.toContain('javascript:');
    expect(h).toContain('点我');
    expect(h).not.toContain('<a');
  });

  it('data: 链接不渲染为可点击 a', () => {
    const h = html('[x](data:text/html,<script>1</script>)');
    expect(h).not.toContain('data:text/html');
    expect(h).not.toContain('<a');
  });

  it('http 非加密外链不渲染为 a', () => {
    const h = html('[x](http://localhost:5173)');
    expect(h).not.toContain('href="http://');
    expect(h).not.toContain('<a');
  });

  it('内部页跳转 #page-N 仍渲染为 button（citation 跳页不受影响）', () => {
    const h = html('[第3页](#page-3)');
    expect(h).toContain('<button');
    expect(h).not.toContain('<a');
  });

  it('空/异常 href 不产生可点击链接', () => {
    expect(html('[x]()')).not.toContain('<a');
    expect(html('[x]( )')).not.toContain('<a');
  });
});
