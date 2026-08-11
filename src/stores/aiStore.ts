// ============================================================
// aiStore — V0.4 AI 状态
// Provider Registry / Model / Streaming / Context Engine / AI Action Proposal
// ============================================================

import { create } from 'zustand';
import type { AIMessage, AIToolCall, AIProviderConfig, ProviderId, AIContextScope, ChatMessage, AIProposedAction } from '@domain/types';
import { ToolRegistry, type PdfActionBus } from '@ai/tools';
import { providerRegistry, PROVIDER_DEFAULTS } from '@ai/providers/registry';
import { buildEngineContext, contextToSystemPrompt, toDocumentContext } from '@ai/context';
import { searchIndex } from '@search/index';
import { viewEngine, commandHistory } from './documentStore';
import { useDocumentStore } from './documentStore';
import { useViewerStore } from './viewerStore';
import { logger } from '@lib/logger';
import { toFriendlyError } from '@lib/errors';
import { beginAiRequest, currentAiRequestSeq } from '@lib/aiAbort';

const SETTINGS_KEY = 'ai.provider';

export interface ToolStep {
  label: string;
  status: 'done' | 'running' | 'pending';
}

interface AiState {
  // ---- 配置 ----
  providerId: ProviderId;
  config: AIProviderConfig;
  providerReady: boolean;
  activeModel: string;
  contextScope: AIContextScope;

  // ---- 会话 ----
  messages: AIMessage[];
  thinking: boolean;
  panelOpen: boolean;
  settingsOpen: boolean;
  chatError: string | null;
  /** 当前工具步骤（UI 展示） */
  toolSteps: ToolStep[];
  /** 流式缓冲（当前生成中） */
  streamingText: string;
  streaming: boolean;
  /** 当前待确认的 AI 操作（V0.4 Action Proposal） */
  pendingActions: AIProposedAction[];
  /** Document Intelligence 结果（V0.4） */
  insights: { title: string; fields: { label: string; value: string }[]; summary: string } | null;
  insightsLoading: boolean;

  loadConfig: () => Promise<void>;
  saveConfig: (patch: Partial<AIProviderConfig>, apiKey?: string) => Promise<void>;
  selectProvider: (id: ProviderId) => Promise<void>;
  selectModel: (model: string) => Promise<void>;
  setContextScope: (s: AIContextScope) => void;
  testConnection: () => Promise<{ ok: boolean; message: string }>;
  /** 发送消息；opts 可携带 AI 上下文（选中文字/指定页） */
  sendMessage: (text: string, opts?: SendOptions) => Promise<void>;
  /** 重试上一条失败的用户消息 */
  retry: () => Promise<void>;
  /** 确认执行待操作的 AI 修改（走 Command 可撤销） */
  confirmActions: () => Promise<void>;
  /** 撤销最近一次 AI 修改 */
  undoAiActions: (messageId: string) => Promise<void>;
  /** 设置待确认操作（供 UI 取消） */
  setPendingActions: (actions: AIProposedAction[]) => void;
  /** 生成 Document Intelligence（分析文档类型/主题/作者/总结） */
  analyzeDocument: () => Promise<void>;
  clearChat: () => void;
  setPanelOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setChatError: (msg: string | null) => void;
  setToolSteps: (steps: ToolStep[]) => void;
}

export interface SendOptions {
  /** 上下文范围（覆盖当前 contextScope） */
  scope?: AIContextScope;
  /** 选中文字（scope=selected-text 时） */
  selectedText?: string;
  /** 选中文字所在页（1-based） */
  selectionPage?: number;
}

const DEFAULT_CONFIG: AIProviderConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  enabled: false,
};

function buildDocumentContext(): { name: string; pageCount: number; currentPage: number; selectedText: string | null } | null {
  const doc = useDocumentStore.getState().document;
  if (!doc) return null;
  const currentPage = useViewerStore.getState().currentPage;
  const selectedText = (window.getSelection()?.toString() ?? '').trim().slice(0, 2000) || null;
  return { name: doc.name, pageCount: doc.pageCount, currentPage, selectedText };
}

export const useAiStore = create<AiState>((set, get) => ({
  providerId: 'deepseek',
  config: DEFAULT_CONFIG,
  providerReady: false,
  activeModel: 'deepseek-chat',
  contextScope: 'document',
  messages: [],
  thinking: false,
  panelOpen: true,
  settingsOpen: false,
  chatError: null,
  toolSteps: [],
  streamingText: '',
  streaming: false,
  pendingActions: [],
  insights: null,
  insightsLoading: false,

  loadConfig: async () => {
    try {
      const apiKey = (await window.pdfStudio.secureGet('ai.apiKey')) ?? '';
      const raw = (await window.pdfStudio.secureGet(SETTINGS_KEY)) ?? '';
      const saved = (() => {
        try {
          return JSON.parse(raw) as Partial<AIProviderConfig> & { providerId?: ProviderId; activeModel?: string; contextScope?: AIContextScope };
        } catch {
          return {};
        }
      })();
      const providerId = (saved.providerId ?? 'deepseek') as ProviderId;
      const def = PROVIDER_DEFAULTS[providerId] ?? PROVIDER_DEFAULTS.deepseek;
      set({
        providerId,
        activeModel: saved.activeModel ?? (def.models[0] ?? ''),
        contextScope: (saved.contextScope as AIContextScope) ?? 'document',
        config: {
          ...DEFAULT_CONFIG,
          ...def,
          ...saved,
          apiKey,
        },
        providerReady: true,
      });
    } catch {
      set({ config: DEFAULT_CONFIG, providerReady: true });
    }
  },

  saveConfig: async (patch, apiKey) => {
    const next = { ...get().config, ...patch };
    set({ config: next });
    try {
      if (apiKey !== undefined) {
        await window.pdfStudio.secureSet('ai.apiKey', apiKey);
        next.apiKey = apiKey;
      }
      const { apiKey: _k, ...rest } = next;
      await window.pdfStudio.secureSet(
        SETTINGS_KEY,
        JSON.stringify({ ...rest, providerId: get().providerId, activeModel: get().activeModel, contextScope: get().contextScope })
      );
    } catch (e) {
      const err = toFriendlyError(e, '保存 AI 配置失败。');
      set({ chatError: err.friendly });
    }
  },

  selectProvider: async (id) => {
    const def = PROVIDER_DEFAULTS[id] ?? PROVIDER_DEFAULTS.custom;
    const provider = providerRegistry.get(id);
    let models: string[] = def.models;
    try {
      const list = await provider.getModels({ ...get().config, baseUrl: def.baseUrl || get().config.baseUrl });
      if (list.length > 0) models = list.map((m) => m.id);
    } catch {
      // 保持默认
    }
    set({
      providerId: id,
      activeModel: models[0] ?? '',
      config: {
        ...get().config,
        ...def,
        model: models[0] ?? '',
      },
    });
    await get().saveConfig({ ...get().config, ...def, model: models[0] ?? '' });
  },

  selectModel: async (model) => {
    set({ activeModel: model, config: { ...get().config, model } });
    await get().saveConfig({ ...get().config, model });
  },

  setContextScope: (scope) => {
    set({ contextScope: scope });
    get().saveConfig({ ...get().config }).catch(() => undefined);
  },

  testConnection: async () => {
    const { providerId, config } = get();
    const provider = providerRegistry.get(providerId);
    return provider.testConnection(config);
  },

  sendMessage: async (text, opts) => {
    const { config, messages, thinking, providerId, activeModel, contextScope } = get();
    if (thinking || !text.trim()) return;
    if (!config.apiKey) {
      set({ settingsOpen: true, chatError: '请先在设置中配置 AI Provider 和 API Key。' });
      return;
    }
    // #8：开始新轮次，使旧请求（若有）失效
    const mySeq = beginAiRequest();

    const ctx = buildDocumentContext();
    // 应用 scope（opts 优先，否则当前 store 的 contextScope）
    const scope = opts?.scope ?? contextScope;
    const selectedText = opts?.selectedText ?? ctx?.selectedText ?? '';
    const selectionPage = opts?.selectionPage;

    // 用户消息：若来自选中文字，附加上下文标记
    const userContent =
      scope === 'selected-text' && selectedText
        ? `${text}\n\n[选中文字 · 第 ${selectionPage ?? ctx?.currentPage ? (selectionPage ?? (ctx?.currentPage ?? 0) + 1) : ''}页]\n${selectedText}`
        : scope === 'current-page'
          ? `${text}\n\n[当前文档 · 第 ${(ctx?.currentPage ?? 0) + 1} 页]`
          : text;

    const userMsg: AIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      createdAt: Date.now(),
    };
    const history = [...messages, userMsg];
    set({ messages: history, thinking: true, chatError: null, toolSteps: [], streamingText: '', streaming: true });

    try {
      const doc = useDocumentStore.getState().document;
      const provider = providerRegistry.get(providerId);

      // ---- V0.4 Action Proposal：AI 提议的操作先收集，等用户确认 ----
      const collected: AIProposedAction[] = [];

      const bus: PdfActionBus = {
        getPageCount: async () => doc?.pageCount ?? 0,
        extractText: async (pageIndex) => {
          if (!doc) return new Map();
          return viewEngine.extractText(doc.id, pageIndex);
        },
        searchText: async (query) => {
          const results = searchIndex.search(query);
          if (results.length > 0) {
            return results.map((r) => ({ pageIndex: r.pageIndex, context: r.context }));
          }
          if (doc) {
            const results2 = await viewEngine.search(doc.id, query);
            return results2.map((r) => ({ pageIndex: r.pageIndex, context: r.context }));
          }
          return [];
        },
        deletePages: async (pages) => {
          await useDocumentStore.getState().deletePages(pages.map((p) => p - 1));
        },
        rotatePages: async (pages, angle) => {
          await useDocumentStore.getState().rotatePages(pages.map((p) => p - 1), angle);
        },
        reorderPages: async (newOrder) => {
          await useDocumentStore.getState().reorderPages(newOrder.map((p) => p - 1));
        },
        extractPages: async (pages) => {
          return useDocumentStore.getState().extractPages(pages.map((p) => p - 1));
        },
        mergePdf: async (_paths) => null,
        summarize: async () => {
          if (!doc) return '当前没有打开的文档。';
          const texts = await viewEngine.extractText(doc.id);
          const full = Array.from(texts.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([i, t]) => `[第${i + 1}页] ${t}`)
            .join('\n');
          return full.slice(0, 100_000);
        },
      };

      // recorder：破坏性工具调用时收集提案，不直接执行
      const registry = new ToolRegistry(bus, (action) => {
        const id = crypto.randomUUID();
        const labels: Record<string, string> = {
          delete: `删除第 ${action.pages.join('、')} 页`,
          rotate: `旋转第 ${action.pages.join('、')} 页 ${action.angle ?? 90}°`,
          reorder: '调整页面顺序',
          extract: `提取第 ${action.pages.join('、')} 页`,
        };
        const proposed: AIProposedAction = {
          ...action,
          id,
          label: action.label ?? labels[action.kind] ?? '修改 PDF',
        };
        collected.push(proposed);
        set({ pendingActions: [...collected] });
        return proposed;
      });
      registry.buildDefaultTools();

      // ---- V0.4 Context Engine：统一注入阅读/选中/页面/搜索上下文 ----
      const engineCtx = await buildEngineContext({
        selection: scope === 'selected-text' && selectedText ? { page: selectionPage ?? (ctx?.currentPage ?? 0) + 1, text: selectedText } : undefined,
        page: scope === 'current-page' ? ctx?.currentPage : undefined,
      });
      const contextPrompt = contextToSystemPrompt(engineCtx);

      const systemPrompt = `你是 PDF Studio AI 的内置 AI 助手（PDF Copilot），帮助用户理解与操作 PDF 文档。
你可以调用工具获取文档信息、提取文本、搜索内容、执行页面操作（删除/旋转/提取等）。
重要原则：删除/旋转/排序/提取等修改 PDF 的操作，调用工具后操作会被记录并等待用户确认，不会立即执行。请在回答中明确告诉用户你准备做什么，等待用户确认。
回答尽量使用 Markdown 排版（标题/列表/加粗），并附上引用页码：来源 [第 N 页]。
${contextPrompt || '当前没有打开任何 PDF 文档。若用户询问文档内容，请先告知需要打开 PDF。'}`;

      const messagesForApi: ChatMessage[] = [
        { role: 'system' as const, content: systemPrompt },
        ...history.map((h) =>
          h.role === 'tool'
            ? { role: 'tool' as const, content: h.content, tool_call_id: h.toolCallId }
            : { role: (h.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user', content: h.content }
        ),
        { role: 'user' as const, content: text },
      ];

      const assistantId = crypto.randomUUID();
      const assistantMsg: AIMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
      };
      set({ messages: [...history, assistantMsg] });

      // 工具调用循环（最多 6 轮）
      let currentMsgs: ChatMessage[] = messagesForApi;
      let finalContent = '';
      let finalCitations: number[] = [];
      let toolRounds = 0;

      while (toolRounds < 6) {
        // 非流式请求以获取 tool calls
        const resp = await provider.chat(
          {
            model: activeModel,
            messages: currentMsgs,
            temperature: config.temperature,
            tools: registry.toOpenAITools() as never[],
            documentContext: toDocumentContext(engineCtx),
          },
          config
        );

        if (resp.toolCalls && resp.toolCalls.length > 0) {
          toolRounds++;
          // 更新 UI：工具步骤
          const steps = resp.toolCalls.map((tc) => ({ label: toolStepLabel(tc.name), status: 'running' as const }));
          set({ toolSteps: steps });
          currentMsgs = [...currentMsgs, { role: 'assistant', content: '', tool_calls: resp.toolCalls.map((tc) => ({ id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.arguments) } })) }];
          for (const call of resp.toolCalls) {
            const result = await registry.execute(call);
            currentMsgs = [...currentMsgs, { role: 'tool', content: result.output, tool_call_id: call.id }];
            // 收集引用
            if (result.data && Array.isArray((result.data as { pages?: number[] }).pages)) {
              finalCitations = [...finalCitations, ...(result.data as { pages: number[] }).pages];
            }
          }
          set({ toolSteps: steps.map((s) => ({ ...s, status: 'done' })) });
          continue;
        }

        // 无工具调用 → 记录已生成内容，进行流式最终回答
        if (resp.content) finalContent = resp.content;
        finalCitations = [...finalCitations, ...extractCitationsLocal(resp.content)];
        break;
      }

      // 流式重放最终回答（若无最终回答，用 stream 获取）
      if (!finalContent) {
        const streamMsgs = currentMsgs.filter((m) => !Array.isArray((m as { tool_calls?: unknown[] }).tool_calls) || (m as { tool_calls?: unknown[] }).tool_calls!.length === 0);
        for await (const chunk of provider.streamChat(
          {
            model: activeModel,
            messages: streamMsgs,
            temperature: config.temperature,
            documentContext: toDocumentContext(engineCtx),
          },
          config
        )) {
          // #8：请求已被新请求/文档关闭取代 → 停止写入
          if (currentAiRequestSeq() !== mySeq) return;
          if (chunk.delta) {
            finalContent += chunk.delta;
            set({ streamingText: finalContent, messages: get().messages.map((m) => (m.id === assistantId ? { ...m, content: finalContent } : m)) });
          }
        }
      }

      // #8：被取代则不再写最终消息
      if (currentAiRequestSeq() !== mySeq) return;

      const final: AIMessage = {
        id: assistantId,
        role: 'assistant',
        content: finalContent,
        citations: finalCitations.length > 0 ? Array.from(new Set(finalCitations)).sort((a, b) => a - b) : undefined,
        // V0.4：AI 提议的操作附到消息（等待用户确认）
        pendingActions: collected.length > 0 ? collected : undefined,
        createdAt: Date.now(),
      };
      set((s) => ({
        messages: s.messages.map((m) => (m.id === assistantId ? final : m)),
        thinking: false,
        streaming: false,
        streamingText: '',
        toolSteps: [],
      }));
    } catch (e) {
      // #8：请求被新请求/文档关闭取代 → 不显示错误
      if (currentAiRequestSeq() !== mySeq) return;
      const err = toFriendlyError(e, 'AI 暂时无法回答这个问题。请检查网络连接或 AI 设置。');
      logger.error('AI chat 失败', { detail: err.detail });
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `**AI 暂时无法回答这个问题。**\n请检查网络连接或 AI 设置。`,
            createdAt: Date.now(),
          },
        ],
        thinking: false,
        streaming: false,
        streamingText: '',
        chatError: err.friendly,
      }));
    }
  },

  retry: async () => {
    const { messages, thinking, chatError } = get();
    if (thinking || !chatError) return;
    // 找到最后一条用户消息重发
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    set({ chatError: null });
    await get().sendMessage(lastUser.content);
  },

  // ---- V0.4：确认执行 AI 提议的操作（走 Command → 可撤销） ----
  confirmActions: async () => {
    const { pendingActions, messages } = get();
    if (pendingActions.length === 0) return;
    const doc = useDocumentStore.getState();
    const executed = pendingActions.map((a) => ({ ...a }));
    try {
      for (const act of pendingActions) {
        if (act.kind === 'delete') {
          await doc.deletePages(act.pages.map((p) => p - 1));
          act.result = `已删除第 ${act.pages.join('、')} 页`;
        } else if (act.kind === 'rotate') {
          await doc.rotatePages(act.pages.map((p) => p - 1), act.angle ?? 90);
          act.result = `已旋转第 ${act.pages.join('、')} 页 ${act.angle ?? 90}°`;
        } else if (act.kind === 'reorder') {
          if (act.newOrder) {
            await doc.reorderPages(act.newOrder.map((p) => p - 1));
            act.result = '已调整页面顺序';
          }
        } else if (act.kind === 'extract') {
          const path = await doc.extractPages(act.pages.map((p) => p - 1));
          act.result = path ? `已提取到 ${path}` : '已取消提取';
        }
      }
      // 把执行结果附加到最后一条 assistant 消息（找不到则新建一条）
      set((s) => {
        const lastAssistant = [...s.messages].reverse().find((m) => m.role === 'assistant');
        return {
          pendingActions: [],
          messages: lastAssistant
            ? s.messages.map((m) =>
                m.id === lastAssistant.id ? { ...m, pendingActions: undefined, executedActions: executed } : m
              )
            : [
                ...s.messages,
                {
                  id: crypto.randomUUID(),
                  role: 'assistant' as const,
                  content: '✓ 已完成',
                  executedActions: executed,
                  createdAt: Date.now(),
                },
              ],
        };
      });
    } catch (e) {
      const err = toFriendlyError(e, '操作执行失败。');
      set({ chatError: err.friendly });
    }
  },

  // ---- V0.4：撤销 AI 修改（CommandHistory.undo） ----
  undoAiActions: async (messageId) => {
    const { messages } = get();
    const target = messages.find((m) => m.id === messageId);
    if (!target?.executedActions) return;
    try {
      // 按操作数量撤销（每个操作在 CommandHistory 中对应一个 command）
      for (let i = 0; i < target.executedActions.length; i++) {
        await commandHistory.undo();
      }
      set((s) => ({
        messages: s.messages.map((m) => (m.id === messageId ? { ...m, executedActions: undefined } : m)),
      }));
    } catch (e) {
      const err = toFriendlyError(e, '撤销失败。');
      set({ chatError: err.friendly });
    }
  },

  // ---- V0.4：Document Intelligence（分析文档类型/主题/作者/总结） ----
  analyzeDocument: async () => {
    const { config, thinking, providerId, activeModel } = get();
    if (!config.apiKey || thinking) return;
    const doc = useDocumentStore.getState().document;
    if (!doc) return;
    set({ insightsLoading: true, insights: null });
    try {
      const provider = providerRegistry.get(providerId);
      const texts = await viewEngine.extractText(doc.id);
      const full = Array.from(texts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([i, t]) => `[第${i + 1}页] ${t}`)
        .join('\n')
        .slice(0, 60_000);
      const prompt = `分析这份 PDF 文档，输出 JSON（不要 Markdown）：
{
  "type": "文档类型（Research Paper / Report / Book / Presentation / Letter / Other）",
  "topics": ["主题1", "主题2", "主题3"],
  "authors": "作者（未知填 unknown）",
  "published": "发布日期（未知填 unknown）",
  "summary": "2-3 句话的中文总结"
}
文档内容：
${full}`;
      const resp = await provider.chat(
        { model: activeModel, messages: [{ role: 'user', content: prompt }], temperature: 0.3, maxTokens: 800 },
        config
      );
      const parsed = parseInsightJson(resp.content);
      if (parsed) {
        set({
          insights: {
            title: doc.name,
            fields: [
              { label: 'Type', value: parsed.type ?? 'Unknown' },
              { label: 'Topics', value: (parsed.topics ?? []).join(' · ') || '—' },
              { label: 'Authors', value: parsed.authors ?? '—' },
              { label: 'Published', value: parsed.published ?? '—' },
            ],
            summary: parsed.summary ?? '',
          },
          insightsLoading: false,
        });
      } else {
        set({ insightsLoading: false, chatError: '无法解析文档分析结果。' });
      }
    } catch (e) {
      const err = toFriendlyError(e, '文档分析失败。请检查网络连接或 AI 设置。');
      set({ insightsLoading: false, insights: null, chatError: err.friendly });
    }
  },

  clearChat: () => set({ messages: [], toolSteps: [], streamingText: '' }),
  setPanelOpen: (open) => set({ panelOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setChatError: (msg) => set({ chatError: msg }),
  setToolSteps: (steps) => set({ toolSteps: steps }),
  setPendingActions: (actions) => set({ pendingActions: actions }),
}));

function toolStepLabel(name: string): string {
  // 用户语言：绝不暴露 tool_call / function / API 等开发者术语
  const map: Record<string, string> = {
    get_pdf_info: '正在读取 PDF',
    get_page_count: '正在统计页数',
    extract_text: '正在阅读相关页面',
    search_text: '正在查找相关内容',
    delete_pages: '正在删除页面',
    rotate_pages: '正在旋转页面',
    extract_pages: '正在提取页面',
    summarize_pdf: '正在总结文档',
  };
  return map[name] ?? '正在处理';
}

export function extractCitationsLocal(content: string): number[] {
  const pages = new Set<number>();
  const re = /第\s*(\d+)\s*(?:-|—|至)\s*(\d+)\s*页|第\s*(\d+)\s*页/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m[1] && m[2]) {
      for (let p = Number(m[1]); p <= Number(m[2]); p++) pages.add(p);
    }
    if (m[3]) pages.add(Number(m[3]));
  }
  return Array.from(pages).sort((a, b) => a - b);
}

interface InsightJson {
  type?: string;
  topics?: string[];
  authors?: string;
  published?: string;
  summary?: string;
}

/** 从 LLM 输出中稳健解析 Document Intelligence JSON */
export function parseInsightJson(content: string): InsightJson | null {
  const text = content.trim();
  // 去掉 ```json 围栏
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as InsightJson;
    if (typeof parsed === 'object' && parsed !== null) return parsed;
    return null;
  } catch {
    // 尝试提取第一个 { ... } 块
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1)) as InsightJson;
        return typeof parsed === 'object' ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }
}
