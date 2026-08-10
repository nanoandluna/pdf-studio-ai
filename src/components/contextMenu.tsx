// ============================================================
// ContextMenu — 自定义右键菜单（页面缩略图等场景）
// ============================================================

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  shortcut?: string;
  disabled?: boolean;
  onSelect: () => void;
}

export interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

interface ContextMenuProps {
  menu: MenuState | null;
  onClose: () => void;
}

export function ContextMenu({ menu, onClose }: ContextMenuProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  // 保证菜单不超出窗口
  const maxX = window.innerWidth - 200;
  const maxY = window.innerHeight - menu.items.length * 36 - 16;
  const x = Math.min(menu.x, maxX);
  const y = Math.min(menu.y, maxY);

  return (
    <div
      ref={ref}
      className="fixed z-[9500] min-w-[180px] rounded-lg bg-app-elevated p-1 shadow-elev2 animate-[menu-in_.12s_ease]"
      style={{ left: x, top: y, animation: 'menu-in 0.12s ease' }}
    >
      {menu.items.map((item, i) => (
        <div key={i}>
          {item.label === '---' ? (
            <div className="divider-x mx-2 my-1" />
          ) : (
            <button
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                onClose();
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors disabled:opacity-40
                ${
                  item.danger
                    ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
                    : 'text-fg hover:bg-app-panel-hover dark:text-fg dark:hover:bg-app-panel-hover/60'
                }`}
            >
              {item.icon && <span className="shrink-0 text-fg-subtle">{item.icon}</span>}
              <span className="flex-1">{item.label}</span>
              {item.shortcut && <span className="text-[10px] text-fg-subtle">{item.shortcut}</span>}
            </button>
          )}
        </div>
      ))}
      <style>{`@keyframes menu-in{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}`}</style>
    </div>
  );
}
