# 安全策略

## 报告漏洞

请勿在公开 issue 中提交利用细节、真实密钥或机密文档。优先使用仓库 Security 页面提供的 **Report a vulnerability**（如果维护者已启用私密报告）。入口：[Security Advisories](https://github.com/nanoandluna/pdf-studio-ai/security/advisories)。

如果没有私密报告入口，可以开一个仅请求联系渠道的 issue，先不要发布漏洞细节。本项目由个人维护，没有固定响应时限承诺。

请提供受影响的版本/commit、影响范围、最小复现步骤和可公开的样例。维护者会评估当前主分支上的修复；旧安装包可能落后于源码。

## 当前安全边界

- Electron renderer 启用 sandbox、contextIsolation，关闭 nodeIntegration。preload 只提供明确的 API；IPC 验证主窗口和主 frame；禁止页面导航与 webview。
- 文件读写受主进程对话框/最近文件授权限制。拖拽只使用浏览器提供的 File 字节，首次保存另选输出路径。PDF 写入先落到同目录临时文件，完成后替换目标文件。
- 外链仅通过系统浏览器打开 HTTPS 链接；AI 远程接口要求 HTTPS，仅允许本机 HTTP。
- 各 AI 服务的配置与密钥分别存储在 `safeStorage` 加密数据中；系统加密不可用时拒绝保存。操作系统账户被攻破不在该加密保证范围内。
- Markdown 链接限制为 HTTPS 或内部页码。文档/模型输出是不可信数据；AI 修改必须经用户确认。
- 生产构建不暴露测试 store。冒烟的 fixture 路径注入仅允许在未打包开发环境中使用。

## 数据与依赖

PDF 默认不会上传。远程 AI 会接收提问、聊天上下文与相关 PDF 文本，遵循所选服务的政策；本机 AI endpoint 的行为由使用者控制。OCR 在本地运行，但资源下载依赖第三方 CDN；完整离线 OCR 尚未实现。

开发工具依赖也可能出现安全公告。使用 `npm audit --registry=https://registry.npmjs.org` 检查完整依赖；用 `--omit=dev` 区分 npm 运行时依赖。Electron 虽列在 devDependencies 中仍随桌面软件发布，必须独立跟进 Electron 安全更新，不能把 production audit 的结果当作安装包的全面安全证明。
