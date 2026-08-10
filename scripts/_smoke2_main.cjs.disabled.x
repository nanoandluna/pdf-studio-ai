// 真实入口冒烟：加载 dist/main/index.cjs，验证 IPC + UI，并截图
const path = require('path');
const fs = require('fs');
process.env.VITE_DEV_SERVER_URL = '';
const { app } = require('electron');
require(path.join(__dirname, '../dist/main/index.cjs'));

app.whenReady().then(() => {
  setTimeout(async () => {
    try {
      const { BrowserWindow } = require('electron');
      const win = BrowserWindow.getAllWindows()[0];
      if (!win) { console.error('SMOKE2_FAIL no window'); app.exit(1); return; }
      // 1) 验证 preload 桥
      const hasBridge = await win.webContents.executeJavaScript('typeof window.pdfStudio !== "undefined" && typeof window.pdfStudio.fileExists === "function"');
      console.log('SMOKE2 bridge:', hasBridge);
      // 2) 验证 IPC 调用真实 main
      const exists = await win.webContents.executeJavaScript(
        `window.pdfStudio.fileExists('C:/Users/moss/WorkBuddy/2026-08-08-21-21-01/pdf-studio-ai/tests/fixtures/sample.pdf')`
      );
      console.log('SMOKE2 fileExists:', exists);
      // 3) 验证 settings IPC
      const settings = await win.webContents.executeJavaScript(`window.pdfStudio.getSettings()`);
      console.log('SMOKE2 settings:', JSON.stringify(settings));
      // 4) 等待 UI 渲染后截图
      await new Promise(r => setTimeout(r, 1500));
      const img = await win.capturePage();
      fs.writeFileSync(path.join(__dirname, '../smoke-home.png'), img.toPNG());
      console.log('SMOKE2_OK screenshot saved');
      app.exit(0);
    } catch (e) {
      console.error('SMOKE2_FAIL', e && e.message ? e.message : e);
      app.exit(1);
    }
  }, 2500);
});
setTimeout(() => { console.error('SMOKE2_TIMEOUT'); app.exit(2); }, 40000);
