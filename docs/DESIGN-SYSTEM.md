# PDF Studio AI — Design System

> V0.2 Design Tokens + Component Library 文档。组件严禁硬编码颜色，全部通过 CSS 变量 / Tailwind 语义类。

## 设计原则

- 现代、克制、专业，参考 Linear / Raycast / Arc / Notion
- 高信息密度、低视觉噪音
- 圆角统一（按钮 8 / 输入 8 / 卡片 12 / 对话框 16）
- 圆角分层（非全 20px）
- 细腻轻量动画（≤ 300ms，opacity + transform + scale）

## Color Tokens（语义色，4 套主题共用）

所有 token 定义在 `src/theme/tokens.css`，HSL 三元组格式以支持 alpha：

| Token | 用途 |
|---|---|
| `--background` | 应用主背景 |
| `--surface` | 面板/卡片背景 |
| `--surface-hover` | 面板悬停态 |
| `--surface-active` | 面板按下态 |
| `--surface-elevated` | 弹出层（Dialog/Menu） |
| `--border` | 普通边框 |
| `--border-strong` | 加强边框 |
| `--foreground` | 主文字 |
| `--muted` | 次级文字 |
| `--subtle` | 辅助文字（placeholder） |
| `--primary` | Accent（蓝紫/蓝/电光蓝/紫） |
| `--primary-hover` | Accent 悬停 |
| `--primary-soft` | Accent 软背景（选中/标签） |
| `--ai-accent` / `--ai-glow` | AI 视觉强调 |
| `--success` / `--warning` / `--danger` / `--info` | 语义色 |
| `--radius-sm/md/lg/xl` | 圆角 |
| `--shadow-soft/pop/glow` | 阴影 |
| `--scrollbar-thumb` | 滚动条 |

### Tailwind 语义类映射

`tailwind.config.js` 把 `app-*`、`fg-*`、`accent`、`ai`、`success/warning/danger/info` 映射到 CSS 变量：

```tsx
// ✅ 推荐
<div className="bg-app-panel text-fg border-app-border">...</div>
<Button variant="primary" />
<span className="text-fg-muted">次级</span>

// ❌ 禁止
<div className="bg-[#1a1a1a]">...</div>
<div className="bg-gray-800 dark:bg-gray-900">...</div>
```

## 主题（4 套）

| ID | 名称 | 定位 |
|---|---|---|
| `obsidian` | Obsidian | 专业 / 开发者 / AI · 默认 |
| `paper` | Paper | 阅读 / 论文 / 办公 · 暖白 |
| `midnight` | Midnight | AI / 科技 / 深蓝黑 + 电光蓝 |
| `aurora` | Aurora | 高级 AI · 玻璃质感 / 紫 |

主题定义：`src/theme/themes.ts`
Token 实现：`src/theme/tokens.css`
应用入口：`src/theme/themes.ts → applyTheme()`
持久化：`themeId` 字段存于 `AppSettings`（不存完整 CSS）

## Typography

```
字体栈（优先级）：Inter → Noto Sans SC → PingFang SC → Microsoft YaHei → 系统 sans-serif
Mono: JetBrains Mono
```

| 用途 | 字号 |
|---|---|
| 标题 / H1 | 18–20px |
| 段落 / Section | 14–16px |
| 正文 | 13–14px |
| 辅助 | 12px |
| 小标签 / Badge | 11px |

## Spacing

```
统一阶梯：4 / 8 / 12 / 16 / 20 / 24 / 32
避免：13 / 17 / 19 / 27
```

## Radius

```
--radius-sm: 6px   → 小标签、Badge
--radius-md: 8px   → Button / Input / Tooltip
--radius-lg: 12px  → Card / Sidebar Item
--radius-xl: 16px  → Dialog / Modal
```

## Shadows

```
--shadow-soft: 0 1px 2px + 0 4px 16px
--shadow-pop:  0 4px 12px + 0 16px 40px
--shadow-glow: 0 0 20px (accent)
```

## 组件库

`src/components/ui/index.tsx` 与 `src/components/ui/dropdown.tsx`

| 组件 | 说明 |
|---|---|
| `<Button>` | variant: primary / secondary / ghost / danger，size: sm/md/lg |
| `<IconButton>` | 工具栏按钮，hover/active 反馈 |
| `<Input>` | 标签 + 输入 + hint |
| `<Badge>` | tone: default/success/warning/danger/info/accent，dot 模式 |
| `<Card>` | 圆角 12 + 边框 + 阴影 |
| `<Divider>` | 水平分隔 |
| `<Skeleton>` | 加载占位 |
| `<Progress>` | 0–100% 进度条 |
| `<Tooltip>` | 轻量悬停提示 |
| `<Kbd>` | 快捷键显示 |
| `<Spinner>` | 加载动画 |
| `<SectionHeader>` | 列表区块标题 |
| `<Dropdown>` | 下拉选择（Provider/Model/主题） |
| `<Dialog>` | 模态框（统一 token 化） |
| `<Toast>` | 右下角通知（success/error/info） |
| `<CommandPalette>` | Ctrl+K Raycast 风格命令面板 |

## AI Components（`src/components/aiPanel.tsx`）

- `PDF Copilot` 品牌（✦ 符号）
- Privacy Indicator：本地（Ollama 绿色）/ Cloud AI（蓝色）
- Header：Copilot + Provider + Model Selector（Dropdown）
- Quick Actions（随当前页动态变化）
- Tool Status（用户语言：✓ 读取 PDF → ● 搜索相关页，无开发者信息）
- Streaming（光标 + 流式写入）
- Citation Chips（可点击跳页）
- AI Context Selector（当前文档 / 当前页 / 选中文字）

## PDF Components（`src/components/viewer.tsx`）

- `PdfViewer`：页面悬浮背景、间距 16-24px、当前页明确
- `PageCanvas`：缩放 + 旋转 + 标注 overlay
- `Thumbnail`：原缩略图
- `DragActive`：拖入 PDF 高亮提示（"放开以打开 PDF"）

## Animation

```
Sidebar toggle:    150–200ms
Dialog:            150ms
Theme switch:      200–300ms（color/border/box-shadow）
Toast:             200ms
AI message stream: 逐字/逐 token
Modal/Palette in:  120–180ms
```

仅用：`opacity` / `transform` / `scale`，避免 width/height/margin 动画。

## 扩展主题（未来）

新增主题只需：
1. 在 `src/theme/themes.ts` 的 `THEMES` 数组中追加 `{ id, name, description, preview, dark }`
2. 在 `src/theme/tokens.css` 加一个 `[data-theme='new']` 块定义同名 token

无需修改任何组件代码。