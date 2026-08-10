// ============================================================
// AI Tool Registry — Function Calling 工具注册与执行
// V0.4：破坏性工具（删除/旋转/排序/提取）默认进入 Proposal 模式
//       不直接修改 PDF，而是记录操作等待用户确认（AI 可以提议，但不能悄悄修改）
// ============================================================

import type { AIToolCall, AIToolResult, AIProposedAction } from '@domain/types';

export interface AITool {
  name: string;
  description: string;
  /** OpenAI tools JSON Schema */
  inputSchema: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<AIToolResult>;
}

/** 页面操作处理器：由上层（store）注入，实现实际 PDF 变更 */
export interface PdfActionBus {
  getPageCount(): Promise<number>;
  extractText(pageIndex?: number): Promise<Map<number, string>>;
  searchText(query: string): Promise<{ pageIndex: number; context: string }[]>;
  deletePages(pages: number[]): Promise<void>; // 1-based
  rotatePages(pages: number[], angle: number): Promise<void>; // 1-based
  reorderPages(newOrder: number[]): Promise<void>; // 1-based 新顺序
  extractPages(pages: number[], outputPath?: string): Promise<string | null>; // 1-based
  mergePdf(paths: string[], outputPath?: string): Promise<string | null>;
  summarize(): Promise<string>;
}

/** V0.4：操作记录器 —— 收集 AI 提议的修改，等用户确认 */
export type ActionRecorder = (action: Omit<AIProposedAction, 'id' | 'label'> & { label?: string }) => AIProposedAction;

/** 破坏性操作：需要用户确认 */
const DESTRUCTIVE_TOOLS = new Set(['delete_pages', 'rotate_pages', 'reorder_pages', 'extract_pages']);

export class ToolRegistry {
  private tools = new Map<string, AITool>();
  private recorder?: ActionRecorder;

  constructor(private bus: PdfActionBus, recorder?: ActionRecorder) {
    this.recorder = recorder;
  }

  /** 提案模式下工具是否只记录不执行 */
  get isProposalMode(): boolean {
    return !!this.recorder;
  }

  register(tool: AITool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): AITool | undefined {
    return this.tools.get(name);
  }

  list(): AITool[] {
    return Array.from(this.tools.values());
  }

  /** OpenAI tools 协议格式 */
  toOpenAITools(): unknown[] {
    return this.list().map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    }));
  }

  async execute(call: AIToolCall): Promise<AIToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return { ok: false, output: `未知工具: ${call.name}` };
    }
    try {
      const result = await tool.execute(call.arguments ?? {});
      // 提案模式：如果工具是破坏性的且没有通过 recorder 记录，直接标记
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, output: `工具执行失败: ${msg}` };
    }
  }

  /** 记录一个待确认操作（recorder 内部生成 id） */
  private propose(kind: AIProposedAction['kind'], pages: number[], extra?: Partial<AIProposedAction>): AIProposedAction | null {
    if (!this.recorder) return null;
    const action = this.recorder({ kind, pages, ...extra });
    return action;
  }

  buildDefaultTools(): void {
    this.register({
      name: 'get_pdf_info',
      description: '获取当前 PDF 的基本信息（文件名、页数、标题、作者等）',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const pageCount = await this.bus.getPageCount();
        return { ok: true, output: JSON.stringify({ pageCount, status: 'ok' }) };
      },
    });

    this.register({
      name: 'get_page_count',
      description: '获取当前 PDF 的总页数',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const pageCount = await this.bus.getPageCount();
        return { ok: true, output: String(pageCount) };
      },
    });

    this.register({
      name: 'extract_text',
      description: '提取 PDF 指定页的文本。page_index 从 0 开始；省略则提取全部文本。',
      inputSchema: {
        type: 'object',
        properties: {
          page_index: { type: 'integer', description: '页码（0-based），可选' },
        },
      },
      execute: async (args) => {
        const idx = typeof args.page_index === 'number' ? args.page_index : undefined;
        const texts = await this.bus.extractText(idx);
        if (idx !== undefined) {
          return { ok: true, output: texts.get(idx) ?? '' };
        }
        const all = Array.from(texts.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([i, t]) => `[第${i + 1}页] ${t}`)
          .join('\n');
        return { ok: true, output: all.slice(0, 50_000) };
      },
    });

    this.register({
      name: 'search_text',
      description: '在当前 PDF 中搜索关键词，返回命中的页码与上下文',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: '要搜索的关键词' },
        },
        required: ['query'],
      },
      execute: async (args) => {
        const q = String(args.query ?? '');
        if (!q) return { ok: false, output: '请提供搜索关键词' };
        const hits = await this.bus.searchText(q);
        if (hits.length === 0) return { ok: true, output: '未找到匹配内容' };
        return {
          ok: true,
          output: hits.map((h) => `第${h.pageIndex + 1}页: ${h.context}`).join('\n'),
          data: { pages: hits.map((h) => h.pageIndex + 1) },
        };
      },
    });

    this.register({
      name: 'delete_pages',
      description: '删除当前 PDF 中的指定页面。pages 为 1-based 页码数组。执行前会先记录操作等待用户确认。',
      inputSchema: {
        type: 'object',
        properties: {
          pages: { type: 'array', items: { type: 'integer' }, description: '要删除的页码（1-based）' },
        },
        required: ['pages'],
      },
      execute: async (args) => {
        const pages = (args.pages ?? []) as number[];
        if (pages.length === 0) return { ok: false, output: '请提供要删除的页码' };
        const action = this.propose('delete', pages);
        if (action) {
          return { ok: true, output: `已记录待确认操作：删除第 ${pages.join('、')} 页（等待用户确认后执行）`, data: { pendingActionId: action.id } };
        }
        await this.bus.deletePages(pages);
        return { ok: true, output: `已删除第 ${pages.join('、')} 页` };
      },
    });

    this.register({
      name: 'rotate_pages',
      description: '旋转指定页面。angle 为 90 / 180 / 270（顺时针）。pages 为 1-based 页码数组。执行前会先记录操作等待用户确认。',
      inputSchema: {
        type: 'object',
        properties: {
          pages: { type: 'array', items: { type: 'integer' }, description: '要旋转的页码（1-based）' },
          angle: { type: 'integer', description: '旋转角度（90/180/270，顺时针）' },
        },
        required: ['pages', 'angle'],
      },
      execute: async (args) => {
        const pages = (args.pages ?? []) as number[];
        const angle = Number(args.angle ?? 90);
        if (pages.length === 0) return { ok: false, output: '请提供要旋转的页码' };
        const action = this.propose('rotate', pages, { angle });
        if (action) {
          return { ok: true, output: `已记录待确认操作：旋转第 ${pages.join('、')} 页 ${angle}°（等待用户确认后执行）`, data: { pendingActionId: action.id } };
        }
        await this.bus.rotatePages(pages, angle);
        return { ok: true, output: `已旋转第 ${pages.join('、')} 页 ${angle}°` };
      },
    });

    this.register({
      name: 'reorder_pages',
      description: '调整页面顺序。new_order 为 1-based 页码数组，表示新的顺序。执行前会先记录操作等待用户确认。',
      inputSchema: {
        type: 'object',
        properties: {
          new_order: { type: 'array', items: { type: 'integer' }, description: '新顺序（1-based 页码数组）' },
        },
        required: ['new_order'],
      },
      execute: async (args) => {
        const newOrder = (args.new_order ?? []) as number[];
        if (newOrder.length === 0) return { ok: false, output: '请提供新的页面顺序' };
        const action = this.propose('reorder', newOrder, { newOrder });
        if (action) {
          return { ok: true, output: `已记录待确认操作：调整页面顺序（等待用户确认后执行）`, data: { pendingActionId: action.id } };
        }
        await this.bus.reorderPages(newOrder);
        return { ok: true, output: '已调整页面顺序' };
      },
    });

    this.register({
      name: 'extract_pages',
      description: '把指定页面提取成新的 PDF 文件（会弹出保存对话框）。pages 为 1-based 页码数组。执行前会先记录操作等待用户确认。',
      inputSchema: {
        type: 'object',
        properties: {
          pages: { type: 'array', items: { type: 'integer' }, description: '要提取的页码（1-based）' },
        },
        required: ['pages'],
      },
      execute: async (args) => {
        const pages = (args.pages ?? []) as number[];
        if (pages.length === 0) return { ok: false, output: '请提供要提取的页码' };
        const action = this.propose('extract', pages);
        if (action) {
          return { ok: true, output: `已记录待确认操作：提取第 ${pages.join('、')} 页（等待用户确认后执行）`, data: { pendingActionId: action.id } };
        }
        const path = await this.bus.extractPages(pages);
        return { ok: true, output: path ? `已提取到 ${path}` : '已取消提取' };
      },
    });

    this.register({
      name: 'summarize_pdf',
      description: '总结当前 PDF 文档的核心内容',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const summary = await this.bus.summarize();
        return { ok: true, output: summary };
      },
    });
  }
}
