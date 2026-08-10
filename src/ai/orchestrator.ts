// ============================================================
// AI Orchestrator — 聊天 + Tool Calling 循环
// 处理：意图理解 → 工具执行 → 结果返回（支持多轮工具调用）
// ============================================================

import type { AIProvider } from './provider';
import type { ToolRegistry } from './tools';
import type { AIMessage, AIToolCall, AIProviderConfig, ChatMessage } from '@domain/types';
import { chunkText } from './chunk';
import { logger } from '@lib/logger';
import { FriendlyError } from '@lib/errors';

const MAX_TOOL_ROUNDS = 6;

export class AIOrchestrator {
  constructor(
    private provider: AIProvider,
    private registry: ToolRegistry
  ) {}

  /** 系统提示词 */
  private systemPrompt(currentDoc: { name: string; pageCount: number } | null): string {
    const docInfo = currentDoc
      ? `\n当前已打开文档：${currentDoc.name}（共 ${currentDoc.pageCount} 页）。你可以调用工具来读取/操作这份 PDF。`
      : '\n当前没有打开任何 PDF 文档。若用户询问文档内容，请先告知需要打开 PDF。';
    return `你是 PDF Studio AI 的内置 AI 助手，帮助用户理解与操作 PDF 文档。
你可以调用工具获取文档信息、提取文本、搜索内容、执行页面操作（删除/旋转/提取等）。
执行页面操作前请确认用户意图；对于破坏性操作（如删除页面），明确说明将要执行的动作。
回答尽量附上引用页码，格式：来源：第 N 页。${docInfo}`;
  }

  /**
   * 发送一轮对话（可能包含多轮 tool calling）
   * @param history 历史消息（不含本次输入）
   */
  async chat(
    userInput: string,
    history: AIMessage[],
    opts: {
      currentDoc: { name: string; pageCount: number } | null;
      onMessage?: (msg: AIMessage) => void;
      onToolCall?: (call: AIToolCall) => void;
    }
  ): Promise<AIMessage> {
    const messages: ChatMessage[] = [
      { role: 'system', content: this.systemPrompt(opts.currentDoc) },
      ...history.map((h) => toChatMessage(h)),
      { role: 'user', content: userInput },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const resp = await this.provider.chat(messages, undefined, this.registry.toOpenAITools());

      if (resp.toolCalls && resp.toolCalls.length > 0) {
        // 记录 assistant 的 tool call 消息（供 UI 展示）
        const assistantMsg: AIMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: resp.content || '',
          toolCalls: resp.toolCalls,
          createdAt: Date.now(),
        };
        opts.onMessage?.(assistantMsg);
        messages.push({
          role: 'assistant',
          content: resp.content || '',
          tool_calls: resp.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        });

        for (const call of resp.toolCalls) {
          opts.onToolCall?.(call);
          logger.info('执行 AI 工具', { name: call.name, args: sanitizeArgs(call.arguments) });
          const result = await this.registry.execute(call);
          messages.push({
            role: 'tool',
            content: result.output,
            tool_call_id: call.id,
          });
        }
        continue; // 继续循环，让模型基于工具结果生成最终回答
      }

      // 无工具调用：最终回答
      const citations = extractCitations(resp.content);
      const finalMsg: AIMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: resp.content,
        citations,
        createdAt: Date.now(),
      };
      opts.onMessage?.(finalMsg);
      return finalMsg;
    }

    throw new FriendlyError('AI 工具调用次数过多，已自动停止。请简化问题后重试。');
  }

  /** 总结文档（Map-Reduce） */
  async summarize(fullText: string, opts: { onMessage?: (msg: AIMessage) => void } = {}): Promise<string> {
    const chunks = chunkText(fullText, 4000, 200);
    if (chunks.length === 0) {
      return '文档中没有可提取的文本内容。';
    }
    if (chunks.length === 1) {
      const resp = await this.provider.chat(
        [
          { role: 'system', content: '你是文档摘要助手。请用中文给出简洁、结构化的摘要，包含主要观点与结论。' },
          { role: 'user', content: `请总结以下文档内容：\n\n${chunks[0].text}` },
        ],
        { maxTokens: 1000 }
      );
      return resp.content;
    }

    // Map：每个 chunk 独立摘要
    const partials: string[] = [];
    for (const chunk of chunks) {
      const resp = await this.provider.chat(
        [
          { role: 'system', content: '你是文档摘要助手。请用中文以 3-5 条要点概括以下片段。' },
          { role: 'user', content: `片段 ${chunk.index + 1}/${chunks.length}：\n${chunk.text}` },
        ],
        { maxTokens: 400 }
      );
      partials.push(`【片段 ${chunk.index + 1}（第 ${chunk.pages.join('-')} 页）】\n${resp.content}`);
    }

    // Reduce：合并为最终摘要
    const finalResp = await this.provider.chat(
      [
        { role: 'system', content: '你是文档总结助手。请综合以下各片段要点，用中文输出整份文档的结构化总结（概述、要点、结论），并标注对应页码。' },
        { role: 'user', content: partials.join('\n\n') },
      ],
      { maxTokens: 1200 }
    );
    return finalResp.content;
  }
}

/** 从回复中提取 "第 N 页" / "第 N-M 页" 引用 */
export function extractCitations(content: string): number[] {
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

function toChatMessage(h: AIMessage): ChatMessage {
  if (h.role === 'tool') {
    return { role: 'tool', content: h.content, tool_call_id: h.toolCallId };
  }
  return { role: h.role === 'system' ? 'system' : h.role === 'assistant' ? 'assistant' : 'user', content: h.content };
}

/** 工具参数日志脱敏 */
function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (typeof v === 'string' && v.length > 500) out[k] = v.slice(0, 500) + '…';
    else out[k] = v;
  }
  return out;
}
