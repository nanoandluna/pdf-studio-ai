# 贡献指南

欢迎修复问题、补充测试和改善文档。较大功能请先通过 issue 描述使用场景，并参考 [路线图](docs/ROADMAP.md)。

## 环境与验证

推荐 Node.js 24 LTS（最低 22.12）和 npm。Windows x64 是主要桌面验证平台。

```sh
npm ci
npm run dev
npm run check
npm run test:smoke
```

`check` 包含所有启动脚本语法检查、TypeScript、Vitest 和生产构建。涉及文件生命周期、IPC 或渲染时必须运行真实 Electron 冒烟测试；该测试不调用外部 AI 服务，使用独立临时配置目录，失败会返回非零退出码。测试后生产 renderer 会重新构建，不包含测试 store 入口。打包命令：`npm run pack`（便携版）/ `npm run dist`（安装包）。

CI 在 Windows 和 Linux 上执行基础检查；Windows 还验证 Electron 冒烟与打包。Linux 检查通过不意味着 Linux 桌面功能已经验证。不要同时运行构建、冒烟和打包，它们共用 `dist/`。

## 结构

| 路径 | 职责 |
|---|---|
| `electron/` | 窗口、菜单、IPC、路径授权、安全存储和文件写入 |
| `src/stores/` | 文档、视图、AI、配置、工作区和最近文件状态 |
| `src/engine/` | pdf.js 阅读引擎与 pdf-lib 页面编辑引擎 |
| `src/ai/` | Provider、上下文、工具、配置验证与引用提取 |
| `src/components/` | React 界面与主题组件 |
| `src/ocr/`, `src/search/` | OCR 与当前会话的文本索引 |
| `tests/` | 单元及回归测试；样例仅使用可公开的生成 PDF |
| `scripts/` | 开发、构建、语法检查和真实 Electron 冒烟 |

## 关键约定

- 颜色使用设计 Tokens，见 [DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md)。
- `documentStore` 的页面索引始终指向首次打开的原始 PDF；保存不能替换源字节，否则会重复应用操作并破坏撤销。
- pdf.js 会把输入字节传给 worker。传入独立副本，不得转移保存引擎仍需要的 ArrayBuffer。
- renderer 通过明确的 preload API 调用主进程；新 IPC 要验证发送窗口/主 frame，并限制输入范围。禁止提供任意通道的 invoke API。
- API Key 只通过 `secure:*` 加密保存。各 Provider 的配置独立；日志与测试样例不能含真实密钥。
- AI 的修改操作必须先产生提议，经用户确认后执行，并可以撤销。
- 新的行为必须在 README 中准确说明。不要把原型、空回调或数据模型预留写成已完成能力。

## 提交 PR

说明具体问题、改动后的行为和验证结果。数据丢失、安全和兼容性修复请补充能复现旧问题的回归测试。不要提交 `node_modules/`、`dist/`、`release/`、用户文件或本机专用安装/清理脚本。日志和 PDF 样例请先脱敏。

## 发布

维护者创建与 `package.json` 版本一致的 `vX.Y.Z` 标签后，Release workflow 会进行检查和 Windows 打包，再创建包含便携版、安装包和 SHA256 校验的**草稿发行版**。审阅安装结果、已知限制和发布说明后再公开。请不要绕过测试提交带调试入口的安装包。
