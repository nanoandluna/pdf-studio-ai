// ============================================================
// SettingsDialog — V0.2 设置（侧栏式：通用/外观/AI/PDF/OCR/快捷键/关于）
// AI Providers 卡片页 / Model Selector / ThemeCard 实时预览
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useAiStore } from '@stores/aiStore';
import { useSettingsStore } from '@stores/settingsStore';
import { providerRegistry, PROVIDER_DEFAULTS } from '@ai/providers/registry';
import { THEMES, type ThemeId } from '@theme/themes';
import { Dialog } from './modal';
import { Button, Badge, Input, Spinner, Divider } from './ui';
import { Dropdown } from './ui/dropdown';
import { IconCheck, IconLoading, IconSpark } from './icons';
import { toastSuccess } from './toast';
import type { AIProviderConfig, ProviderId } from '@domain/types';

type SettingsSection = 'general' | 'appearance' | 'ai' | 'pdf' | 'ocr' | 'shortcuts' | 'about';

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'general', label: '通用' },
  { id: 'appearance', label: '外观' },
  { id: 'ai', label: 'AI' },
  { id: 'pdf', label: 'PDF' },
  { id: 'ocr', label: 'OCR' },
  { id: 'shortcuts', label: '快捷键' },
  { id: 'about', label: '关于' },
];

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Ctrl+O', action: '打开 PDF' },
  { keys: 'Ctrl+S', action: '保存' },
  { keys: 'Ctrl+Shift+S', action: '另存为' },
  { keys: 'Ctrl+F', action: '搜索' },
  { keys: 'Ctrl+K', action: '命令面板' },
  { keys: 'Ctrl+Z / Ctrl+Shift+Z', action: '撤销 / 重做' },
  { keys: 'Ctrl++ / Ctrl+-', action: '放大 / 缩小' },
  { keys: 'Ctrl+0', action: '适合页面' },
  { keys: 'PageUp / PageDown', action: '上一页 / 下一页' },
  { keys: 'Ctrl+E', action: '切换 AI 面板' },
  { keys: 'Ctrl+Shift+R', action: '阅读模式' },
  { keys: 'Ctrl+Enter', action: '发送 AI 消息' },
];

export function SettingsDialog(): JSX.Element | null {
  const { settingsOpen, setSettingsOpen } = useAiStore();
  const [section, setSection] = useState<SettingsSection>('general');

  useEffect(() => {
    if (settingsOpen) setSection('general');
  }, [settingsOpen]);

  return (
    <Dialog open={settingsOpen} title="设置" onClose={() => setSettingsOpen(false)} width="w-[860px]">
      <div className="flex gap-6">
        {/* 左侧导航 */}
        <div className="w-40 shrink-0 space-y-0.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full rounded-md px-3 py-1.5 text-left text-[13px] transition-colors ${
                section === s.id ? 'bg-accent-soft font-medium text-accent' : 'text-fg-muted hover:bg-app-panel-hover hover:text-fg'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {/* 右侧内容 */}
        <div className="min-w-0 flex-1">
          {section === 'general' && <GeneralSection />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'ai' && <AiSection />}
          {section === 'pdf' && <PdfSection />}
          {section === 'ocr' && <OcrSection />}
          {section === 'shortcuts' && <ShortcutsSection />}
          {section === 'about' && <AboutSection />}
        </div>
      </div>
    </Dialog>
  );
}

// ---------------- 通用 ----------------
function GeneralSection(): JSX.Element {
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  return (
    <Section title="通用">
      <Row label="语言" desc="界面显示语言">
        <Dropdown
          className="w-40"
          value={settings.language}
          onChange={(v) => update({ language: v })}
          items={[
            { label: '简体中文', value: 'zh-CN' },
            { label: 'English', value: 'en-US' },
          ]}
        />
      </Row>
      <Row label="AI 数据外发提示" desc="发送内容到云 AI 前显示提示">
        <button
          onClick={() => update({ aiDataNotice: !settings.aiDataNotice })}
          className={`relative h-6 w-11 rounded-full transition-colors ${settings.aiDataNotice ? 'bg-accent' : 'bg-app-panel-hover'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${settings.aiDataNotice ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </Row>
    </Section>
  );
}

// ---------------- 外观 ----------------
function AppearanceSection(): JSX.Element {
  const themeId = useSettingsStore((s) => s.settings.themeId);
  const setThemeId = useSettingsStore((s) => s.setThemeId);
  return (
    <Section title="外观" desc="主题即时切换，无需重启">
      <div className="grid grid-cols-2 gap-3">
        {THEMES.map((t) => {
          const active = themeId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setThemeId(t.id as ThemeId)}
              className={`overflow-hidden rounded-lg border text-left transition-all ${
                active ? 'border-accent ring-2 ring-accent/30' : 'border-app-border hover:border-app-border-strong'
              }`}
            >
              {/* 预览色板 */}
              <div className="flex h-14 items-end gap-1 p-2" style={{ background: t.preview.background }}>
                <div className="h-6 w-1/3 rounded-sm" style={{ background: t.preview.surface }} />
                <div className="h-3 w-1/3 rounded-sm" style={{ background: t.preview.surface }} />
                <div className="h-8 w-1/4 rounded-sm" style={{ background: t.preview.accent }} />
              </div>
              <div className="flex items-center justify-between border-t border-app-border bg-app-panel px-3 py-2">
                <div>
                  <div className="text-[13px] font-medium" style={{ color: t.preview.text }}>{t.name}</div>
                  <div className="text-[10px] text-fg-subtle">{t.description}</div>
                </div>
                {active && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-on">
                    <IconCheck width={11} height={11} />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

// ---------------- AI ----------------
function AiSection(): JSX.Element {
  const { providerId, selectProvider, config, saveConfig, testConnection, activeModel, selectModel } = useAiStore();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [testing, setTesting] = useState<ProviderId | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  useEffect(() => {
    setBaseUrl(config.baseUrl);
    setModel(config.model);
    setTemperature(config.temperature);
  }, [config]);

  const providers = providerRegistry.list();

  const onSaveCurrent = async () => {
    const apiKeyChanged = apiKeyInput.trim() !== '';
    await saveConfig(
      { baseUrl: baseUrl.trim(), model: model.trim(), temperature: Number(temperature) || 0.7, enabled: true },
      apiKeyChanged ? apiKeyInput.trim() : undefined
    );
    setApiKeyInput('');
    toastSuccess('AI 配置已保存');
  };

  const onTest = async (id: ProviderId) => {
    setTesting(id);
    // 保存当前编辑中的配置先
    if (id === providerId) {
      await saveConfig({ baseUrl: baseUrl.trim(), model: model.trim(), temperature: Number(temperature) || 0.7 });
    }
    const result = await testConnection();
    setTestResults((r) => ({ ...r, [id]: result }));
    setTesting(null);
  };

  return (
    <Section title="AI Provider" desc="支持 OpenAI / DeepSeek / Qwen / Ollama / 任意 OpenAI-compatible API">
      {/* Provider 卡片列表 */}
      <div className="space-y-2">
        {providers.map((p) => {
          const isCurrent = p.id === providerId;
          const isConfigured = config.apiKey !== '' || p.id === 'ollama';
          return (
            <div
              key={p.id}
              className={`rounded-lg border p-3 transition-all ${isCurrent ? 'border-accent bg-accent-soft/40' : 'border-app-border hover:border-app-border-strong'}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-app-panel-hover text-[13px] font-semibold text-fg">
                    {p.name[0]}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-fg">{p.name}</div>
                    <div className="flex items-center gap-1.5">
                      {isCurrent ? (
                        <Badge tone="accent" dot>当前</Badge>
                      ) : isConfigured ? (
                        <Badge tone="success" dot>已配置</Badge>
                      ) : (
                        <Badge>未配置</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => onTest(p.id)} disabled={testing === p.id}>
                    {testing === p.id ? <Spinner size={12} /> : '测试'}
                  </Button>
                  <Button size="sm" variant={isCurrent ? 'primary' : 'secondary'} onClick={() => selectProvider(p.id)}>
                    {isCurrent ? '使用中' : '选择'}
                  </Button>
                </div>
              </div>
              {testResults[p.id] && (
                <div className={`mt-2 text-[11px] ${testResults[p.id].ok ? 'text-success' : 'text-danger'}`}>
                  {testResults[p.id].message}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 当前 Provider 配置表单 */}
      {providerId !== 'ollama' && (
        <div className="mt-4 space-y-3 rounded-lg border border-app-border p-3">
          <div className="text-[13px] font-medium text-fg">配置 · {providerRegistry.get(providerId).name}</div>
          <Input
            label="Base URL"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={PROVIDER_DEFAULTS[providerId]?.baseUrl ?? 'https://…'}
          />
          <Input
            label="API Key"
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={config.apiKey ? '••••••••••••（已保存，输入以更换）' : 'sk-…'}
            autoComplete="off"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={activeModel}
            />
            <Input
              label="Temperature（0–2）"
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
          </div>
          <div className="flex justify-end">
            <Button variant="primary" onClick={onSaveCurrent}>保存配置</Button>
          </div>
        </div>
      )}

      {/* Ollama 提示 */}
      {providerId === 'ollama' && (
        <div className="mt-4 rounded-lg border border-app-border p-3 text-xs text-fg-muted">
          Ollama 为本地模型。请确保已启动 <code className="rounded bg-app-panel-hover px-1">ollama serve</code>，并已拉取模型
          （如 <code className="rounded bg-app-panel-hover px-1">ollama pull llama3</code>）。
        </div>
      )}
    </Section>
  );
}

// ---------------- PDF / OCR ----------------
function PdfSection(): JSX.Element {
  return (
    <Section title="PDF" desc="PDF 引擎与渲染设置">
      <Row label="PDF 引擎" desc="当前使用 PDF.js（Apache-2.0）">
        <Badge tone="accent">PDF.js</Badge>
      </Row>
      <Row label="渲染质量" desc="页面渲染的像素密度">
        <Dropdown
          className="w-40"
          value="auto"
          onChange={() => undefined}
          items={[
            { label: '自动（推荐）', value: 'auto' },
            { label: '高清', value: 'high' },
            { label: '标准', value: 'standard' },
          ]}
        />
      </Row>
    </Section>
  );
}

function OcrSection(): JSX.Element {
  return (
    <Section title="OCR" desc="Tesseract.js（WASM，无需系统安装）">
      <Row label="识别语言" desc="首次使用需要联网下载语言模型">
        <Badge tone="info">chi_sim + eng</Badge>
      </Row>
      <div className="rounded-lg border border-app-border bg-app-panel p-3 text-xs leading-relaxed text-fg-muted">
        首次使用 OCR 会从 CDN 下载语言模型（约 10MB），之后可离线使用。识别结果会写入搜索索引，支持全文搜索。
      </div>
    </Section>
  );
}

// ---------------- 快捷键 ----------------
function ShortcutsSection(): JSX.Element {
  return (
    <Section title="快捷键">
      <div className="space-y-1.5">
        {SHORTCUTS.map((s) => (
          <div key={s.action} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-app-panel-hover">
            <span className="text-[13px] text-fg">{s.action}</span>
            <kbd className="kbd">{s.keys}</kbd>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------- 关于 ----------------
function AboutSection(): JSX.Element {
  return (
    <Section title="关于">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
            <path d="M14 2v6h6" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-fg">PDF Studio AI</h3>
        <p className="mt-0.5 text-sm text-fg-muted">Local-first AI PDF Workspace</p>
        <p className="text-xs text-fg-subtle">Version 0.2.0</p>
        <div className="mx-auto mt-4 max-w-[260px] space-y-1 text-left text-xs text-fg-muted">
          <div className="flex justify-between"><span>PDF Engine</span><span className="text-fg">PDF.js</span></div>
          <div className="flex justify-between"><span>AI</span><span className="text-fg">OpenAI Compatible</span></div>
          <div className="flex justify-between"><span>License</span><span className="text-fg">MIT</span></div>
        </div>
      </div>
    </Section>
  );
}

// ---------------- 布局辅助 ----------------
function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {desc && <p className="mb-4 mt-0.5 text-xs text-fg-subtle">{desc}</p>}
      {!desc && <div className="h-4" />}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-app-border px-3 py-2.5">
      <div>
        <div className="text-[13px] text-fg">{label}</div>
        {desc && <div className="text-[11px] text-fg-subtle">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
