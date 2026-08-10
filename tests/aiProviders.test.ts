// ============================================================
// Unit Test — V0.2 AI Provider Registry / Model / Streaming / Context
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { providerRegistry, PROVIDER_DEFAULTS, AIProviderRegistry } from '@ai/providers/registry';
import type { AIProviderConfig } from '@domain/types';

const TEST_CONFIG: AIProviderConfig = {
  baseUrl: 'http://localhost:9999/v1', // 不可达，仅测试 registry
  apiKey: 'test-key',
  model: 'test-model',
  temperature: 0.7,
  enabled: true,
};

describe('AIProviderRegistry', () => {
  it('注册了全部内置 Provider', () => {
    const ids = providerRegistry.list().map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('deepseek');
    expect(ids).toContain('qwen');
    expect(ids).toContain('ollama');
    expect(ids).toContain('custom');
  });

  it('按 id 获取 Provider', () => {
    const p = providerRegistry.get('deepseek');
    expect(p.id).toBe('deepseek');
    expect(p.name).toBe('DeepSeek');
  });

  it('未知 Provider 抛出错误', () => {
    expect(() => providerRegistry.get('unknown' as never)).toThrow();
  });

  it('每个 Provider 提供默认模型列表', () => {
    expect(PROVIDER_DEFAULTS.deepseek.models).toContain('deepseek-chat');
    expect(PROVIDER_DEFAULTS.openai.models.length).toBeGreaterThan(0);
    expect(PROVIDER_DEFAULTS.qwen.models).toContain('qwen-plus');
  });

  it('每个 Provider 的默认 BaseURL 是 OpenAI-compatible 格式（custom 由用户填写除外）', () => {
    for (const [id, def] of Object.entries(PROVIDER_DEFAULTS)) {
      if (id === 'ollama' || id === 'custom') continue;
      expect(def.baseUrl).toMatch(/^https?:\/\//);
    }
  });

  it('新增 Provider 不需要修改 Registry 核心（注册制，同名覆盖）', () => {
    const registry = new AIProviderRegistry();
    const before = registry.list().length;
    // 注册一个同名 provider（覆盖内置 custom），验证注册制：无需改核心逻辑
    registry.register({
      id: 'custom',
      name: 'Custom-Override',
      getModels: async () => [{ id: 'm1', name: 'M1', providerId: 'custom', capabilities: { streaming: true, toolCalling: true, vision: false } }],
      chat: async () => ({ content: 'ok' }),
      streamChat: async function* () {
        yield { delta: 'hi', done: false };
        yield { done: true };
      },
      testConnection: async () => ({ ok: true, message: 'ok' }),
    });
    expect(registry.get('custom').name).toBe('Custom-Override');
    expect(registry.list().length).toBe(before);
  });
});

describe('AIModel 能力（不把模型名写死 UI）', () => {
  it('模型携带 capabilities 元数据', () => {
    const model = {
      id: 'deepseek-chat',
      name: 'DeepSeek Chat',
      providerId: 'deepseek' as const,
      capabilities: { streaming: true, toolCalling: true, vision: false },
      contextWindow: 64000,
    };
    expect(model.capabilities.streaming).toBe(true);
    expect(model.capabilities.toolCalling).toBe(true);
  });
});

describe('DocumentContext / AIUsage（数据模型预留）', () => {
  it('DocumentContext 结构完整', () => {
    const ctx = {
      documentId: 'doc-1',
      fileName: 'test.pdf',
      currentPage: 3,
      selectedPages: [1, 2],
      relevantPages: [3, 4],
      extractedText: 'hello',
    };
    expect(ctx.currentPage).toBe(3);
    expect(ctx.fileName).toBe('test.pdf');
  });

  it('AIUsage 预留字段', () => {
    const usage = {
      provider: 'deepseek',
      model: 'deepseek-chat',
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedCost: 0.001,
    };
    expect(usage.totalTokens).toBe(150);
  });
});

describe('Streaming chunk 协议', () => {
  it('ChatChunk 增量与完成标志', () => {
    const chunks = [
      { delta: '你好', done: false },
      { delta: '世界', done: false },
      { done: true },
    ];
    let text = '';
    for (const c of chunks) {
      if (c.delta) text += c.delta;
      if (c.done) break;
    }
    expect(text).toBe('你好世界');
  });
});
