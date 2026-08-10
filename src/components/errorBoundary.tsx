// ============================================================
// ErrorBoundary — 全局错误兜底（不让 App 崩溃）
// ============================================================

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown, info: unknown) {
    console.error('[ErrorBoundary]', err, info);
    // 暴露给自动化测试 / DevTools
    (window as unknown as { __lastReactError__?: unknown }).__lastReactError__ = {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : null,
      componentStack: (info as { componentStack?: string })?.componentStack ?? null,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-app-bg p-8 text-center dark:bg-app-bg-dark">
          <div className="text-4xl">😵</div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">出了点问题</h1>
          <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
            应用遇到了意外错误，但你的文件是安全的。点击下方按钮重新加载。
          </p>
          {this.state.message && (
            <pre className="max-w-lg truncate rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {this.state.message}
            </pre>
          )}
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => location.reload()}>重新加载</button>
            <button className="btn-secondary" onClick={() => { this.setState({ hasError: false, message: '' }); }}>
              返回
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
