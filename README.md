# PDF Studio AI

**Local-First + AI-Native 的现代 PDF 桌面应用（V0.2）**

个人自用的本地 PDF 工作台：查看、页面管理、合并拆分、OCR、AI Copilot。V0.2 重点打磨 UI/UX、Cloud AI 架构、多主题系统。

---

## 视觉风格

Linear / Raycast / Arc / Notion 风格的克制专业风；现代暗色 + 暖白阅读 + 高级 AI 四套主题（详见 `docs/DESIGN-SYSTEM.md`）。

## 功能

- 📖 **PDF 查看**：渲染、翻页、跳页、缩放、适合宽度/页面、页面缩略图
- 🗂 **页面管理**：多选、右键菜单、拖拽排序、可撤销删除/旋转
- 🧲 **合并 PDF**：多选 + 拖拽排序 + 输出
- ✂️ **拆分 PDF**：全部 / 范围（`1-5, 8, 10-12`）
- ✏️ **基础编辑**：文本 / 高亮 / 矩形 / 箭头 / 画笔 / 擦除（Overlay）
- 🔍 **全文搜索**：Ctrl+F，文本层 + OCR 结果合并，跳页跳转
- 🔎 **OCR**：Tesseract.js WASM（中文），结果入搜索索引
- 🤖 **PDF Copilot**：OpenAI / DeepSeek / Qwen / Ollama（本地）
- 🛠 **AI Tools**：Tool Calling（删除/旋转/提取/总结等）
- 📄 **AI 总结**：Chunk + Map-Reduce + 页码引用
- 🔗 **AI 引用**：回答附带页码，**点击跳转**
- 💬 **AI 流式**：逐字显示（Streaming）
- 🔐 **本地优先**：PDF 默认不上传；API Key 系统安全存储
- 🌓 **4 套主题**：Obsidian / Paper / Midnight / Aurora —— 即时切换

## V0.2 新增

- **Design Tokens + Theme System**：CSS Variables 驱动 4 套主题即时切换与持久化
- **Command Palette**：Ctrl+K Raycast 风格命令面板（打开/保存/合并/拆分/总结/主题切换/阅读模式…）
- **可调宽 + 可折叠工作区**：AI Panel 拖拽调整宽度（320–720px），sidebar / AI Panel 独立折叠
- **AI Focus 模式**：一键放大 AI Panel（58% 宽度），适合长文档问答
- **Reading Mode**：Ctrl+Shift+R，隐藏侧栏和工具栏，最大化 PDF
- **PDF Copilot**：全新 AI Panel 品牌（✦ 符号）+ AIHeader / Model Selector / Privacy Indicator
- **AI Tool Status**：用户语言状态（✓ 读取 PDF → ● 搜索相关页），无开发者信息
- **AI 上下文选择器**：当前文档 / 当前页面 / 选中页面 / 选中文字
- **AI 流式输出**：逐 token 显示
- **Settings 侧栏式**：通用 / 外观 / AI / PDF / OCR / 快捷键 / 关于
- **Provider 卡片**：OpenAI / DeepSeek / Qwen / Ollama / Custom 独立配置 + 测试
- **拖拽打开 PDF**：Viewer 区拖入 PDF 时高亮提示

## 技术栈

| 层 | 技术 |
|---|---|
| Desktop | Electron 33（环境无 Rust/MSVC，原规划 Tauri 2 切换） |
| Frontend | React 18 + TypeScript + Vite 6 |
| UI | Design Tokens（CSS Variables）+ Tailwind CSS 3 + 自写组件库 |
| State | Zustand（7 个 store：document/viewer/editor/ai/settings/workspace/recent） |
| PDF | pdf.js（渲染/文本）+ pdf-lib（编辑/合并/拆分） |
| OCR | Tesseract.js WASM |
| AI | OpenAI-compatible API + Function Calling + SSE Streaming |
| Test | Vitest（76/76：V0.1 51 + V0.2 新增 25） |

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
│   │   ├── orchestrator.ts # 流式 + Tool 循环
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

## 安装

```bash
npm install
```

> 沙箱环境下请用 `scripts/install-deps.sh`（已写好绕过 npm safe-delete 与路径问题）。

## 开发

```bash
npm run dev
```

启动 Vite dev server 并拉起 Electron 窗口。

## 测试

```bash
npm test                     # 76/76（V0.1 51 + V0.2 25）
node scripts/smoke3.mjs      # V0.1 全功能冒烟（PDF 加载/缩略图/删除/Undo）
node scripts/smoke-v02.mjs   # V0.2 冒烟（主题切换/Command Palette/AI Panel/折叠）
```

V0.2 冒烟会生成 `theme-obsidian.png` / `theme-paper.png` / `theme-midnight.png` / `theme-aurora.png` 四套主题截图。

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
A：请用 `scripts/install-deps.sh`（项目内 cache + 镜像 + 绕过 npm safe-delete bug）。

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

**PDF Studio AI V0.2** — Premium Desktop · AI Native · PDF Productivity