import type { AIProviderConfig, ProviderId } from '@domain/types';
import { PROVIDER_DEFAULTS } from './providers/registry';

export function defaultConfig(id: ProviderId): AIProviderConfig {
  return { baseUrl: PROVIDER_DEFAULTS[id].baseUrl, model: PROVIDER_DEFAULTS[id].models[0] ?? '', apiKey: '', temperature: 0.7, enabled: false };
}

export function isLocalEndpoint(baseUrl: string): boolean {
  try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname); }
  catch { return false; }
}

export function validateConfig(config: AIProviderConfig): void {
  let url: URL;
  try { url = new URL(config.baseUrl); } catch { throw new Error('请填写完整的 AI Base URL。'); }
  if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || (url.protocol === 'http:' && isLocalEndpoint(config.baseUrl)))) {
    throw new Error('AI 服务需要 HTTPS；本机 localhost / 127.0.0.1 / ::1 可使用 HTTP。');
  }
  if (!config.model.trim()) throw new Error('请填写模型名称。');
  if (!Number.isFinite(config.temperature) || config.temperature < 0 || config.temperature > 2) throw new Error('Temperature 必须介于 0 和 2 之间。');
}
