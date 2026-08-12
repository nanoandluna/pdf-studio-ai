# PDF Studio AI

**Local-First + AI-Native 的现代 PDF 桌面应用（v0.4.0）**

> **🔒 V0.4 Feature Complete / Release Candidate — 已进入真实使用测试阶段**
>
> 自 `git tag v0.4.0` 起 Feature Freeze：仅允许 Bug / Security / Compatibility / Performance 修复与严重 UX 修复，不再新增功能。

本地优先的 PDF 工作台：查看、页面管理、合并拆分、OCR、AI Copilot。V0.4 完成 AI Workspace（Context Engine + Action Proposal + Document Intelligence），全量测试 175/175 通过。

**平台定位：Windows-first**（Windows x64 为主要目标平台；开发环境与打包配置均以 Windows 为准）。

**产品模型：PDF 是画布，AI 是副驾驶，用户掌握最终控制权 —— 所有 AI 修改都可确认、可撤销，PDF 数据本身永远优先于 AI。**

> **兼容性说明**：PDF 渲染（pdf.js）与 PDF 编辑/导出（pdf-lib）使用不同的引擎。少数格式异常或不常见的 PDF 可能**能正常渲染但编辑/保存失败**——这是引擎容错差异导致的正常现象，不是软件故障。

---

## 功能亮点

### 📖 PDF 查看与阅读

- 渲染、翻页、跳页、缩放、适合宽度/适合页面、页面缩略图
- **阅读模式**（Ctrl+Shift+R）：隐藏侧栏和工具栏，最大化 PDF
- **四套主题**：Obsidian / Paper / Midnight / Aurora，即时切换并持久化

### 🗂 页面管理

- 多选、右键菜单、拖拽排序、可撤销删除/旋转
- **合并 PDF**：多选 + 拖拽排序 + 输出
- **拆分 PDF**：全部 / 范围（`1-5, 8, 10-12`）

### ✏️ 基础编辑（Overlay）

- 文本 / 高亮 / 矩形 / 箭头 / 画笔 / 擦除
- 标注不破坏原 PDF，保存时重新生成

### 🔍 搜索与 OCR

- **全文搜索**（Ctrl+F）：文本层 + OCR 结果合并，跳页跳转
- **OCR**：Tesseract.js WASM（中文），结果入搜索索引

### 🤖 AI Copilot（本地优先）

- **Provider 灵活**：OpenAI / DeepSeek / Qwen / Ollama（本地）/ Custom
- **AI Workspace**：AI Panel 可折叠、可调宽（320–720px）、专注模式
- **Action Proposal**：AI 提议破坏性操作（删除/旋转/排序/提取）→ 用户确认 → 可撤销
- **Document Intelligence**（✦ 分析文档）：结构化 JSON 文档分析 + Insights 面板
- **AI 引用**：回答附带页码，点击跳转
- **Selected Text → AI**：框选文字 → 浮动工具栏（✦ Ask AI / 翻译 / 解释 / 总结）
- **AI 总结**：Chunk + Map-Reduce + 页码引用
- **AI 流式输出**：逐 token 显示
- **AI 上下文选择器**：当前文档 / 当前页面 / 选中页面 / 选中文字

### ⌨️ 效率工具

- **Command Palette**（Ctrl+K）：Raycast 风格命令面板
- **可折叠工作区**：sidebar / AI Panel 独立折叠
- **拖拽打开 PDF**：Viewer 区拖入 PDF 高亮提示

### 🔐 安全与隐私

- **本地优先**：PDF 默认不上传；API Key 系统安全存储（safeStorage 加密）
- **浮层可读性**：统一 Surface 层级系统（L0–L5），浮层与背景清晰分层
- **AI 可控**：所有 AI 修改可确认、可撤销，PDF 数据永远优先

## 技术栈

| 层 | 技术 |
|---|---|
| Desktop | Electron 33 |
| Frontend | React 18 + TypeScript + Vite 6 |
| UI | Design Tokens（CSS Variables）+ Tailwind CSS 3 + 自写组件库 |
| State | Zustand（7 个 store：document/viewer/editor/ai/settings/workspace/recent） |
| PDF | pdf.js（渲染/文本）+ pdf-lib（编辑/合并/拆分） |
| OCR | Tesseract.js WASM |
| AI | OpenAI-compatible API + Function Calling + SSE Streaming |
| Test | Vitest（175/175，V0.1 起逐步累积：V0.2 25 → V0.3/V0.3.1 → V0.4 全部通过） |

## 项目结构

```text
pdf-studio-ai/
├── electron/             # 主进程 + preload
├── src/
│   ├── components/
│   │   ├── ui/          # Design System 组件库（Button/Input/Dropdown 等）
│   │   ├── commandPalette.tsx  # Ctrl+K
│   │   ├── aiPanel.tsx  # ✦ PDF Copilot
│   │   ├── sidebar.tsx  # 左侧导航（Icon/展开/折叠）
│   │   ├── toolbar.tsx  # 顶部 Command Bar
│   │   └── ...
│   ├── stores/           # Zustand: document/viewer/editor/ai/settings/workspace/recent
│   ├── theme/            # Design Tokens + 4 套主题定义
│   ├── ai/
│   │   ├── providers/   # AIProvider Registry（OpenAI/DeepSeek/Qwen/Ollama/Custom）
│   │   ├── context.ts   # Context Engine（统一收集 PDF 上下文）
│   │   ├── tools.ts     # PDF Tool Calling
│   │   └── chunk.ts     # Chunk + Map-Reduce
│   ├── engine/           # PDF Engine 抽象（pdf.js / pdf-lib）
│   ├── commands/         # Command 模式 + Undo/Redo
│   ├── ocr/, search/     # Tesseract.js + 搜索索引
│   ├── domain/           # 领域类型（PDF/AI）
│   └── lib/              # Logger / Errors
├── scripts/              # 构建 / 启动 / 冒烟
├── tests/                # 单元 + 集成 + fixtures
└── docs/                 # TASKS.md / DESIGN-SYSTEM.md
```

## 下载与安装

**推荐直接下载预构建版本**（无需安装 Node.js）：

[📥 下载 Windows 便携版 v0.4.0](https://github.com/nanoandluna/pdf-studio-ai/releases/tag/v0.4.0)

- `PDF.Studio.AI-0.4.0-portable.exe`（约 83 MB，绿色便携版，双击即用）
- Windows 可能提示 SmartScreen（未签名），选择「更多信息 → 仍要运行」

> **单文件大小上限：100 MB** —— 超出会提示"文件过大"，这是有意的保护措施。

## 从源码构建

```bash
npm install        # 安装依赖
npm run dev        # 开发模式（Vite + Electron）
npm test           # 全量单元测试
npm run build      # 生产构建
npm run pack       # 打包 portable exe（输出到 release/）
```

## 测试

```bash
npm test                     # 175/175 全量单元测试
node scripts/smoke3.mjs      # V0.1 全功能冒烟（PDF 加载/缩略图/删除/Undo）
node scripts/smoke-v02.mjs   # V0.2 冒烟（主题切换/Command Palette/AI Panel/折叠）
```

V0.2 冒烟会生成 `theme-obsidian.png` / `theme-paper.png` / `theme-midnight.png` / `theme-aurora.png` 四套主题截图（正式预览见 `docs/assets/`）。

## 主题切换

- 命令面板：`Ctrl+K` → "切换主题：Obsidian / Paper / Midnight / Aurora"
- 设置 → 外观 → ThemeCard 实时预览，即时切换无需重启

## 快捷键

| 快捷键 | 功能 |
|---|---|
| `Ctrl+O` | 打开 PDF |
| `Ctrl+S` / `Ctrl+Shift+S` | 保存 / 另存为 |
| `Ctrl+Z` / `Ctrl+Shift+Z` | 撤销 / 重做 |
| `Ctrl+F` | 全文搜索 |
| **`Ctrl+K`** | **命令面板** |
| `Ctrl++` / `Ctrl+-` / `Ctrl+0` | 放大 / 缩小 / 适合页面 |
| `Ctrl+E` | 切换 AI Panel |
| **`Ctrl+Shift+R`** | **阅读模式** |
| `Ctrl+Enter` | 发送 AI 消息 |
| `PageUp` / `PageDown` | 上一页 / 下一页 |
| `Delete` | 删除选中页 |

## 常见问题

**Q：`npm install` 卡住无输出？**
A：通常是网络问题，重试或换用 npm 镜像（如 `npm config set registry https://registry.npmmirror.com`）。

**Q：Electron 启动后立即退出？**
A：通过 `npm run dev` 启动（脚本已处理 `ELECTRON_RUN_AS_NODE` / `NODE_OPTIONS`）。

**Q：主题切换后没生效？**
A：`Ctrl+K` → "切换主题：..." 立即应用。或设置 → 外观选择。

**Q：AI 无法连接？**
A：设置 → AI → 选择 Provider 卡片 → 填写 Base URL + API Key + Model → "测试"。

## 许可证

MIT License. 第三方依赖：
- pdf.js（Apache-2.0）
- pdf-lib（MIT）
- Tesseract.js（Apache-2.0）
- Electron（MIT）

---

**PDF Studio AI V0.4.0** — Premium Desktop · AI Native · PDF Productivity
