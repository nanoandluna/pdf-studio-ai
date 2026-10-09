import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAiStore } from '@stores/aiStore';
import { defaultConfig, validateConfig } from '@ai/config';

let secrets: Record<string, string>;
let bridge: Record<string, any>;
beforeEach(async () => {
  secrets = {};
  bridge = {
    secureGet: vi.fn(async key => secrets[key] ?? ''),
    secureSet: vi.fn(async (key, value) => { secrets[key] = value; }),
  };
  vi.stubGlobal('window', { pdfStudio: bridge });
  await useAiStore.getState().loadConfig();
});

describe('AI provider profiles', () => {
  it('never carries a cloud key into another provider and restores each profile', async () => {
    const store = useAiStore.getState();
    await store.saveConfig({ model: 'deepseek-chat', temperature: 0 }, 'deepseek-secret');
    await store.selectProvider('openai');
    expect(useAiStore.getState().config.apiKey).toBe('');
    await store.saveConfig({ model: 'custom-model' }, 'openai-secret');
    await store.selectProvider('deepseek');
    expect(useAiStore.getState().config).toMatchObject({ apiKey: 'deepseek-secret', temperature: 0 });
    await store.loadConfig();
    await store.selectProvider('openai');
    expect(useAiStore.getState().config).toMatchObject({ apiKey: 'openai-secret', model: 'custom-model' });
    expect(bridge.secureSet.mock.calls.every(([key]: [string]) => key === 'ai.provider')).toBe(true);
  });

  it('migrates the legacy key only to its saved provider', async () => {
    secrets['ai.apiKey'] = 'legacy-key';
    secrets['ai.provider'] = JSON.stringify({ providerId: 'qwen', baseUrl: 'https://example.com/v1', model: 'qwen-plus', activeModel: 'qwen-plus' });
    await useAiStore.getState().loadConfig();
    expect(useAiStore.getState().config.apiKey).toBe('legacy-key');
    await useAiStore.getState().selectProvider('deepseek');
    expect(useAiStore.getState().config.apiKey).toBe('');
  });

  it('reports encryption failure without claiming the new config was saved', async () => {
    const before = useAiStore.getState().config;
    bridge.secureSet.mockRejectedValue(new Error('safeStorage unavailable'));
    expect(await useAiStore.getState().saveConfig({ model: 'changed' }, 'new-key')).toBe(false);
    expect(useAiStore.getState().config).toBe(before);
    expect(useAiStore.getState().chatError).toBeTruthy();
  });

  it('lets Ollama save a custom local model without an API key', async () => {
    await useAiStore.getState().selectProvider('ollama');
    expect(await useAiStore.getState().saveConfig({ model: 'my-local-model', baseUrl: 'http://127.0.0.1:11434/v1' })).toBe(true);
    expect(useAiStore.getState().activeModel).toBe('my-local-model');
  });

  it('rejects cleartext remote endpoints, URL credentials and invalid temperatures', () => {
    for (const baseUrl of ['http://example.com/v1', 'file:///etc/passwd', 'https://user:secret@example.com/v1']) {
      expect(() => validateConfig({ ...defaultConfig('openai'), baseUrl })).toThrow();
    }
    expect(() => validateConfig({ ...defaultConfig('openai'), temperature: NaN })).toThrow();
  });
});
