/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ===== 语义色：全部引用 Design Tokens（CSS 变量） =====
        app: {
          bg: 'hsl(var(--background))',
          panel: 'hsl(var(--surface))',
          'panel-hover': 'hsl(var(--surface-hover))',
          'panel-active': 'hsl(var(--surface-active))',
          elevated: 'hsl(var(--elevated))',
          // L3/L4 浮层表面（Overlay Readability：层级越高越盖住背景）
          popover: 'hsl(var(--surface-popover))',
          dialog: 'hsl(var(--surface-dialog))',
          'popover-border': 'hsl(var(--popover-border))',
          'overlay-backdrop': 'var(--overlay-backdrop)',
          border: 'hsl(var(--border))',
          'border-faint': 'hsl(var(--border-faint))',
          'border-strong': 'hsl(var(--border-strong))',
        },
        fg: {
          DEFAULT: 'hsl(var(--foreground))',
          muted: 'hsl(var(--muted))',
          subtle: 'hsl(var(--subtle))',
        },
        accent: {
          DEFAULT: 'hsl(var(--primary))',
          hover: 'hsl(var(--primary-hover))',
          soft: 'hsl(var(--primary-soft))',
          'on': 'hsl(var(--on-primary))',
        },
        ai: {
          DEFAULT: 'hsl(var(--ai-accent))',
          glow: 'hsl(var(--ai-glow))',
        },
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
        danger: 'hsl(var(--danger))',
        info: 'hsl(var(--info))',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Noto Sans SC',
          'Microsoft YaHei',
          'Helvetica Neue',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        pop: 'var(--shadow-pop)',
        glow: 'var(--shadow-glow)',
        elev1: 'var(--elevation-1)',
        elev2: 'var(--elevation-2)',
        elev3: 'var(--elevation-3)',
      },
      transitionTimingFunction: {
        'theme': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
