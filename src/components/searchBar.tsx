// ============================================================
// SearchBar — 全文搜索（Ctrl+F），结果点击跳页
// ============================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import { useViewerStore } from '@stores/viewerStore';
import { useDocumentStore, viewEngine } from '@stores/documentStore';
import { searchIndex } from '@search/index';
import { IconClose, IconSearch, IconLoading } from './icons';

export function SearchBar(): JSX.Element | null {
  const { searchOpen, searchQuery, setSearchOpen, setSearchQuery, gotoPage } = useViewerStore();
  const document = useDocumentStore((s) => s.document);
  const [results, setResults] = useState<{ pageIndex: number; context: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [searchOpen]);

  const doSearch = async (q: string) => {
    if (!q.trim() || !document) return;
    setSearching(true);
    try {
      // 先查索引（含 OCR 结果），再查文本层
      const fromIndex = searchIndex.search(q).map((r) => ({ pageIndex: r.pageIndex, context: r.context }));
      let fromEngine: { pageIndex: number; context: string }[] = [];
      try {
        const r = await viewEngine.search(document.id, q);
        fromEngine = r.map((x) => ({ pageIndex: x.pageIndex, context: x.context }));
      } catch {
        // 忽略
      }
      const merged = new Map<number, string>();
      for (const r of [...fromIndex, ...fromEngine]) {
        if (!merged.has(r.pageIndex)) merged.set(r.pageIndex, r.context);
      }
      const all = Array.from(merged.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([pageIndex, context]) => ({ pageIndex, context }));
      setResults(all);
      setActive(0);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim()) {
      const t = setTimeout(() => doSearch(searchQuery), 300);
      return () => clearTimeout(t);
    }
    setResults([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, document]);

  const jumpTo = (pageIndex: number) => {
    gotoPage(pageIndex + 1);
    setSearchOpen(true);
  };

  if (!searchOpen || !document) return null;

  return (
    <div className="absolute right-6 top-3 z-30 w-[380px] overflow-hidden rounded-xl bg-app-popover shadow-elev2 ring-1 ring-app-popover-border/50">
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <IconSearch className="shrink-0 text-fg-subtle" width={14} height={14} />
        <input
          ref={inputRef}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!e.target.value) setResults([]);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (e.shiftKey && results.length > 0) setActive((a) => Math.max(0, a - 1));
              else if (results.length > 0) setActive((a) => Math.min(results.length - 1, a + 1));
            }
          }}
          placeholder="搜索 PDF 内容…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
        />
        {searching && <IconLoading className="shrink-0 text-fg-subtle" width={14} height={14} />}
        <span className="shrink-0 text-[11px] text-fg-subtle">{results.length} 个结果</span>
        <button onClick={() => setSearchOpen(false)} className="shrink-0 text-fg-subtle hover:text-fg-muted hover:text-fg">
          <IconClose width={14} height={14} />
        </button>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {results.length === 0 && searchQuery && !searching && (
          <div className="px-3 py-4 text-center text-sm text-fg-subtle">未找到匹配内容</div>
        )}
        {results.map((r, i) => (
          <button
            key={r.pageIndex}
            onClick={() => jumpTo(r.pageIndex)}
            onMouseEnter={() => setActive(i)}
            className={`block w-full border-b border-app-border-faint px-3.5 py-2.5 text-left last:border-0 ${
              i === active ? 'bg-accent-soft dark:bg-accent-soft' : ''
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium text-accent">
              <span className="rounded bg-accent-soft px-1 py-0.5 text-[10px] dark:bg-accent-soft">第 {r.pageIndex + 1} 页</span>
            </div>
            <div className="mt-1 truncate text-xs text-fg-muted dark:text-fg-muted">{r.context}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
