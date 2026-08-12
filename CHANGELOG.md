# Changelog

所有重要变更都记录在此文件中。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [0.4.0-hotfix] - 2026-08-12

Feature Freeze 后的 Bug / Security / 严重 UX 修复（随 main 分支发布）。

### Fixed

- **安全**：收紧 `recent:add` 白名单入口 —— renderer 无法再用任意 `.pdf` 路径扩充文件白名单，路径必须已由主进程认可（dialog 打开过 / 启动预加载的 recent）
- **安全**：AI 错误日志最小化 —— 不再记录 provider 原始响应 body（可能含敏感信息），只保留状态码
- **安全**：Prompt Injection 加固 —— 文档内容在系统提示中声明为「不可信数据」，并包进 `<document_context>` 标签
- **渲染**：Viewer 滚动驱动渲染 + Layout 与 Render 分离（修复：滚动后页面空白需点击、未显示页前一页翻转、默认尺寸模糊）
- **渲染**：首帧清晰度 —— 容器宽度就绪前不渲染低分辨率首帧（DPR 诊断实证 ratio 正确）
- **UI**：浮层可读性 —— 建立 L0–L5 Surface 层级（popover/dialog 不透明 + 毛玻璃 backdrop）
- **CSS**：修复 `@import` 顺序错误导致 `tokens.css` 未打包（生产构建颜色/浮层全部失效）
- **UI**：空状态工具栏隐藏无意义控件 + 最近文件区限高

### Added

- **CI**：`.github/workflows/ci.yml`（push/PR → Node 20 → `tsc` → `test` → `build`）
- `THIRD-PARTY-NOTICES.md`（第三方组件与许可证说明）

## [0.4.0] - 2026-08-10

### Feature Complete / Release Candidate

V0.4 核心：AI 从"回答 PDF"升级为"理解 PDF + 提议操作 + 用户确认 + 可撤销地操作 PDF"。

#### 新增（V0.4 范围内）

- **AI Workspace**：AI 面板可折叠、可调宽度（320-720px）、专注模式
- **Context Engine**（`src/ai/context.ts`）：统一收集 Document / Page / Selection / Search / Reading 上下文，AI 只声明"需要什么上下文"
- **Action Proposal**：AI 提议破坏性操作（删除/旋转/排序/提取）→ 用户确认 → 走 Command History 执行 → 可撤销。**AI 不能绕过用户确认修改 PDF**
- **Document Intelligence**（✦ 分析文档）：结构化 JSON 文档分析 + Insights 面板
- **AI 操作 Undo**：撤销 AI 已执行的修改

#### 既有能力（V0.1-V0.3.1 累积）

- PDF：打开/渲染/导航/缩放/Fit Width/Fit Page/缩略图/删除/旋转/排序/提取/合并/拆分/保存/另存/Undo-Redo
- Annotation：文本/高亮/矩形/箭头/画笔/擦除/颜色
- OCR：Tesseract.js WASM + 中文识别 + 搜索索引
- Search：全文/文本层/OCR 搜索 + 结果跳页（修复中文 CID 字体空格问题）
- AI：OpenAI-compatible（OpenAI/DeepSeek/Qwen/Ollama/Custom）+ SSE Streaming + Tool Calling + Markdown + Citation + Selected Text → AI + Retry
- UI：Obsidian/Paper/Midnight/Aurora 四主题 + Reading Mode + Command Palette
- 安全：API Key safeStorage + Logger 脱敏

#### 修复

- 中文搜索失效（pdf.js 对中文 CID 字体字符间插空格）
- electron-builder 打包配置（移除顶层非法 `main`）

#### 开源前安全加固（2026-08-11）

- IPC 文件读写路径白名单（`fs:readFile/writeFile` 仅允许对话框/最近文件路径）
- Markdown 链接协议白名单（仅 `https://` + `#page-N`），防 XSS
- 外链仅放行 `https://`
- `secure:*` key 白名单（`ai.apiKey` / `ai.provider`）；safeStorage 不可用时拒绝存储（移除 base64 降级）
- 文件读取 100 MB 上限
- JSON 写入原子化（.tmp + rename）
- 原生菜单 IPC→DOM 桥接修复（V0.4 菜单点击失效）
- 生产构建隐藏 DevTools 菜单

## [0.3.1] - 2026-08-09

- Selected Text → AI 浮动工具栏（✦ Ask AI / 翻译 / 解释 / 总结）
- AI Markdown 渲染 + Citation 提取（`[N]` / "第 N 页"）
- AI Context 正式化（scope: document/page/selected-text/search/reading）
- Command Palette 5 分类 + fuzzy 匹配
- Service 抽象边界（UI 不直接依赖 Provider Registry）

## [0.3.0] - 2026-08-08

- 视觉重构：5 级 Elevation、Design Tokens 全局化、Fit-Width 放大 PDF
- 4 套主题（Obsidian / Paper / Midnight / Aurora）+ Theme Engine

## [0.2.0] - 2026-08-07

- AI Copilot：OpenAI-compatible 多 Provider、SSE Streaming、Tool Calling、PDF 总结
- OCR 集成（Tesseract.js 中文）

## [0.1.0] - 2026-08-05

- 首个可运行版本：PDF 打开/渲染/页面管理/Annotation/搜索/合并拆分
