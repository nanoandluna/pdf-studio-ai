# 安全策略（SECURITY）

## 报告漏洞

请**不要**公开 issue 报告安全漏洞。请发送邮件到仓库维护者（GitHub 主页可查），或通过 GitHub Security Advisory 私密提交。

请在报告中包含：

- 漏洞类型与影响范围
- 复现步骤（尽量精简）
- 受影响的版本
- 修复建议（可选）

我们会在 7 天内确认，并在修复后同步公开。

## 安全基线

本项目遵循以下安全基线：

- **Electron**：`contextIsolation: true`、`nodeIntegration: false`、API 经 `contextBridge` 白名单暴露
- **文件访问**：renderer 只能读写主进程白名单内的路径（对话框/最近文件中出现过的路径）
- **外链**：仅放行 `https://` 用系统浏览器打开
- **敏感信息**：API Key 经系统 `safeStorage` 加密存储（`secure:*` IPC），key 白名单：`ai.apiKey` / `ai.provider`；`safeStorage` 不可用时**拒绝存储**（不降级为明文/可逆编码）
- **AI 输出**：Markdown 渲染对链接做协议白名单（仅 `https://` 与内部 `#page-N`），防止注入
- **AI 行为**：破坏性 PDF 操作必须经用户确认（Action Proposal），可撤销，AI 不能悄悄修改 PDF
- **日志**：Logger 对 apiKey/token/secret 递归脱敏
