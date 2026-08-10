# PDF Studio AI — 任务清单

> 每完成一项：`[ ]` → `[x]`。不假装完成。

## V0.1 核心（已完成）

- [x] 项目初始化（Vite + React + TS + Tailwind）
- [x] 依赖安装（Electron + pdf.js + pdf-lib + tesseract.js + zustand）
- [x] App Shell（Toolbar / Sidebar / Viewer / AI Panel / StatusBar）
- [x] PDF 打开（对话框 / Ctrl+O / 拖拽）
- [x] PDF Viewer（渲染 / 翻页 / 跳页 / 缩放 / 适合宽度 / 适合页面 / 缩略图）
- [x] 页面缩略图（选择 / 多选 / 拖拽排序）
- [x] 删除页面（含确认框，可撤销）
- [x] 旋转页面（90°/180°/270°，可撤销）
- [x] 调整页面顺序（拖拽，可撤销）
- [x] Undo / Redo（Ctrl+Z / Ctrl+Shift+Z）
- [x] 保存 PDF（Ctrl+S）
- [x] 另存为 PDF（Ctrl+Shift+S）
- [x] 合并 PDF（多选 + 排序 + 输出）
- [x] 拆分 PDF（全部 / 范围 1-5,8,10-12）
- [x] AI Chat（OpenAI-compatible Provider）
- [x] AI 设置（Base URL / API Key / Model / Temperature / 测试连接）
- [x] AI Tool Calling（get_pdf_info / get_page_count / extract_text / search_text / delete_pages / rotate_pages / extract_pages / summarize_pdf）
- [x] AI 总结（Chunk + Map-Reduce）
- [x] 全文搜索（Ctrl+F，点击结果跳页）
- [x] OCR（Tesseract.js，中文支持，结果入搜索索引）
- [x] 错误处理（FriendlyError + Toast + ErrorBoundary）
- [x] 暗色模式（Light / Dark / System）
- [x] 最近文件（持久化 + unavailable 标记）
- [x] 统一 Logger（敏感信息脱敏）
- [x] API Key 安全存储（Electron safeStorage 加密）
- [x] 单元 + 集成测试 51/51
- [x] 测试 fixtures（sample.pdf / sample-multi-page.pdf / sample-text.pdf）
- [x] README.md / LICENSE（MIT）

## V0.2 体验打磨（已完成）

- [x] **Design Tokens**（CSS Variables + Tailwind 映射，H/R/S/B 全语义）
- [x] **Theme System + 4 套主题**：Obsidian（默认）/ Paper / Midnight / Aurora，即时切换 + 持久化
- [x] **核心 UI 组件库**：Button / IconButton / Input / Badge / Card / Progress / Skeleton / Tooltip / Dropdown / Dialog / Toast
- [x] **Application Shell 重构**：可折叠 Sidebar（Icon/展开双模式）+ 可调宽 AI Panel + Reading Mode + AI Focus Mode
- [x] **Top Command Bar**：文件名 · 高频工具 · More 菜单
- [x] **PDF Copilot 全面重设计**：✦ 品牌、AIHeader（Provider/Model/Privacy Indicator）、AIQuickActions（随当前页动态）、AIMessage 流式渲染、AIToolStatus（用户语言）、AICitation（可点击跳页）、AIContextSelector、Stream Streaming
- [x] **AI Provider 架构**：AIProvider Registry（OpenAI / DeepSeek / Qwen / Ollama / Custom）+ OpenAI-compatible 基础实现 + SSE Streaming
- [x] **Model Selector**：Dropdown，按 Provider 分组
- [x] **Privacy Indicator**：本地 / Cloud AI 状态显示
- [x] **Cloud AI 数据策略**：仅发送相关文本，不上传原始 PDF
- [x] **Settings 侧栏式**：通用 / 外观 / AI / PDF / OCR / 快捷键 / 关于
- [x] **Provider 卡片页**：每 Provider 独立配置 / 测试 / 状态徽章
- [x] **ThemeCard 实时预览**：4 套主题预览图块
- [x] **Command Palette**：Ctrl+K Raycast 风格命令面板（含主题切换）
- [x] **Reading Mode**：Ctrl+Shift+R，隐藏侧栏和工具栏
- [x] **AI Focus Mode**：AI Panel 占 58% 宽度
- [x] **拖拽打开 PDF**：Viewer 拖入 PDF 高亮提示
- [x] **AI Panel Resize**：320–720px 可拖动
- [x] **Loading / Empty / Error State**：统一规范
- [x] **微动画**：Sidebar / Dialog / Theme 切换 / Toast / Palette 150–300ms
- [x] **AI 引用提取**：从回复自动提取 "第 N 页" / "第 N-M 页" 并跳转
- [x] **docs/DESIGN-SYSTEM.md** 完整文档
- [x] **测试 76/76**：新增 Theme（7）/ AI Providers（10）/ V0.2 Features（8）
- [x] **V0.1 回归无破坏**：51 个 V0.1 测试全绿

## V0.2 验证记录

> 所有 V0.1 + V0.2 任务已完成并通过自动验证

- **TypeScript 编译**：`tsc --noEmit` 0 错误
- **单元 + 集成测试**：**76/76** 通过
  - V0.1 回归：51 个（PageRange / Command / Search / AI Tools / PDF Engine）
  - V0.2 新增：25 个（Theme System / AI Providers / Streaming / Context / Command Palette / Citations）
- **V0.1 冒烟**（`node scripts/smoke3.mjs`）：PDF 加载（4 页）/ 缩略图（4/4）/ 删除 / Undo —— **无 React 错误**
- **V0.2 冒烟**（`node scripts/smoke-v02.mjs`）：
  - 四套主题即时切换：`obsidian:OK paper:OK midnight:OK aurora:OK`
  - Command Palette 打开：`OK`
  - PDF Copilot 渲染：`OK`
  - AI Panel 折叠：`OK`
  - Reading Mode 切换：`OK`
  - 无 React 错误：`OK`
- **主题截图**：`theme-obsidian.png` / `theme-paper.png` / `theme-midnight.png` / `theme-aurora.png`

## P1（V0.2 之后）

- [ ] 标注保存（把 Overlay 标注写入 PDF 文件）
- [ ] 添加文本 / 高亮 / 矩形 / 箭头 / 画笔交互细节完善
- [ ] Selected Text → AI（PDF 选中文本浮出 ✦ 解释/翻译/改写/总结）
- [ ] AI 引用区域高亮（按 Bounding Box）
- [ ] E2E 测试（Playwright + Electron）
- [ ] 多文档标签页
- [ ] 压缩 PDF（V0.2 §216 列入但未实现）
- [ ] 自定义主题导入（用户导入 .json 主题）
- [x] **V0.4 Selected Text → AI**（已实现：框选 + 浮动 Toolbar + AI Context=Selection）
- [x] **V0.4 AI Action Preview + Confirm + Undo**（已实现：ActionProposalCard + commandHistory）

## V0.4 AI PDF Workspace（已完成）

> **设计哲学**：PDF 是画布，AI 是副驾驶，工具是隐形的。AI 可以提议修改，但不能悄悄修改 PDF。

**核心改造**
- [x] **T01 Context Engine**（`src/ai/context.ts`）：Document / Page / Selection / Search / Reading 统一收集，AI 只声明"需要什么上下文"
- [x] **T02 AI Action Preview**（`ActionProposalCard`）：破坏性工具只提议不执行 → 确认卡片 → 用户确认后才执行
- [x] **T03 AI Command → CommandHistory**：所有 AI 操作走 Command → 可撤销
- [x] **T04 AI Undo**（`undoAiActions`）：执行后显示「✓ 已完成 + 撤销这些修改」（走 `commandHistory.undo()`）
- [x] **T05 AI Workspace**：MessageBubble 集成 Action Proposal / Executed + Undo
- [x] **T06 Document Intelligence**（`analyzeDocument` + `parseInsightJson`）：类型/主题/作者/日期/总结，藏在 PDF「分析」按钮之后不自动
- [x] **T07 Reading Context**：Context Engine 自动注入当前页 ± 邻近文本 + 搜索状态 + 选中文字
- [x] **Command Palette 新增 ✦ 分析文档**

**架构边界（严格执行）**
```
UI  →  AIStore  →  ProviderRegistry  →  ProviderAdapter  →  Cloud API
                  ↑
                  ToolRegistry (recorder: 破坏性工具仅提议)
```
- AI Panel 不再 import `providerRegistry`
- 破坏性工具默认进入"提议模式"（recorder 收集，bus 不直接执行）
- 确认为后调用 `useDocumentStore.deletePages/rotatePages/...` 走 CommandHistory
- 撤销用 `commandHistory.undo()` —— 同一个 AI 操作的 N 个 actions 逐个 undo

**测试**：V0.4 新增 15 个（Context Engine / Action Proposal / parseInsightJson），全量 **111/111**
**冒烟**：V0.4 专用冒烟通过（action-card/confirm/undo/reading-context/insights-trigger）
**视觉**：`v04-ai-workspace.png`（Action 已完成状态 + 「分析」按钮 + Context=Selection）

## P2（远期）

- [ ] RAG / 向量数据库
- [ ] Claude / Gemini / OpenRouter Provider
- [ ] 高级 PDF 编辑（Content Stream）
- [ ] 电子签章
- [ ] PDF 表单编辑
- [ ] Tauri 回归（环境具备 Rust/MSVC 后切换）