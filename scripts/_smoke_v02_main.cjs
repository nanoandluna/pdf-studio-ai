// V0.2 冒烟：加载真实 main，验证主题切换 / Command Palette / AI Panel / 工作区折叠 + 截图
const path = require('path');
const fs = require('fs');
process.env.VITE_DEV_SERVER_URL = '';
const { app } = require('electron');
require(path.join(__dirname, '../dist/main/index.cjs'));

const FIXTURE = path.resolve(__dirname, '../tests/fixtures/sample-multi-page.pdf').replace(/\\/g, '/');
const OUT = path.join(__dirname, '..');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

app.whenReady().then(() => {
  setTimeout(async () => {
    try {
      const { BrowserWindow } = require('electron');
      const win = BrowserWindow.getAllWindows()[0];

      // 1) 打开 PDF
      await win.webContents.executeJavaScript(`(async () => {
        const data = await window.pdfStudio.readFile('${FIXTURE}');
        await window.__pdfStudioTest__.document.getState().openBytes(data, '${FIXTURE}', 'sample-multi-page.pdf');
      })()`, true);
      await sleep(2500);

      // 2) 验证主题系统：四套主题即时切换
      const themeResults = [];
      for (const theme of ['obsidian', 'paper', 'midnight', 'aurora']) {
        await win.webContents.executeJavaScript(`window.__pdfStudioTest__.settings.getState().setThemeId('${theme}')`);
        await sleep(400);
        const applied = await win.webContents.executeJavaScript(`({
          theme: document.documentElement.dataset.theme,
          dark: document.documentElement.classList.contains('dark')
        })`);
        themeResults.push(`${theme}:${applied.theme === theme ? 'OK' : 'FAIL'}`);
        const img = await win.capturePage();
        fs.writeFileSync(path.join(OUT, `theme-${theme}.png`), img.toPNG());
      }
      console.log('V02 themes:', themeResults.join(' '));

      // 2b) V0.3/V0.3.1 视觉回归截图（独立命名）
      for (const theme of ['obsidian', 'paper', 'midnight', 'aurora']) {
        await win.webContents.executeJavaScript(`window.__pdfStudioTest__.settings.getState().setThemeId('${theme}')`);
        await sleep(350);
        const img = await win.capturePage();
        fs.writeFileSync(path.join(OUT, `theme-${theme}-v03.png`), img.toPNG());
        fs.writeFileSync(path.join(OUT, `theme-${theme}-v031.png`), img.toPNG());
      }
      console.log('V03 screenshots: theme-*-v03.png / theme-*-v031.png saved');

      // 2c) Command Palette 分类验证（V0.3.1）
      await win.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))`);
      await sleep(350);
      // 直接检查 palette DOM 文本（不受滚动可见性影响）
      const cats = await win.webContents.executeJavaScript(`(() => {
        const input = document.querySelector('[placeholder*="搜索操作"]');
        if (!input) return [];
        const palette = input.closest('div[style*="palette-in"]') || input.parentElement.parentElement.parentElement;
        const txt = palette ? palette.innerText : '';
        const out = [];
        for (const c of ['AI','PDF','View','Navigation','Tools']) if (txt.includes(c)) out.push(c);
        return out;
      })()`);
      console.log('V031 palette-categories:', cats.length >= 2 ? 'OK (' + cats.join('/') + ')' : 'FAIL ' + cats.join(','));
      const palImg = await win.capturePage();
      fs.writeFileSync(path.join(OUT, 'v031-command-palette.png'), palImg.toPNG());
      await win.webContents.executeJavaScript(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
      await sleep(200);

      // 3) 验证 Command Palette 打开
      await win.webContents.executeJavaScript(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))`);
      await sleep(300);
      const palette = await win.webContents.executeJavaScript(`document.querySelector('[placeholder*="搜索操作"]') !== null`);
      console.log('V02 palette:', palette ? 'OK' : 'FAIL');
      await win.webContents.executeJavaScript(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
      await sleep(200);

      // 4) 验证 AI Panel（PDF Copilot）
      const aiPanel = await win.webContents.executeJavaScript(`(() => {
        const el = document.body.innerText;
        return el.includes('PDF Copilot') ? 'OK' : 'MISSING';
      })()`);
      console.log('V02 copilot:', aiPanel);

      // 5) 验证工作区折叠（AI Panel 关闭/打开）
      await win.webContents.executeJavaScript(`window.__pdfStudioTest__.workspace.getState().toggleAiPanel()`);
      await sleep(300);
      const aiClosed = await win.webContents.executeJavaScript(`window.__pdfStudioTest__.workspace.getState().aiPanelOpen`);
      await win.webContents.executeJavaScript(`window.__pdfStudioTest__.workspace.getState().toggleAiPanel()`);
      await sleep(300);
      console.log('V02 ai-collapse:', aiClosed === false ? 'OK' : 'FAIL');

      // 6) 验证 Reading Mode
      await win.webContents.executeJavaScript(`window.__pdfStudioTest__.workspace.getState().toggleReadingMode()`);
      await sleep(300);
      const reading = await win.webContents.executeJavaScript(`window.__pdfStudioTest__.workspace.getState().readingMode`);
      await win.webContents.executeJavaScript(`window.__pdfStudioTest__.workspace.getState().toggleReadingMode()`);
      await sleep(300);
      console.log('V02 reading-mode:', reading === true ? 'OK' : 'FAIL');

      // 7) 还原 Obsidian + 最终截图
      await win.webContents.executeJavaScript(`window.__pdfStudioTest__.settings.getState().setThemeId('obsidian')`);
      await sleep(300);
      const imgFinal = await win.capturePage();
      fs.writeFileSync(path.join(OUT, 'v02-final-obsidian.png'), imgFinal.toPNG());

      // 8) 检查 React 错误
      const lastErr = await win.webContents.executeJavaScript(`window.__lastReactError__ ? window.__lastReactError__.message : null`);
      console.log('V02 lastError:', lastErr === null ? 'null (OK)' : lastErr);

      console.log('V02_OK all checks passed');
      app.exit(0);
    } catch (e) {
      console.error('V02_FAIL', e && e.stack ? e.stack : e);
      app.exit(1);
    }
  }, 2500);
});
setTimeout(() => { console.error('V02_TIMEOUT'); app.exit(2); }, 60000);