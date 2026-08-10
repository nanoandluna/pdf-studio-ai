// ============================================================
// AiPanel — ✦ PDF Copilot（V0.3.1 AI Workspace）
// AIHeader / Document Context / Markdown Message / Citation / AIInput
// ============================================================

import { useEffect, useRef, useState } from 'react';
import { useAiStore } from '@stores/aiStore';
import { useDocumentStore } from '@stores/documentStore';
import { useViewerStore } from '@stores/viewerStore';
import { useWorkspaceStore, AI_PANEL_MIN, AI_PANEL_MAX } from '@stores/workspaceStore';
import { PROVIDER_DEFAULTS } from '@ai/providers/registry';
import type { AIMessage, AIContextScope, AIProposedAction } from '@domain/types';
import { Badge, Button } from './ui';
import { Dropdown } from './ui/dropdown';
import {
  IconSend, IconSettings, IconSpark, IconClose, IconChevronDown, IconChevronLeft,
  IconChevronRight, IconBookOpen, IconExpand, IconShrink, IconLoading,
} from './icons';
import { Markdown, extractCitationsFromMd } from './markdown';

export function AiPanel(): JSX.Element | null {
  const { aiPanelWidth, setAiPanelWidth, aiPanelOpen, setAiPanelOpen, aiMode, setAiMode } = useWorkspaceStore();
  const { messages, thinking, sendMessage, clearChat, setSettingsOpen, contextScope, setContextScope, activeModel, selectModel, providerId, toolSteps, streaming, chatError, retry, pendingActions, confirmActions, insights, insightsLoading, analyzeDocument } = useAiStore();
  const document = useDocumentStore((s) => s.document);
  const { gotoPage, currentPage } = useViewerStore();
  const [input, setInput] = useState('');
  const [dragStart, setDragStart] = useState<{ x: number; w: number } | null>(null);
  const [insightOpen, setInsightOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming, thinking]);

  if (!aiPanelOpen) return null;

  const submit = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    await sendMessage(text);
  };

  // Provider 显示名（UI 不直接依赖 registry，保持 Service 抽象）
  const PROVIDER_NAMES: Record<string, string> = {
    openai: 'OpenAI', deepseek: 'DeepSeek', qwen: 'Qwen', ollama: 'Ollama (本地)', custom: 'Custom API',
  };
  const providerName = PROVIDER_NAMES[providerId] ?? providerId;
  const modelOptions = PROVIDER_DEFAULTS[providerId]?.models.map((m) => ({
    label: m,
    value: m,
    group: providerName,
  })) ?? [];

  // 当前页快捷操作
  const currentPageLabel = currentPage + 1;
  const quickActions = document
    ? [
        { label: '✦ 总结这份 PDF', prompt: '请总结这份 PDF 文档的核心内容。' },
        { label: '✦ 提取关键内容', prompt: '请提取这份 PDF 的关键要点和结论。' },
        { label: '✦ 找出重要数据', prompt: '请找出这份 PDF 中的重要数据、数字和结论。' },
        { label: `✦ 解释第 ${currentPageLabel} 页`, prompt: `请解释第 ${currentPageLabel} 页的内容。` },
        { label: '✦ 翻译当前页面', prompt: `请把第 ${currentPageLabel} 页的内容翻译成中文。` },
        { label: '✦ 生成表格', prompt: '请把这份 PDF 中的结构化信息提取成 Markdown 表格。' },
      ]
    : [];

  return (
    <div
      className="relative flex shrink-0 flex-col border-l border-app-border-faint bg-app-panel"
      style={{ width: aiMode === 'focus' ? '58%' : aiPanelWidth }}
    >
      {/* Resize 手柄 */}
      <div
        className="group absolute -left-1 top-0 z-20 h-full w-2 cursor-col-resize"
        onMouseDown={(e) => {
          e.preventDefault();
          setDragStart({ x: e.clientX, w: aiPanelWidth });
          const onMove = (ev: MouseEvent) => {
            if (dragStartRef.current) {
              const delta = dragStartRef.current.x - ev.clientX;
              setAiPanelWidth(dragStartRef.current.w + delta);
            }
          };
          const onUp = () => {
            setDragStart(null);
            dragStartRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          dragStartRef.current = dragStart;
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >
        <div className="absolute inset-y-0 -left-px w-px bg-app-border-faint transition-colors group-hover:bg-accent/50" />
      </div>

      {/* ============ Header（V0.3 简洁） ============ */}
      <div className="flex h-11 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-title flex items-center gap-2">
            <IconSpark width={15} height={15} className="text-accent" />
            PDF Copilot
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Privacy Indicator */}
          <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
            {providerId === 'ollama' ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> 本地
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-info" /> Cloud
              </>
            )}
          </span>
          <button
            title="AI Focus 模式（宽面板）"
            onClick={() => setAiMode(aiMode === 'focus' ? 'normal' : 'focus')}
            className={`rounded-md p-1.5 transition-colors ${aiMode === 'focus' ? 'text-accent' : 'text-fg-subtle hover:text-fg'}`}
          >
            {aiMode === 'focus' ? <IconShrink width={14} height={14} /> : <IconExpand width={14} height={14} />}
          </button>
          <button title="清空对话" onClick={clearChat} className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-app-panel-hover hover:text-fg">
            <IconClose width={14} height={14} />
          </button>
          <button title="AI 设置" onClick={() => setSettingsOpen(true)} className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-app-panel-hover hover:text-fg">
            <IconSettings width={14} height={14} />
          </button>
          <button title="收起面板" onClick={() => setAiPanelOpen(false)} className="rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-app-panel-hover hover:text-fg">
            <IconChevronRight width={14} height={14} />
          </button>
        </div>
      </div>

      {/* 文档上下文 + Model（V0.3：合并成一行，typography 层级） */}
      <div className="flex shrink-0 items-center justify-between px-4 pb-3">
        <div className="flex min-w-0 items-center gap-1.5 text-secondary">
          <IconBookOpen width={13} height={13} className="shrink-0 text-fg-subtle" />
          <span className="truncate text-fg">{document ? document.name : '未打开文档'}</span>
          {document && <span className="text-fg-subtle">· {document.pageCount} 页</span>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {document && (
            <button
              onClick={() => {
                setInsightOpen((o) => !o);
                if (!insights && !insightsLoading) analyzeDocument();
              }}
              className="rounded-md bg-app-panel-hover px-2 py-1 text-[11px] text-fg-muted transition-colors hover:bg-app-panel-active hover:text-fg"
              title="Document Intelligence"
            >
              {insightsLoading ? '分析中…' : '分析'}
            </button>
          )}
          <Dropdown
            className="w-auto min-w-[120px]"
            placeholder="模型"
            value={activeModel}
            onChange={(v) => selectModel(v)}
            items={modelOptions.length > 0 ? modelOptions : [{ label: activeModel || '默认模型', value: activeModel }]}
          />
        </div>
      </div>

      {/* Document Intelligence（V0.4：不自动弹，用户点「分析」后展开） */}
      {document && insightOpen && (
        <InsightsPanel insights={insights} loading={insightsLoading} onAnalyze={analyzeDocument} />
      )}

      {/* ============ Messages ============ */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-2">
        {messages.length === 0 && (
          <div className="space-y-5">
            {/* AI Welcome（V0.3：typography 层级，无 Card） */}
            <div className="pt-2">
              <div className="text-title flex items-center gap-2">
                <IconSpark width={15} height={15} className="text-accent" />
                {document ? '这份文档，我可以帮你' : 'PDF Copilot'}
              </div>
              <p className="mt-2 text-body text-fg-muted">
                {document
                  ? '总结、解释、提取信息、搜索内容，也可以帮你直接操作 PDF。'
                  : '打开一个 PDF 后，我可以帮你总结、搜索和分析文档内容。'}
              </p>
            </div>

            {/* AI Quick Actions（V0.3：文字列表，不用矩形按钮） */}
            {document && (
              <div className="space-y-0.5">
                {quickActions.map((q) => (
                  <button
                    key={q.label}
                    disabled={thinking}
                    onClick={() => {
                      setInput('');
                      sendMessage(q.prompt);
                    }}
                    className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-fg transition-colors hover:bg-app-panel-hover hover:text-accent disabled:opacity-40"
                  >
                    <IconSpark width={11} height={11} className="shrink-0 text-accent/70" />
                    <span className="flex-1">{q.label}</span>
                    <IconChevronRight width={12} height={12} className="text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            )}

            {/* 无上下文提示 */}
            {!document && (
              <div className="text-secondary leading-relaxed text-fg-subtle">
                当前没有打开 PDF。
                <br />
                打开一个 PDF 后，我可以帮你总结、搜索和分析。
              </div>
            )}
          </div>
        )}

        {/* Tool Steps（V0.3：用户语言，无开发者术语） */}
        {thinking && toolSteps.length > 0 && (
          <div className="space-y-1.5">
            {toolSteps.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[13px]">
                {s.status === 'done' ? (
                  <span className="text-success">✓</span>
                ) : s.status === 'running' ? (
                  <span className="text-accent">●</span>
                ) : (
                  <span className="text-fg-subtle">○</span>
                )}
                <span className={s.status === 'running' ? 'text-fg' : 'text-fg-muted'}>{s.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2.5 text-[13px]">
              <span className="text-accent">●</span>
              <span className="text-fg-muted">正在整理答案</span>
            </div>
          </div>
        )}

        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            onJumpPage={(p) => gotoPage(p)}
            onConfirmActions={confirmActions}
            onUndoActions={() => useAiStore.getState().undoAiActions(m.id)}
          />
        ))}

        {/* V0.4：待确认的 AI 操作（Action Proposal，独立于消息列表显示） */}
        {pendingActions.length > 0 && !thinking && (
          <ActionProposalCard actions={pendingActions} onConfirm={confirmActions} />
        )}

        {/* 流式光标 */}
        {streaming && !thinking && (
          <div className="flex items-center gap-1.5 text-secondary text-fg-subtle">
            <span className="inline-block h-3 w-0.5 animate-pulse bg-accent" />
            正在生成…
          </div>
        )}
        {thinking && toolSteps.length === 0 && (
          <div className="flex items-center gap-2 text-secondary text-fg-subtle">
            <IconLoading width={12} height={12} /> AI 正在思考…
          </div>
        )}

        {chatError && (
          <div className="space-y-2 rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
            <div>{chatError}</div>
            <button
              onClick={retry}
              className="rounded-md bg-app-panel px-2.5 py-1 text-[11px] font-medium text-fg transition-colors hover:bg-app-panel-hover"
            >
              重试
            </button>
          </div>
        )}
      </div>

      {/* ============ Input（V0.3：elevated, 无重边框） ============ */}
      <div className="shrink-0 px-4 pb-4 pt-1">
        <div className="flex items-end gap-2 rounded-xl bg-app-panel-hover p-2 shadow-elev1 transition-colors focus-within:bg-app-panel focus-within:ring-2 focus-within:ring-accent/25">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="问问这个 PDF..."
            className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent px-1.5 py-1 text-[14px] text-fg outline-none placeholder:text-fg-subtle"
          />
          <button
            onClick={submit}
            disabled={!input.trim() || thinking}
            className="btn-primary h-8 w-8 shrink-0 rounded-lg p-0"
            title="发送 (Ctrl+Enter)"
          >
            <IconSend width={14} height={14} />
          </button>
        </div>
        {/* 底部 context 状态（V0.3） */}
        <div className="mt-2 flex items-center justify-between px-1">
          <ContextChip
            label={contextLabel(contextScope, currentPage + 1)}
            onClick={() => setContextScope(nextScope(contextScope))}
          />
          <span className="text-caption text-fg-subtle">
            {providerId === 'ollama' ? '本地模型' : 'PDF 本地提取 · 仅发送相关文本'}
          </span>
        </div>
        {document && providerId !== 'ollama' && (
          <p className="mt-1.5 text-caption leading-relaxed text-fg-subtle">
            相关文档文本将发送给 {providerName}（云服务）。请勿上传含敏感信息的文件。
          </p>
        )}
      </div>
    </div>
  );
}

// 拖拽引用（模块级，避免闭包问题）
const dragStartRef: { current: { x: number; w: number } | null } = { current: null };

function ContextChip({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button
      onClick={onClick}
      title="点击切换 AI 上下文范围"
      className="flex items-center gap-1 rounded-md bg-app-panel-hover px-2 py-0.5 text-[11px] text-fg-muted transition-colors hover:bg-app-panel-active hover:text-fg"
    >
      {label}
      <IconChevronDown width={10} height={10} />
    </button>
  );
}

function contextLabel(scope: AIContextScope, currentPage: number): string {
  switch (scope) {
    case 'document': return 'AI Context: 当前文档';
    case 'current-page': return `AI Context: 第 ${currentPage} 页`;
    case 'selected-pages': return 'AI Context: 选中页面';
    case 'selected-text': return 'AI Context: 选中文字';
    default: return '当前文档';
  }
}

function nextScope(scope: AIContextScope): AIContextScope {
  const order: AIContextScope[] = ['document', 'current-page', 'selected-text'];
  const idx = order.indexOf(scope);
  return order[(idx + 1) % order.length];
}

// ---------------- Message（V0.3.1 Markdown + V0.4 Action 状态） ----------------
function MessageBubble({
  msg,
  onJumpPage,
  onConfirmActions,
  onUndoActions,
}: {
  msg: AIMessage;
  onJumpPage: (p: number) => void;
  onConfirmActions?: () => void;
  onUndoActions?: () => void;
}): JSX.Element {
  const isUser = msg.role === 'user';
  const isTool = msg.role === 'tool';
  const isAssistant = msg.role === 'assistant';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-br-sm bg-accent/12 px-3.5 py-2 text-body text-fg">
          {msg.content}
        </div>
      </div>
    );
  }

  if (isTool) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-lg bg-app-panel-hover px-3 py-2 font-mono text-[11px] text-fg-muted">
          ⚙️ {msg.content.slice(0, 200)}
        </div>
      </div>
    );
  }

  if (isAssistant) {
    const citationMap = extractCitationsFromMd(msg.content);
    const pages = Array.from(citationMap.values());
    return (
      <div className="flex justify-start">
        <div className="max-w-[94%] space-y-2">
          {msg.content && (
            <div className="markdown-body">
              <Markdown content={msg.content} onCitationClick={onJumpPage} />
            </div>
          )}
          {pages.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {pages.map((p) => (
                <button
                  key={p}
                  onClick={() => onJumpPage(p)}
                  className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20"
                  title={`跳转到第 ${p} 页`}
                >
                  p.{p}
                </button>
              ))}
            </div>
          )}
          {/* V0.4：已执行的 AI 操作 → 撤销 */}
          {msg.executedActions && msg.executedActions.length > 0 && (
            <div className="mt-1 space-y-1 rounded-lg bg-app-panel-hover/70 px-3 py-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-success">
                ✓ 已完成
              </div>
              {msg.executedActions.map((a) => (
                <div key={a.id} className="text-[12px] text-fg-muted">{a.label}</div>
              ))}
              <button
                onClick={onUndoActions}
                className="mt-1.5 rounded-md bg-app-panel px-2.5 py-1 text-[11px] text-fg transition-colors hover:bg-app-panel-hover hover:text-danger"
              >
                撤销这些修改
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <></>;
}

// ---------------- V0.4：AI Action Proposal 确认卡片 ----------------
function ActionProposalCard({ actions, onConfirm }: { actions: AIProposedAction[]; onConfirm: () => void }): JSX.Element {
  return (
    <div className="space-y-2.5 rounded-lg bg-app-panel-hover/70 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-fg">
        <IconSpark width={13} height={13} className="text-accent" />
        我找到 {actions.length} 项需要修改的操作
      </div>
      <div className="space-y-1">
        {actions.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-[12px] text-fg-muted">
            <span className="text-fg-subtle">◇</span>
            {a.label}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={() => useAiStore.getState().setPendingActions([])}
          className="rounded-md px-2.5 py-1 text-[12px] text-fg-muted transition-colors hover:bg-app-panel hover:text-fg"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          className="rounded-md bg-accent px-3 py-1 text-[12px] font-medium text-accent-on transition-colors hover:bg-accent-hover"
        >
          应用修改
        </button>
      </div>
    </div>
  );
}

// ---------------- V0.4：Document Intelligence ----------------
function InsightsPanel({
  insights,
  loading,
  onAnalyze,
}: {
  insights: { title: string; fields: { label: string; value: string }[]; summary: string } | null;
  loading: boolean;
  onAnalyze: () => void;
}): JSX.Element {
  if (loading) {
    return (
      <div className="shrink-0 border-b border-app-border-faint px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <IconLoading width={12} height={12} /> 正在分析文档…
        </div>
      </div>
    );
  }
  if (!insights) {
    return (
      <div className="shrink-0 border-b border-app-border-faint px-4 py-3">
        <button onClick={onAnalyze} className="text-xs text-accent">运行文档分析</button>
      </div>
    );
  }
  return (
    <div className="shrink-0 border-b border-app-border-faint px-4 py-3">
      <div className="text-caption font-medium uppercase tracking-wider text-fg-subtle">Document Insights</div>
      <div className="mt-2 space-y-1">
        {insights.fields.map((f) => (
          <div key={f.label} className="flex items-start gap-2 text-[12px]">
            <span className="w-16 shrink-0 text-fg-subtle">{f.label}</span>
            <span className="text-fg">{f.value}</span>
          </div>
        ))}
      </div>
      {insights.summary && (
        <div className="mt-2.5 border-t border-app-border-faint pt-2 text-[12px] leading-relaxed text-fg-muted">
          {insights.summary}
        </div>
      )}
    </div>
  );
}
