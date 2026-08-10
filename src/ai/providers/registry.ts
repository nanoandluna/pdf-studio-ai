// ============================================================
// AI Provider Registry — V0.2 多 Provider 架构
// OpenAI / DeepSeek / Qwen / Ollama / Custom OpenAI-compatible
// 新增 Provider 只需实现 AIProviderV2 并注册，不修改 Chat 核心
// ============================================================

import type { AIProviderV2, AIProviderConfig, ProviderId } from '@domain/types';

// ---- OpenAI-compatible 基础实现（含 SSE streaming） ----

class OpenAICompatibleV2 implements AIProviderV2 {
  id: ProviderId;
  name: string;
  private defaultModels: string[];

  constructor(id: ProviderId, name: string, defaultModels: string[]) {
    this.id = id;
    this.name = name;
    this.defaultModels = defaultModels;
  }

  private endpoint(config: AIProviderConfig): string {
    let base = config.baseUrl.trim().replace(/\/+$/, '');
    if (!/\/chat\/completions$/.test(base)) base += '/chat/completions';
    return base;
  }

  private headers(config: AIProviderConfig): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) h.Authorization = `Bearer ${config.apiKey}`;
    return h;
  }

  async getModels(): Promise<{ id: string; name: string; providerId: ProviderId; capabilities: { streaming: boolean; toolCalling: boolean; vision: boolean }; contextWindow?: number }[]> {
    return this.defaultModels.map((m) => ({
      id: m,
      name: m,
      providerId: this.id,
      capabilities: { streaming: true, toolCalling: true, vision: m.includes('vision') || m.includes('vl') },
    }));
  }

  async chat(request: Parameters<AIProviderV2['chat']>[0], config: AIProviderConfig) {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? config.temperature ?? 0.7,
    };
    if (request.maxTokens) body.max_tokens = request.maxTokens;
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
      body.tool_choice = 'auto';
    }
    const res = await fetch(this.endpoint(config), {
      method: 'POST',
      headers: this.headers(config),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AI 请求失败 (${res.status}): ${text.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };
    const choice = data.choices?.[0];
    if (!choice) throw new Error('AI 服务返回了空响应');
    const toolCalls = (choice.message?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeParseJson(tc.function.arguments),
    }));
    return {
      content: choice.message?.content ?? '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: choice.finish_reason,
      usage: data.usage
        ? {
            provider: this.name,
            model: request.model,
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *streamChat(request: Parameters<AIProviderV2['streamChat']>[0], config: AIProviderConfig) {
    const body: Record<string, unknown> = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? config.temperature ?? 0.7,
      stream: true,
    };
    if (request.maxTokens) body.max_tokens = request.maxTokens;
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
      body.tool_choice = 'auto';
    }
    const res = await fetch(this.endpoint(config), {
      method: 'POST',
      headers: this.headers(config),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`AI 请求失败 (${res.status}): ${text.slice(0, 300)}`);
    }
    if (!res.body) throw new Error('AI 服务不支持流式响应');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') {
          yield { done: true };
          return;
        }
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] }; finish_reason?: string }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
          };
          const delta = json.choices?.[0]?.delta;
          if (delta?.content) {
            yield { delta: delta.content, done: false };
          }
          if (delta?.tool_calls && delta.tool_calls.length > 0) {
            // 累积 tool call（流式分段）
            yield {
              toolCalls: delta.tool_calls.map((tc) => ({
                id: tc.id,
                name: tc.function.name,
                arguments: safeParseJson(tc.function.arguments),
              })),
              done: false,
            };
          }
        } catch {
          // 忽略无法解析的行
        }
      }
    }
    yield { done: true };
  }

  async testConnection(config: AIProviderConfig) {
    const start = Date.now();
    try {
      const resp = await this.chat(
        { model: config.model, messages: [{ role: 'user', content: 'ping' }], maxTokens: 5 },
        config
      );
      return {
        ok: true,
        message: `连接成功：${resp.content.trim() || 'OK'}`,
        latencyMs: Date.now() - start,
      };
    } catch (e) {
      return {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
        latencyMs: Date.now() - start,
      };
    }
  }
}

function safeParseJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s || '{}');
  } catch {
    return { raw: s };
  }
}

// ---- Provider 定义 ----

export const PROVIDERS: AIProviderV2[] = [
  new OpenAICompatibleV2('openai', 'OpenAI', ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini']),
  new OpenAICompatibleV2('deepseek', 'DeepSeek', ['deepseek-chat', 'deepseek-reasoner']),
  new OpenAICompatibleV2('qwen', 'Qwen', ['qwen-plus', 'qwen-max', 'qwen-turbo']),
  new OpenAICompatibleV2('ollama', 'Ollama (本地)', ['llama3', 'qwen2.5', 'mistral']),
  new OpenAICompatibleV2('custom', 'Custom API', []),
];

/** 各 Provider 默认配置 */
export const PROVIDER_DEFAULTS: Record<ProviderId, { baseUrl: string; models: string[] }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini'] },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-max', 'qwen-turbo'] },
  ollama: { baseUrl: 'http://localhost:11434/v1', models: ['llama3', 'qwen2.5'] },
  custom: { baseUrl: '', models: [] },
};

export class AIProviderRegistry {
  private providers = new Map<ProviderId, AIProviderV2>();

  constructor() {
    for (const p of PROVIDERS) this.register(p);
  }

  register(provider: AIProviderV2): void {
    this.providers.set(provider.id, provider);
  }

  get(id: ProviderId): AIProviderV2 {
    const p = this.providers.get(id);
    if (!p) throw new Error(`未知 Provider: ${id}`);
    return p;
  }

  list(): AIProviderV2[] {
    return Array.from(this.providers.values());
  }
}

export const providerRegistry = new AIProviderRegistry();
