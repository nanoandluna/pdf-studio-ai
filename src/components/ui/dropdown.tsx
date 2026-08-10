// ============================================================
// Dropdown — 下拉菜单（Design Tokens）
// ============================================================

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconChevronDown } from '../icons';

export interface DropdownItem {
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  group?: string;
}

export function Dropdown({
  items,
  value,
  onChange,
  placeholder = '选择…',
  className = '',
}: {
  items: DropdownItem[];
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = items.find((i) => i.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const groups = new Map<string, DropdownItem[]>();
  for (const it of items) {
    const g = it.group ?? '';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(it);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-md bg-app-panel-hover px-3 text-[13px] text-fg transition-colors hover:bg-app-panel-active"
      >
        <span className="truncate">
          {selected?.icon && <span className="mr-1.5 inline-flex align-middle">{selected.icon}</span>}
          {selected?.label ?? placeholder}
        </span>
        <IconChevronDown width={14} height={14} className={`shrink-0 text-fg-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-[9500] mt-1 max-h-72 w-full min-w-[180px] overflow-y-auto rounded-lg bg-app-elevated p-1 shadow-pop"
          style={{ animation: 'dropdown-in 0.12s ease' }}
        >
          {Array.from(groups.entries()).map(([group, groupItems]) => (
            <div key={group || '__'}>
              {group && (
                <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
                  {group}
                </div>
              )}
              {groupItems.map((it) => (
                <button
                  key={it.value}
                  disabled={it.disabled}
                  onClick={() => {
                    onChange(it.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:opacity-40 ${
                    it.value === value
                      ? 'bg-accent-soft text-accent'
                      : 'text-fg hover:bg-app-panel-hover'
                  }`}
                >
                  {it.icon && <span className="shrink-0 text-fg-subtle">{it.icon}</span>}
                  <span className="flex-1 truncate">{it.label}</span>
                  {it.value === value && <span className="text-accent">✓</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes dropdown-in{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
