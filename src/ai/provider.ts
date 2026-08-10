// ============================================================
// AI Provider 抽象 — OpenAI-compatible API
// 支持 OpenAI / DeepSeek / Qwen / 任意 OpenAI-compatible endpoint
// ============================================================

import type { AIProviderConfig, ChatMessage, ChatOptions, ChatResponse, AIToolCall } from '@domain/types';
import { logger } from '@lib/logger';
import { FriendlyError } from '@lib/errors';

export interface AIProvider {
  chat(messages: ChatMessage[], options?: ChatOptions, tools?: unknown[]): Promise<ChatResponse>;
  testConnection(config: AIProviderConfig): Promise<{ ok: boolean; message: string }>;
}

interface OpenAIChoice {
  message?: {
    content?: string | null;
    tool_calls?: {
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }[];
  };
  finish_reason?: string;
}

export class OpenAICompatibleProvider implements AIProvider {
  constructor(private config: AIProviderConfig) {}

  private endpoint(): string {
    let base = this.config.baseUrl.trim().replace(/\/+$/, '');
    if (!/\/chat\/completions$/.test(base)) base += '/chat/completions';
    return base;
  }

  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
    tools?: unknown[]
  ): Promise<ChatResponse> {
    if (!this.config.apiKey) {
      throw new FriendlyError('尚未配置 AI API Key，请先在设置中填写。');
    }
    const url = this.endpoint();
    const body: Record<string, unknown> = {
      model: options?.model ?? this.config.model,
      messages,
      temperature: options?.temperature ?? this.config.temperature ?? 0.7,
    };
    if (options?.maxTokens) body.max_tokens = options.maxTokens;
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      logger.error('AI 请求网络失败', { url, detail });
      throw new FriendlyError(
        '无法连接到 AI 服务，请检查 Base URL 和网络连接。',
        detail
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error('AI 请求失败', { status: res.status, body: text.slice(0, 500) });
      if (res.status === 401 || res.status === 403) {
        throw new FriendlyError('API Key 无效或没有权限，请检查设置。', text.slice(0, 300));
      }
      if (res.status === 404) {
        throw new FriendlyError('模型或接口不存在，请检查 Base URL 和 Model 名称。', text.slice(0, 300));
      }
      if (res.status === 429) {
        throw new FriendlyError('请求过于频繁，请稍后再试。', text.slice(0, 300));
      }
      throw new FriendlyError(`AI 服务返回错误 (${res.status})，请稍后重试。`, text.slice(0, 300));
    }

    const data = (await res.json()) as { choices?: OpenAIChoice[] };
    const choice = data.choices?.[0];
    if (!choice) {
      throw new FriendlyError('AI 服务返回了空响应，请重试。');
    }
    const content = choice.message?.content ?? '';
    const toolCalls: AIToolCall[] = (choice.message?.tool_calls ?? []).map((tc) => {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}');
      } catch {
        args = { raw: tc.function.arguments };
      }
      return { id: tc.id, name: tc.function.name, arguments: args };
    });
    return { content, toolCalls, finishReason: choice.finish_reason };
  }

  async testConnection(config: AIProviderConfig): Promise<{ ok: boolean; message: string }> {
    try {
      const resp = await this.chat(
        [{ role: 'user', content: '请只回复"OK"' }],
        { model: config.model, maxTokens: 8 }
      );
      return { ok: true, message: `连接成功：${resp.content.trim() || 'OK'}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }
}

/** 工厂：由配置创建 Provider */
export function createProvider(config: AIProviderConfig): AIProvider {
  return new OpenAICompatibleProvider(config);
}
