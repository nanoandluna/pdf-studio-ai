// 完整功能冒烟：加载真实 main，注入 fixture PDF，验证渲染 + 删除页面 + undo
const path = require('path');
const fs = require('fs');
process.env.VITE_DEV_SERVER_URL = '';
const { app } = require('electron');
require(path.join(__dirname, '../dist/main/index.cjs'));

const FIXTURE = path.resolve(__dirname, '../tests/fixtures/sample-multi-page.pdf').replace(/\\/g, '/');

app.whenReady().then(() => {
  setTimeout(async () => {
    try {
      const { BrowserWindow } = require('electron');
      const win = BrowserWindow.getAllWindows()[0];
      // 1) 加载 fixture PDF
      const script = `(async () => {
        const data = await window.pdfStudio.readFile('${FIXTURE}');
        await window.__pdfStudioTest__.document.getState().openBytes(data, '${FIXTURE}', 'sample-multi-page.pdf');
        return { ok: true };
      })()`;
      await win.webContents.executeJavaScript(script, true);
      console.log('SMOKE3 open: ok');
      // 等渲染 + 缩略图
      await new Promise(r => setTimeout(r, 2500));
      const docState = await win.webContents.executeJavaScript(`({
        hasDoc: !!window.__pdfStudioTest__.document.getState().document,
        pageCount: window.__pdfStudioTest__.document.getState().document?.pageCount,
        thumbCount: window.__pdfStudioTest__.document.getState().thumbnails.length
      })`);
      console.log('SMOKE3 docState:', JSON.stringify(docState));
      const lastErr = await win.webContents.executeJavaScript(`window.__lastReactError__ ? { message: window.__lastReactError__.message, stack: (window.__lastReactError__.stack || '').slice(0, 800), comp: (window.__lastReactError__.componentStack || '').slice(0, 800) } : null`);
      console.log('SMOKE3 lastError:', JSON.stringify(lastErr));
      const img1 = await win.capturePage();
      fs.writeFileSync(path.join(__dirname, '../demo-pdf-open.png'), img1.toPNG());
      // 4) 删除第 2 页
      await win.webContents.executeJavaScript(`window.__pdfStudioTest__.document.getState().deletePages([1])`);
      await new Promise(r => setTimeout(r, 800));
      const afterDelete = await win.webContents.executeJavaScript(`({
        dirty: window.__pdfStudioTest__.document.getState().dirty,
        deletedCount: window.__pdfStudioTest__.document.getState().deletedPages.size
      })`);
      console.log('SMOKE3 delete:', JSON.stringify(afterDelete));
      // 5) undo
      await win.webContents.executeJavaScript(`window.__pdfStudioTest__.document.getState().undo()`);
      await new Promise(r => setTimeout(r, 500));
      const afterUndo = await win.webContents.executeJavaScript(`({
        dirty: window.__pdfStudioTest__.document.getState().dirty,
        deletedCount: window.__pdfStudioTest__.document.getState().deletedPages.size
      })`);
      console.log('SMOKE3 undo:', JSON.stringify(afterUndo));
      const img2 = await win.capturePage();
      fs.writeFileSync(path.join(__dirname, '../demo-pdf-after-undo.png'), img2.toPNG());
      console.log('SMOKE3_OK all checks passed');
      app.exit(0);
    } catch (e) {
      console.error('SMOKE3_FAIL',e && e.stack ? e.stack : e);
      app.exit(1);
    }
  }, 2500);
});
setTimeout(() => { console.error('SMOKE3_TIMEOUT'); app.exit(2); }, 45000);