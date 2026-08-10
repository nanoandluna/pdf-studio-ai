// ============================================================
// Markdown — 轻量 GFM 渲染器（V0.3.1）
// 用于 PDF Copilot 的 AI 输出。不引入重依赖，逐块解析：
// H1-H3 / 段落 / 粗斜体 / 有序无序列表 / 引用 / 代码块 / 行内代码 /
// 表格 / 分割线 / 链接 / 行内 citation（[N] → 引用 pill）
// 纯函数 + 稳定 key，streaming 逐 token 更新不抖动
// ============================================================

import { useMemo } from 'react';

export interface CitationInfo {
  page: number;
  /** 引用上下文（hover 预览用） */
  snippet?: string;
}

interface MarkdownProps {
  content: string;
  citations?: CitationInfo[];
  onCitationClick?: (page: number) => void;
}

// ---------------- 行内解析 ----------------
function inline(text: string, citationMap: Map<string, number>, keyPrefix: string, onCitationClick?: (p: number) => void): (string | JSX.Element)[] {
  const out: (string | JSX.Element)[] = [];
  // 分词：先找 citation [N]，再处理 code/粗斜体/链接
  const re = /(\[\d+(?:,\s*\d+)*\])|(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const [full, cit, code, bold, italic, link] = m;
    if (cit) {
      const pages = cit.slice(1, -1).split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
      for (const p of pages) {
        const pageKey = String(p);
        const isCitation = citationMap.has(pageKey);
        if (isCitation) {
          out.push(
            <button
              key={`${keyPrefix}-cit-${idx++}`}
              className="mx-0.5 inline-flex -translate-y-0.5 items-center rounded-full bg-accent-soft px-1.5 py-px align-super text-[10px] font-semibold leading-none text-accent transition-colors hover:bg-accent/20"
              title={`跳转到第 ${p} 页`}
              onClick={(e) => {
                e.stopPropagation();
                citationMap.get(pageKey) && onCitationClick?.(p);
              }}
            >
              {p}
            </button>
          );
        } else {
          out.push(<sup key={`${keyPrefix}-sup-${idx++}`} className="text-[10px] text-fg-subtle">{p}</sup>);
        }
      }
    } else if (code) {
      out.push(
        <code key={`${keyPrefix}-c-${idx++}`} className="rounded bg-app-panel-hover px-1 py-0.5 font-mono text-[0.9em] text-accent">
          {code.slice(1, -1)}
        </code>
      );
    } else if (bold) {
      out.push(<strong key={`${keyPrefix}-b-${idx++}`} className="font-semibold text-fg">{bold.slice(2, -2)}</strong>);
    } else if (italic) {
      out.push(<em key={`${keyPrefix}-i-${idx++}`} className="italic">{italic.slice(1, -1)}</em>);
    } else if (link) {
      const urlMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(link);
      if (urlMatch) {
        const href = urlMatch[2];
        const isInternal = href.startsWith('#page-');
        const pageNum = isInternal ? parseInt(href.replace('#page-', ''), 10) : NaN;
        out.push(
          isInternal && !isNaN(pageNum) ? (
            <button
              key={`${keyPrefix}-l-${idx++}`}
              className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
              onClick={() => onCitationClick?.(pageNum)}
            >
              {urlMatch[1]}
            </button>
          ) : (
            <a
              key={`${keyPrefix}-l-${idx++}`}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            >
              {urlMatch[1]}
            </a>
          )
        );
      }
    }
    last = m.index + full.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ---------------- 块级解析 ----------------
export function renderMarkdownBlocks(
  content: string,
  citationMap: Map<string, number>,
  onCitationClick?: (p: number) => void
): JSX.Element[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: JSX.Element[] = [];
  let key = 0;

  const push = (el: JSX.Element) => blocks.push(el);

  // 代码块 / 表格 / 列表状态机
  let i = 0;
  const inCode = () => {
    if (!lines[i].startsWith('```')) return false;
    const lang = lines[i].slice(3).trim();
    const codeLines: string[] = [];
    i++;
    while (i < lines.length && !lines[i].startsWith('```')) {
      codeLines.push(lines[i]);
      i++;
    }
    i++; // 跳过结束 ```
    push(
      <pre key={`md-${key++}`} className="my-2 overflow-x-auto rounded-lg bg-app-panel-hover/70 p-3">
        <code className="block font-mono text-[12px] leading-relaxed text-fg">{codeLines.join('\n')}</code>
      </pre>
    );
    return true;
  };

  const inTable = () => {
    if (!lines[i].includes('|')) return false;
    const headerParts = lines[i].split('|').filter((s) => s.trim() !== '');
    if (headerParts.length === 0) return false;
    const header = headerParts.map((s) => s.trim());
    i++;
    // 分隔行 |---|---|
    if (i < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i]) && lines[i].includes('-')) i++;
    const rows: string[][] = [];
    while (i < lines.length && lines[i].includes('|')) {
      const parts = lines[i].split('|').filter((s) => s.trim() !== '');
      rows.push(parts.map((s) => s.trim()));
      i++;
    }
    push(
      <div key={`md-${key++}`} className="my-2 overflow-x-auto rounded-lg">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-app-border-faint">
              {header.map((h, hi) => (
                <th key={hi} className="px-2.5 py-1.5 text-left font-semibold text-fg">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-b border-app-border-faint last:border-0">
                {header.map((_, hi) => (
                  <td key={hi} className="px-2.5 py-1.5 text-fg-muted">{r[hi] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    return true;
  };

  const inList = (ordered: boolean) => {
    const items: (string | JSX.Element)[][] = [];
    while (i < lines.length) {
      const line = lines[i];
      const ulMatch = /^\s*[-*+]\s+(.*)$/.exec(line);
      const olMatch = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (ordered && olMatch) {
        items.push(inline(olMatch[1], citationMap, `li-${key}-${i}`, onCitationClick));
        i++;
      } else if (!ordered && ulMatch) {
        items.push(inline(ulMatch[1], citationMap, `li-${key}-${i}`, onCitationClick));
        i++;
      } else {
        break;
      }
    }
    if (ordered) {
      push(
        <ol key={`md-${key++}`} className="my-1.5 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-fg">
          {items.map((it, ii) => <li key={ii}>{it}</li>)}
        </ol>
      );
    } else {
      push(
        <ul key={`md-${key++}`} className="my-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-fg">
          {items.map((it, ii) => <li key={ii}>{it}</li>)}
        </ul>
      );
    }
    return true;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) { inCode(); continue; }
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) { inTable(); continue; }
    if (/^\s*[-*+]\s+/.test(line) && !/^\s*[-*+]\s*$/.test(line)) { inList(false); continue; }
    if (/^\s*\d+[.)]\s+/.test(line)) { inList(true); continue; }
    if (/^\s*[-*_]{3,}\s*$/.test(line)) { i++; push(<hr key={`md-${key++}`} className="my-3 border-0" style={{ height: 1, background: 'hsl(var(--divider))' }} />); continue; }
    if (/^\s*&gt;\s?/.test(line) || /^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      push(
        <blockquote key={`md-${key++}`} className="my-2 border-l-2 pl-3 text-[13px] italic leading-relaxed" style={{ borderColor: 'hsl(var(--border-strong))', color: 'hsl(var(--muted))' }}>
          {quoteLines.join('\n')}
        </blockquote>
      );
      continue;
    }
    // 标题
    const hMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = inline(hMatch[2], citationMap, `h-${key}-${i}`, onCitationClick);
      const cls = [
        'mb-1 mt-3 text-[16px] font-semibold text-fg',
        'mb-1 mt-2.5 text-[15px] font-semibold text-fg',
        'mb-1 mt-2 text-[14px] font-semibold text-fg',
      ][Math.min(level, 3) - 1];
      push(<div key={`md-${key++}`} className={cls}>{text}</div>);
      i++;
      continue;
    }
    // 空行
    if (line.trim() === '') { i++; continue; }
    // 段落（合并连续行）
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('```') &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !lines[i].includes('|') &&
      !/^\s*[-*_]{3,}\s*$/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      push(
        <p key={`md-${key++}`} className="my-1.5 text-[13px] leading-[1.75] text-fg">
          {inline(paraLines.join(' '), citationMap, `p-${key}-${i}`, onCitationClick)}
        </p>
      );
      continue;
    }
    i++;
  }
  return blocks;
}

/** 提取内容中的所有 citation 页码（[N] 或第 N 页），返回 Map 页码 → 存在 */
export function extractCitationsFromMd(content: string): Map<string, number> {
  const map = new Map<string, number>();
  const re = /\[\s*(\d{1,3})\s*\]|第\s*(\d{1,3})\s*页/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const p = m[1] ? parseInt(m[1], 10) : parseInt(m[2], 10);
    if (!isNaN(p) && p >= 1 && p <= 9999) map.set(String(p), p);
  }
  return map;
}

export function Markdown({ content, onCitationClick }: MarkdownProps): JSX.Element {
  // useMemo：streaming 时内容变化才重渲染，稳定 key 避免列表抖动
  const { blocks, citationMap } = useMemo(() => {
    const citationMap = extractCitationsFromMd(content);
    return { blocks: renderMarkdownBlocks(content, citationMap, onCitationClick), citationMap };
  }, [content, onCitationClick]);

  return <div className="markdown-body space-y-1">{blocks}</div>;
}
