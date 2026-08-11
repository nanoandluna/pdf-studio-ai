// ============================================================
// App — 应用壳（V0.2）
// Command Bar / Sidebar / Viewer / PDF Copilot / Status Bar
// 支持：可折叠侧栏、AI Panel 调宽+折叠、Reading Mode、Command Palette
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { ErrorBoundary } from '@components/errorBoundary';
import { Toolbar } from '@components/toolbar';
import { Sidebar } from '@components/sidebar';
import { Viewer } from '@components/viewer';
import { AiPanel } from '@components/aiPanel';
import { StatusBar } from '@components/statusBar';
import { HomePage } from '@components/homePage';
import { SettingsDialog } from '@components/settingsDialog';
import { MergeDialog } from '@components/mergeDialog';
import { SplitDialog } from '@components/splitDialog';
import { OcrDialog } from '@components/ocrDialog';
import { CommandPalette } from '@components/commandPalette';
import { ToastHost, toastSuccess } from '@components/toast';
import { useDocumentStore } from '@stores/documentStore';
import { useViewerStore } from '@stores/viewerStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useRecentFilesStore } from '@stores/recentFilesStore';
import { useAiStore } from '@stores/aiStore';
import { useWorkspaceStore } from '@stores/workspaceStore';
import { searchIndex } from '@search/index';
import { Dialog } from '@components/modal';
import { Button } from '@components/ui';
import { MENU_CHANNELS, menuStoreAction, type MenuChannel } from '@lib/menuChannels';

// 暴露 store 用于自动化测试 / 调试（不影响生产行为）
if (typeof window !== 'undefined') {
  (window as unknown as { __pdfStudioTest__?: unknown }).__pdfStudioTest__ = {
    document: useDocumentStore,
    viewer: useViewerStore,
    settings: useSettingsStore,
    recent: useRecentFilesStore,
    ai: useAiStore,
    workspace: useWorkspaceStore,
  };
}

export default function App(): JSX.Element {
  const document = useDocumentStore((s) => s.document);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const { sidebarCollapsed, aiPanelOpen, aiMode, readingMode, toggleReadingMode } = useWorkspaceStore();

  const loadSettings = useSettingsStore((s) => s.load);
  const loadRecent = useRecentFilesStore((s) => s.load);
  const loadAiConfig = useAiStore((s) => s.loadConfig);
  const setSettingsOpen = useAiStore((s) => s.setSettingsOpen);

  useEffect(() => {
    loadSettings();
    loadRecent();
    loadAiConfig();
  }, [loadSettings, loadRecent, loadAiConfig]);

  // 打开文档时预填充搜索索引（文本层）
  useEffect(() => {
    if (!document) {
      searchIndex.clear();
      return;
    }
    // 文档切换（A→B）时先清掉上一份文档的索引，避免跨文档污染
    searchIndex.clear();
    const loadText = async () => {
      try {
        const { viewEngine } = await import('@stores/documentStore');
        const texts = await viewEngine.extractText(document.id);
        for (const [pageIndex, text] of texts) {
          if (text.trim()) {
            searchIndex.setPage({ pageIndex, text, source: 'text-layer' });
          }
        }
      } catch {
        // 忽略
      }
    };
    loadText();
  }, [document?.id]);

  // 全局快捷键（仅保留未被原生菜单 accelerator 接管的按键）
  // 注：Ctrl+O/S/Z/F、Ctrl+=/-/0、Ctrl+Shift+R、Ctrl+E 等组合键由
  // 主进程菜单 accelerator 触发 → menu:* 事件，见下方菜单事件注册。
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const doc = useDocumentStore.getState();

      // Ctrl+K Command Palette
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      // PageUp / PageDown 翻页
      if (e.key === 'PageUp') {
        e.preventDefault();
        useViewerStore.getState().prevPage();
        return;
      }
      if (e.key === 'PageDown') {
        e.preventDefault();
        useViewerStore.getState().nextPage();
        return;
      }
      // Delete 删除选中页
      if (e.key === 'Delete' && !mod) {
        const { selectedPages } = useViewerStore.getState();
        if (selectedPages.size > 0) {
          e.preventDefault();
          doc.deletePages(Array.from(selectedPages));
          useViewerStore.getState().clearSelection();
          toastSuccess(`已删除 ${selectedPages.size} 页`);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 主进程菜单事件（menu:* → DOM 事件，统一分发到 store / 对话框）
  useEffect(() => {
    const tabActions: Partial<Record<MenuChannel, () => void>> = {
      'menu:merge': () => setMergeOpen(true),
      'menu:split': () => setSplitOpen(true),
      'menu:ocr': () => setOcrOpen(true),
      'menu:about': () => setAboutOpen(true),
    };
    const handlers = MENU_CHANNELS.map((ch) => {
      const handler = () => {
        const storeAction = menuStoreAction(ch);
        if (storeAction) {
          void storeAction();
        } else {
          tabActions[ch]?.();
        }
      };
      window.addEventListener(ch, handler);
      return () => window.removeEventListener(ch, handler);
    });
    return () => handlers.forEach((dispose) => dispose());
  }, []);

  // 阅读模式自动退出（打开文档时若处于阅读模式则保留）
  const handleExitReading = useCallback(() => toggleReadingMode(), [toggleReadingMode]);

  return (
    <ErrorBoundary>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* 顶部 Command Bar */}
        <Toolbar
          onOpenPalette={() => setPaletteOpen(true)}
        />

        <div className="flex min-h-0 flex-1">
          {document ? (
            <>
              {/* 阅读模式：隐藏侧栏；AI 面板在阅读模式下保持 */}
              {!readingMode && <Sidebar />}
              <div className="flex min-w-0 flex-1">
                <Viewer />
              </div>
              {aiPanelOpen && !readingMode && <AiPanel />}
            </>
          ) : (
            <HomePage />
          )}
        </div>

        <StatusBar />

        {/* 阅读模式浮动退出按钮 */}
        {readingMode && document && (
          <button
            onClick={handleExitReading}
            className="fixed right-4 top-16 z-[8000] rounded-lg bg-app-elevated px-3 py-1.5 text-xs text-fg shadow-elev2 transition-colors hover:bg-app-panel-hover"
            title="退出阅读模式 (Ctrl+Shift+R)"
          >
            退出阅读模式
          </button>
        )}
      </div>

      <SettingsDialog />
      <MergeDialog open={mergeOpen} onClose={() => setMergeOpen(false)} />
      <SplitDialog open={splitOpen} onClose={() => setSplitOpen(false)} />
      <OcrDialog open={ocrOpen} onClose={() => setOcrOpen(false)} />
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ToastHost />
    </ErrorBoundary>
  );
}

function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
  return (
    <Dialog open={open} title="关于" onClose={onClose} width="w-[400px]">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
            <path d="M14 2v6h6" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-fg">PDF Studio AI</h2>
        <p className="mt-1 text-sm text-fg-muted">Local-first AI PDF Workspace</p>
        <p className="mt-0.5 text-xs text-fg-subtle">Version 0.2.0</p>
        <div className="mx-auto mt-4 max-w-[260px] space-y-1 text-left text-xs text-fg-muted">
          <div className="flex justify-between"><span>PDF Engine</span><span className="text-fg">PDF.js</span></div>
          <div className="flex justify-between"><span>AI</span><span className="text-fg">OpenAI Compatible</span></div>
          <div className="flex justify-between"><span>License</span><span className="text-fg">MIT</span></div>
        </div>
        <Button variant="primary" className="mt-5 w-full" onClick={onClose}>知道了</Button>
      </div>
    </Dialog>
  );
}
