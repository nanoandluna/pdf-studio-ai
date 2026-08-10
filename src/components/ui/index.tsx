// ============================================================
// UI 组件库 — 基础控件
// 所有组件基于 Design Tokens（CSS 变量），禁止硬编码颜色
// ============================================================

import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

// ---------------- Button ----------------
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const BTN_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-on hover:bg-accent-hover',
  secondary: 'bg-app-panel-hover text-fg hover:bg-app-panel-active',
  ghost: 'text-fg-muted hover:bg-app-panel-hover hover:text-fg',
  danger: 'bg-danger/90 text-white hover:bg-danger',
};

const BTN_SIZES = {
  sm: 'h-7 px-2.5 text-xs',
  md: 'h-8 px-3 text-[13px]',
  lg: 'h-9 px-4 text-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', icon, className = '', children, ...rest }, ref) => (
    <button
      ref={ref}
      className={`btn ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

// ---------------- IconButton ----------------
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, active, size = 'md', className = '', children, ...rest }, ref) => (
    <button
      ref={ref}
      title={label}
      aria-label={label}
      className={`btn h-8 w-8 p-0 ${size === 'sm' ? 'h-7 w-7' : ''} ${
        active
          ? 'bg-accent-soft text-accent'
          : 'text-fg-muted hover:bg-app-panel-hover hover:text-fg'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
);
IconButton.displayName = 'IconButton';

// ---------------- Input ----------------
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, hint, className = '', ...rest }, ref) => (
  <div className="w-full">
    {label && <label className="label">{label}</label>}
    <input ref={ref} className={`input ${className}`} {...rest} />
    {hint && <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p>}
  </div>
));
Input.displayName = 'Input';

// ---------------- Badge ----------------
export type BadgeTone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export function Badge({
  tone = 'default',
  children,
  dot = false,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  dot?: boolean;
}): JSX.Element {
  const tones: Record<BadgeTone, string> = {
    default: 'bg-app-panel-hover text-fg-muted',
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
    info: 'bg-info/15 text-info',
    accent: 'bg-accent-soft text-accent',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// ---------------- Card ----------------
export function Card({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return <div className={`card ${className}`}>{children}</div>;
}

// ---------------- Divider ----------------
export function Divider({ className = '' }: { className?: string }): JSX.Element {
  return <div className={`divider-x ${className}`} />;
}

// ---------------- Skeleton ----------------
export function Skeleton({ className = '' }: { className?: string }): JSX.Element {
  return <div className={`animate-pulse rounded-md bg-app-panel-hover ${className}`} />;
}

// ---------------- Progress ----------------
export function Progress({ value, className = '' }: { value: number; className?: string }): JSX.Element {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-app-panel-hover ${className}`}>
      <div
        className="h-full rounded-full bg-accent transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------- Tooltip（轻量） ----------------
export function Tooltip({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-[100] mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-app-panel px-2 py-1 text-[11px] text-fg opacity-0 shadow-pop transition-opacity duration-150 group-hover/tip:opacity-100">
        {label}
      </span>
    </span>
  );
}

// ---------------- Spinner ----------------
export function Spinner({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ---------------- Kbd ----------------
export function Kbd({ children }: { children: ReactNode }): JSX.Element {
  return <span className="kbd">{children}</span>;
}

// ---------------- SectionHeader ----------------
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }): JSX.Element {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{title}</span>
      {action}
    </div>
  );
}
