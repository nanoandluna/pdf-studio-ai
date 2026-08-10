// ============================================================
// CommandPalette — Ctrl+K 命令面板（V0.3.1）
// 分类（AI/PDF/View/Navigation/Tools）+ fuzzy search
// ============================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useDocumentStore } from '@stores/documentStore';
import { useViewerStore } from '@stores/viewerStore';
import { useAiStore } from '@stores/aiStore';
import { useWorkspaceStore } from '@stores/workspaceStore';
import { useSettingsStore } from '@stores/settingsStore';
import { THEMES, type ThemeId } from '@theme/themes';
import {
  IconOpen, IconSave, IconMerge, IconSplit, IconOcr, IconAi, IconSearch,
  IconSettings, IconUndo, IconRedo, IconCommand, IconChevronRight, IconBookOpen, IconRotate, IconSpark, IconTrash,
} from './icons';

export type CommandCategory = 'AI' | 'PDF' | 'View' | 'Navigation' | 'Tools';

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  icon?: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  category: CommandCategory;
  run: () => void;
}

/** fuzzy 匹配：子序列（保留顺序）+ 子串加权 */
export function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true; // 子串直接命中
  // 子序列匹配
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

const CATEGORY_ORDER: CommandCategory[] = ['AI', 'PDF', 'View', 'Navigation', 'Tools'];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const doc = useDocumentStore((s) => s.document);
  const openFile = useDocumentStore((s) => s.openFile);
  const save = useDocumentStore((s) => s.save);
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const setSettingsOpen = useAiStore((s) => s.setSettingsOpen);
  const setPanelOpen = useAiStore((s) => s.setPanelOpen);
  const toggleReadingMode = useWorkspaceStore((s) => s.toggleReadingMode);
  const setThemeId = useSettingsStore((s) => s.setThemeId);
  const currentPage = useViewerStore((s) => s.currentPage);

  const dispatch = (name: string) => window.dispatchEvent(new CustomEvent(name));
  const sendAi = (prompt: string) => {
    setPanelOpen(true);
    useAiStore.getState().sendMessage(prompt);
  };
  const sendAiPage = (prompt: string) => {
    setPanelOpen(true);
    useAiStore.getState().sendMessage(prompt, { scope: 'current-page' });
  };

  // 构建命令列表
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // ---- AI ----
      { id: 'ai', label: '打开 PDF Copilot', hint: '打开 AI Workspace', keywords: ['ai', 'copilot', '助手', 'chat'], icon: <IconAi width={15} height={15} />, shortcut: 'Ctrl+E', category: 'AI', run: () => setPanelOpen(true) },
      { id: 'ai-summarize', label: '✦ 总结这份 PDF', hint: 'AI 总结整个文档', keywords: ['summary', '总结', 'summarize'], icon: <IconSpark width={15} height={15} />, disabled: !doc, category: 'AI', run: () => sendAi('请总结这份 PDF 文档的核心内容。') },
      { id: 'ai-page', label: `✦ 总结当前页面`, hint: `总结第 ${currentPage + 1} 页`, keywords: ['总结', '页面', 'page', 'summary'], icon: <IconSpark width={15} height={15} />, disabled: !doc, category: 'AI', run: () => sendAiPage(`请总结当前第 ${currentPage + 1} 页的内容。`) },
      { id: 'ai-explain', label: '✦ 解释选中文字', hint: '解释 PDF 中选中的文字', keywords: ['解释', 'explain', '选中', 'selection'], icon: <IconSpark width={15} height={15} />, disabled: !doc, category: 'AI', run: () => { setPanelOpen(true); useAiStore.getState().sendMessage('请解释我选中的这段文字。', { scope: 'selected-text' }); } },
      { id: 'ai-translate', label: '✦ 翻译当前页面', hint: '把当前页翻译成中文', keywords: ['翻译', 'translate'], icon: <IconSpark width={15} height={15} />, disabled: !doc, category: 'AI', run: () => sendAiPage(`请把当前第 ${currentPage + 1} 页的内容翻译成中文。`) },
      { id: 'ai-data', label: '✦ 找出重要数据', hint: '提取关键数字与结论', keywords: ['数据', 'data', '提取'], icon: <IconSpark width={15} height={15} />, disabled: !doc, category: 'AI', run: () => sendAi('请找出这份 PDF 中的重要数据、数字和结论。') },
      { id: 'ai-analyze', label: '✦ 分析文档', hint: 'Document Intelligence：类型/主题/作者/总结', keywords: ['分析', 'analyze', 'insights', '文档'], icon: <IconSpark width={15} height={15} />, disabled: !doc, category: 'AI', run: () => { setPanelOpen(true); useAiStore.getState().analyzeDocument(); } },

      // ---- PDF ----
      { id: 'pdf-delete', label: '◇ 删除当前页面', hint: '删除当前页（可撤销）', keywords: ['删除', 'delete', '页面'], icon: <IconTrash width={15} height={15} />, disabled: !doc, category: 'PDF', run: () => { useDocumentStore.getState().deletePages([currentPage]); } },
      { id: 'pdf-rotate', label: '◇ 旋转当前页面', hint: '顺时针旋转 90°', keywords: ['旋转', 'rotate'], icon: <IconRotate width={15} height={15} />, disabled: !doc, category: 'PDF', run: () => { useDocumentStore.getState().rotatePages([currentPage], 90); } },
      { id: 'pdf-extract', label: '◇ 提取页面', hint: '把当前页保存为新 PDF', keywords: ['提取', 'extract'], icon: <IconBookOpen width={15} height={15} />, disabled: !doc, category: 'PDF', run: () => { useDocumentStore.getState().extractPages([currentPage]); } },
      { id: 'merge', label: '合并 PDF', hint: '把多个 PDF 合并为一个', keywords: ['merge', '合并'], icon: <IconMerge width={15} height={15} />, category: 'PDF', run: () => dispatch('menu:merge') },
      { id: 'split', label: '拆分 PDF', hint: '按页拆分 PDF', keywords: ['split', '拆分'], icon: <IconSplit width={15} height={15} />, disabled: !doc, category: 'PDF', run: () => dispatch('menu:split') },

      // ---- View ----
      { id: 'reading', label: '◇ 阅读模式', hint: '隐藏侧栏与工具栏', keywords: ['reading', '阅读', 'focus'], icon: <IconBookOpen width={15} height={15} />, shortcut: 'Ctrl+Shift+R', category: 'View', run: () => toggleReadingMode() },
      { id: 'search', label: '◇ 全文搜索', hint: '在文档中搜索文字', keywords: ['search', '搜索', 'find'], icon: <IconSearch width={15} height={15} />, shortcut: 'Ctrl+F', disabled: !doc, category: 'View', run: () => useViewerStore.getState().setSearchOpen(true) },
      { id: 'settings', label: '打开设置', hint: '应用设置', keywords: ['settings', '设置', 'preferences'], icon: <IconSettings width={15} height={15} />, category: 'View', run: () => setSettingsOpen(true) },

      // ---- Navigation ----
      { id: 'open', label: '打开 PDF', hint: '打开文件对话框', keywords: ['open', '打开', '文件'], icon: <IconOpen width={15} height={15} />, shortcut: 'Ctrl+O', category: 'Navigation', run: () => openFile() },
      { id: 'save', label: '保存 PDF', hint: '保存当前文档', keywords: ['save', '保存'], icon: <IconSave width={15} height={15} />, shortcut: 'Ctrl+S', disabled: !doc, category: 'Navigation', run: () => save(false) },
      { id: 'save-as', label: '另存为 PDF', hint: '保存为新的文件', keywords: ['save as', '另存'], icon: <IconSave width={15} height={15} />, shortcut: 'Ctrl+Shift+S', disabled: !doc, category: 'Navigation', run: () => save(true) },
      { id: 'undo', label: '撤销', hint: '撤销上一步操作', keywords: ['undo', '撤销'], icon: <IconUndo width={15} height={15} />, shortcut: 'Ctrl+Z', disabled: !doc, category: 'Navigation', run: () => undo() },
      { id: 'redo', label: '重做', hint: '重做被撤销的操作', keywords: ['redo', '重做'], icon: <IconRedo width={15} height={15} />, shortcut: 'Ctrl+Shift+Z', disabled: !doc, category: 'Navigation', run: () => redo() },

      // ---- Tools ----
      { id: 'ocr', label: 'OCR 文字识别', hint: '识别扫描件中的文字', keywords: ['ocr', '识别'], icon: <IconOcr width={15} height={15} />, disabled: !doc, category: 'Tools', run: () => dispatch('menu:ocr') },
    ];
    // 主题切换命令
    for (const t of THEMES) {
      items.push({
        id: `theme-${t.id}`,
        label: `切换主题：${t.name}`,
        hint: t.description,
        keywords: ['theme', '主题', t.name.toLowerCase()],
        icon: (
          <span className="flex h-3.5 w-3.5 rounded-full ring-1 ring-black/10" style={{ background: t.preview.accent }} />
        ),
        category: 'View',
        run: () => setThemeId(t.id as ThemeId),
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, currentPage, openFile, save, undo, redo, setPanelOpen, setSettingsOpen, toggleReadingMode, setThemeId]);

  // 过滤（fuzzy）
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      fuzzyMatch(q, c.label) ||
      fuzzyMatch(q, c.hint ?? '') ||
      c.keywords?.some((k) => fuzzyMatch(q, k))
    );
  }, [commands, query]);

  // 按分类分组（保留原顺序）
  const grouped = useMemo(() => {
    const groups = new Map<CommandCategory, CommandItem[]>();
    for (const c of filtered) {
      if (!groups.has(c.category)) groups.set(c.category, []);
      groups.get(c.category)!.push(c);
    }
    return CATEGORY_ORDER.filter((cat) => groups.has(cat)).map((cat) => ({ cat, items: groups.get(cat)! }));
  }, [filtered]);

  // 扁平列表用于键盘导航
  const flat = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  // 重置
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // 键盘导航
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flat[activeIdx];
        if (cmd && !cmd.disabled) {
          cmd.run();
          onClose();
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, flat, activeIdx, onClose]);

  // 滚动到活跃项
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[9500] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative w-[560px] max-w-[90vw] overflow-hidden rounded-xl bg-app-elevated shadow-elev3"
        style={{ animation: 'palette-in 0.15s ease' }}
      >
        {/* 输入框 */}
        <div className="flex items-center gap-2.5 px-4 py-3">
          <IconCommand width={16} height={16} className="text-fg-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            placeholder="搜索操作…"
            className="flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
          <kbd className="kbd">ESC</kbd>
        </div>
        {/* 命令列表（分类） */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto px-1.5 pb-2">
          {flat.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-fg-subtle">没有匹配的操作</div>
          )}
          {grouped.map(({ cat, items }) => (
            <div key={cat} className="mb-1">
              <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                {cat}
              </div>
              {items.map((cmd) => {
                const idx = flatIdx++;
                return (
                  <button
                    key={cmd.id}
                    data-idx={idx}
                    disabled={cmd.disabled}
                    onClick={() => {
                      if (!cmd.disabled) {
                        cmd.run();
                        onClose();
                      }
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors disabled:opacity-40 ${
                      idx === activeIdx ? 'bg-accent-soft text-accent' : 'text-fg'
                    }`}
                  >
                    <span className={`shrink-0 ${idx === activeIdx ? 'text-accent' : 'text-fg-subtle'}`}>
                      {cmd.icon}
                    </span>
                    <span className="flex-1 truncate text-[13px]">{cmd.label}</span>
                    {cmd.hint && <span className="truncate text-[11px] text-fg-subtle">{cmd.hint}</span>}
                    {cmd.shortcut && <kbd className="kbd">{cmd.shortcut}</kbd>}
                    <IconChevronRight width={12} height={12} className={`shrink-0 ${idx === activeIdx ? 'text-accent' : 'text-fg-subtle'}`} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes palette-in{from{opacity:0;transform:translateY(-6px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
    </div>
  );
}
