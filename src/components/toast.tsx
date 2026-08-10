// ============================================================
// Toast — 右下角通知（V0.2，Design Tokens）
// ============================================================

import { create } from 'zustand';
import { IconCheck, IconError, IconClose, IconSpark } from './icons';

export type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toastSuccess(message: string): void {
  useToastStore.getState().push('success', message);
}
export function toastError(message: string): void {
  useToastStore.getState().push('error', message);
}
export function toastInfo(message: string): void {
  useToastStore.getState().push('info', message);
}

const ICONS = {
  success: <IconCheck width={14} height={14} className="text-success" />,
  error: <IconError width={14} height={14} className="text-danger" />,
  info: <IconSpark width={14} height={14} className="text-accent" />,
};

export function ToastHost(): JSX.Element {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-app-elevated px-3.5 py-2.5 text-[13px] shadow-elev2"
          style={{ animation: 'toast-in 0.2s ease' }}
        >
          <span className="shrink-0">{ICONS[t.kind]}</span>
          <span className="max-w-xs text-fg">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="ml-1 text-fg-subtle transition-colors hover:text-fg"
          >
            <IconClose width={13} height={13} />
          </button>
        </div>
      ))}
      <style>{`@keyframes toast-in{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
    </div>
  );
}
