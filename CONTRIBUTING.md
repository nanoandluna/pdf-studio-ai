# 贡献指南（CONTRIBUTING）

欢迎参与 PDF Studio AI 的开发。这是一个纯 Bug Fix 友好的仓库 —— 项目当前处于 **V0.4 Feature Freeze**，不接受新功能 PR（除非先讨论）。

## 开发环境

- Windows（主开发平台；`scripts/*.mjs` 与 `electron/` 均为跨平台代码，但部分排障脚本是 Windows 专属）
- Node.js 18+（推荐 20+）
- 无需 Rust/MSVC（原 Tauri 计划因环境切换为 Electron）

## 本地构建与测试

```bash
npm install          # 标准安装路径（不要依赖 scripts/install-deps.sh，那是沙箱排障工具）
npm run dev          # 开发模式：Vite dev server + Electron
npm test             # 全量单元测试（Vitest）
npm run build        # 构建 main/preload/renderer 到 dist/
npm run pack         # 打 portable exe（Windows）
npm run dist         # 打 NSIS 安装包（Windows）
```

### Smoke 测试（Windows）

```bash
node scripts/smoke3.mjs        # V0.1 全功能冒烟
node scripts/smoke-v02.mjs     # V0.2/V0.3 冒烟（主题/面板）
node scripts/smoke-v031.mjs    # V0.3.1 冒烟（Selected Text → AI）
node scripts/smoke-v04.mjs     # V0.4 冒烟（Action Proposal/Insights）
```

> 注意：`scripts/stop-deps.mjs` 使用 `taskkill`，仅 Windows 可用（Linux/macOS 贡献者请忽略它）。

## 提交 PR 前检查

1. `npm test` 全绿（当前基线 175/175）
2. `npx tsc --noEmit` 0 错误
3. `npm run build` 成功
4. 如果改了渲染/交互逻辑，跑相关 smoke
5. 遵守 V0.4 Feature Freeze 范围：只允许 Bug Fix / Security Fix / Compatibility Fix / Performance Fix / 严重 UX 修复

## 代码约定

- 设计 Tokens（CSS Variables）驱动颜色，**严禁组件内硬编码颜色**（见 `docs/DESIGN-SYSTEM.md`）
- 新增测试必须与实现同步提交
- 敏感信息（API Key 等）只走主进程 safeStorage（`secure:*` IPC），白名单 key：`ai.apiKey` / `ai.provider`
- renderer 禁止直接读写任意文件路径（主进程 `fs:readFile/writeFile` 有路径白名单）
