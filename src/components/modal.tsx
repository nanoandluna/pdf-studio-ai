// ============================================================
// Dialog — 统一模态框（Design Tokens，V0.2）
// 禁止使用浏览器 alert/confirm
// ============================================================

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { IconClose } from './icons';

interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  /** 是否显示关闭按钮（默认 true） */
  closable?: boolean;
}

export function Dialog({
  open,
  title,
  onClose,
  children,
  width = 'w-[520px]',
  closable = true,
}: DialogProps): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-app-overlay-backdrop backdrop-blur-xl backdrop-saturate-150"
        onClick={onClose}
      />
      <div
        className={`relative ${width} max-h-[85vh] overflow-hidden rounded-xl bg-app-dialog shadow-elev3 ring-1 ring-app-popover-border/60 animate-[dialog-in_.15s_ease]`}
        style={{ animation: 'dialog-in 0.15s ease' }}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-title">{title}</h2>
          {closable && (
            <button
              onClick={onClose}
              className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-app-panel-hover hover:text-fg"
            >
              <IconClose width={16} height={16} />
            </button>
          )}
        </div>
        <div className="border-t border-app-border-faint px-5 py-4" style={{ maxHeight: 'calc(85vh - 56px)' }}>
          {children}
        </div>
      </div>
      <style>{`@keyframes dialog-in{from{opacity:0;transform:scale(.97) translateY(4px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

// 兼容旧 API
export const Modal = Dialog;

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '确认',
  danger = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps): JSX.Element | null {
  return (
    <Dialog open={open} title={title} onClose={onCancel} width="w-[420px]">
      <div className="text-sm leading-relaxed text-fg-muted">{message}</div>
      {children}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>取消</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

import { Button } from './ui';
