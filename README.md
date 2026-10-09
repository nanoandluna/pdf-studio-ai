# PDF Studio AI

简体中文 · [English](README.en.md)

本地优先的 PDF 桌面工作台，使用 Electron、React 和 TypeScript 构建。AI 是可选能力：无需账号或 API Key，也可以阅读和管理 PDF 页面。

[![CI](https://github.com/nanoandluna/pdf-studio-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/nanoandluna/pdf-studio-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![Obsidian 主题下的 PDF 工作台](docs/assets/theme-obsidian.png)

## 已实现功能

- **阅读**：PDF 渲染、缩略图、翻页、缩放、全文搜索、阅读模式。
- **页面管理**：删除、旋转、排序、提取、合并、拆分；保存后仍可撤销和重做。
- **OCR**：Tesseract.js 中文/英文识别，识别结果加入当前会话搜索索引。
- **可选 AI**：OpenAI / DeepSeek / Qwen / Ollama / 自定义 OpenAI-compatible 服务；自选模型与 API Key。
- **文档辅助**：问答、页码引用、选中文字翻译/解释/总结、文档分析；AI 页面修改需用户确认。
- **工作区**：四套主题、命令面板、可折叠侧栏和可调宽 AI 面板。

## 项目状态与边界

当前源码版本为 **0.4.1**，仍属于早期桌面项目。主要验证及打包平台为 **Windows x64**；Linux CI 验证源码构建与单元测试，尚未提供 macOS/Linux 安装包。

- **标注原型已移除**：旧版文本/高亮/画笔等 Overlay 没有写入导出的 PDF。完成保存、撤销、重开验证后再重新引入，见 [路线图](docs/ROADMAP.md)。
- 当前提供**页面级编辑**，不支持直接修改 PDF 原有文字。密码保护 PDF、表单、书签、数字签名等复杂结构的编辑保真尚未保证，处理重要文件时请保留原件。
- 单个打开文件上限 **100 MB**。拖拽文件通过浏览器授予的字节读取，首次保存会要求**另存为**。
- OCR 首次使用需要下载识别引擎及语言模型；目前不保证完全离线运行，也不会把 OCR 结果保存为 PDF 文本层。
- AI 回答可能有误，引用页码是导航辅助。长文档上下文有长度限制。

## 下载与安装

到 [GitHub Releases](https://github.com/nanoandluna/pdf-studio-ai/releases) 查看已发布版本。**发行版可能落后于源码**，请核对版本和校验值。Windows 安装包尚未进行代码签名。

## 从源码运行

推荐 **Node.js 24 LTS**（最低 22.12）和 npm：

```sh
git clone https://github.com/nanoandluna/pdf-studio-ai.git
cd pdf-studio-ai
npm ci
npm run dev
```

```sh
npm run check       # 启动脚本语法、类型检查、单元测试、生产构建
npm run test:smoke  # 真实 Electron 渲染、连续保存、撤销、IPC 检查（Windows）
npm run pack        # Windows x64 便携版
npm run dist        # Windows x64 NSIS 安装包
```

构建输出在 `dist/`，安装包在 `release/<版本>/`。冒烟测试使用独立临时配置目录，结束后恢复生产构建，并输出截图和测试 PDF 所在路径。请在打包前运行。开发约定见 [贡献指南](CONTRIBUTING.md)。

## AI 配置与隐私

打开 **设置 → AI**，选择服务，填写 Base URL、Model 和 API Key，再保存或测试。Ollama 可以填写自己的本机地址和已安装模型，无需 API Key。远程地址要求 HTTPS，本机 localhost / 127.0.0.1 / ::1 可以使用 HTTP。

各服务的配置和密钥分别保存，使用 Electron `safeStorage` 加密。旧版共享密钥只迁移给原来选中的服务。系统加密不可用时保存会失败，不会显示保存成功。

PDF 默认留在本机。使用 AI 时，相关文档文本、提问和聊天上下文会发送到你配置的服务；启用数据外发提示时，每次远程请求前会确认。提示开关不会改变服务商的数据保留政策。本项目未实现使用统计或遥测。

OCR 会访问第三方资源 CDN 下载识别资源，但识别过程在本地执行。安全边界和漏洞报告方式见 [SECURITY.md](SECURITY.md)。

## 快捷键

| 快捷键 | 功能 |
|---|---|
| Ctrl+O | 打开 PDF |
| Ctrl+S / Ctrl+Shift+S | 保存 / 另存为 |
| Ctrl+Z / Ctrl+Shift+Z | 撤销 / 重做 |
| Ctrl+F | 搜索 |
| Ctrl+K | 命令面板 |
| Ctrl++ / Ctrl+- / Ctrl+0 | 放大 / 缩小 / 适合页面 |
| Ctrl+E | AI 面板 |
| Ctrl+Shift+R | 阅读模式 |
| PageUp / PageDown | 翻页 |
| Delete | 删除选中页（输入框内不触发） |

## 常见问题

- **安装缓慢**：`npm ci` 和首次启动可能下载 Electron，检查网络与代理配置；不要把个人镜像或代理配置提交到仓库。
- **AI 无法连接**：先选择服务、填写模型与密钥，再点击当前服务的测试；确认 endpoint 支持 Chat Completions。
- **PDF 能读但无法编辑**：pdf.js 与 pdf-lib 的兼容范围不同。保存失败会保留当前编辑状态；请使用简化样例报告问题。
- **OCR 无法运行**：首次使用需要联网下载资源；缓存或 CDN 访问失败时可稍后重试。

## 参与贡献

欢迎 [报告问题或提出建议](https://github.com/nanoandluna/pdf-studio-ai/issues/new/choose)。优先接受可靠性、安全、兼容性和体验改进；较大功能请先讨论。请勿提交 API Key、个人配置或机密 PDF。

[贡献指南](CONTRIBUTING.md) · [路线图](docs/ROADMAP.md) · [变更记录](CHANGELOG.md)

MIT License。第三方组件见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
