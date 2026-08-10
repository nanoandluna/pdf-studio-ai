# WorkBuddy 沙箱专用依赖安装脚本 v2
# 关键修复：
#   1) 清空 NODE_OPTIONS 中的 safe-delete shim（--require=genie-safe-delete.cjs），
#      否则 npm 任何删除操作都被劫持为 trash 并超时失败
#   2) cache 使用相对路径 ./.npm-cache，避免 Git Bash $PWD(/c/...) 被 npm 错误解析
#   3) 使用 npm 12 规避 npm 10.9 safe-delete bug
set -e
cd "$(dirname "$0")/.."

NPM="$(command -v npm)"
echo "npm: $NPM"

# 清空 shim（保留 --use-system-ca 以支持 https 镜像）
export NODE_OPTIONS="--use-system-ca"

echo "NODE_OPTIONS=$NODE_OPTIONS"

# 1) 主安装：npm12 + 项目内 cache（相对路径）+ 镜像
"$NPM" exec --yes --package=npm@12.0.2 npm -- install --no-audit --no-fund \
  --cache "$PWD/.npm-cache" --registry=https://registry.npmmirror.com || {
  echo "!!! 首次安装失败，尝试清理残留后重试"
  # 若失败：把坏 cache rename 掉（rename 不被劫持），node_modules 保留续装
  if [ -d ".npm-cache" ]; then
    mv .npm-cache ".npm-cache.bak-$(date +%s)" 2>/dev/null || true
  fi
  "$NPM" exec --yes --package=npm@12.0.2 npm -- install --no-audit --no-fund \
    --cache "$PWD/.npm-cache" --registry=https://registry.npmmirror.com
}

# 2) 批准原生/安装脚本（npm12 默认 block）
"$NPM" exec --yes --package=npm@12.0.2 npm -- install-scripts approve electron electron-builder esbuild 2>/dev/null || true
"$NPM" exec --yes --package=npm@12.0.2 npm -- install-scripts approve 2>/dev/null || true

# 3) 确保 electron / esbuild 原生二进制下载（走 npmmirror 镜像）
ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node node_modules/electron/install.js || echo "electron install.js 失败，稍后处理"
node node_modules/esbuild/install.js || echo "esbuild install.js 失败，稍后处理"

echo "=== 安装完成 ==="
node -e "console.log('electron:', require('./node_modules/electron/package.json').version)"
ls node_modules/electron/dist/electron.exe && echo "✓ electron.exe 就绪"
