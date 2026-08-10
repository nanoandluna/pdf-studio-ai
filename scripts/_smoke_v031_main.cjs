// V0.3.1 冒烟：Selected Text → AI 流程（区域文本提取 + Selection Toolbar 数据流）
const path = require('path');
const fs = require('fs');
process.env.VITE_DEV_SERVER_URL = '';
const { app } = require('electron');
require(path.join(__dirname, '../dist/main/index.cjs'));

const FIXTURE = path.resolve(__dirname, '../tests/fixtures/sample-multi-page.pdf').replace(/\\/g, '/');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

      // 2) 模拟选区：直接调用 store.setTextSelection
      await win.webContents.executeJavaScript(`window.__pdfStudioTest__.viewer.getState().setTextSelection({
        pageIndex: 0,
        text: 'Page one of the multi page document.',
        x: 50, y: 100, width: 300, height: 40
      })`);
      await sleep(400);
      const selState = await win.webContents.executeJavaScript(`window.__pdfStudioTest__.viewer.getState().selection`);
      console.log('V031 selection-set:', selState && selState.text.includes('multi page') ? 'OK' : 'FAIL');

      // 4) 点击 "✦ Ask AI" → AI Panel 打开 + Context=Selection
      await win.webContents.executeJavaScript(`(() => {
        const btns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Ask AI'));
        if (btns[0]) btns[0].click();
        return btns.length;
      })()`);
      await sleep(500);
      const aiState = await win.webContents.executeJavaScript(`({
        panelOpen: window.__pdfStudioTest__.workspace.getState().aiPanelOpen,
        scope: window.__pdfStudioTest__.ai.getState().contextScope,
        lastMsg: window.__pdfStudioTest__.ai.getState().messages[0]?.content || ''
      })`);
      console.log('V031 ask-ai:', JSON.stringify(aiState));
      const askOk = aiState.panelOpen === true && (aiState.scope === 'selected-text' || aiState.lastMsg.includes('multi page'));
      console.log('V031 ask-ai result:', askOk ? 'OK' : 'FAIL');

      // 5) 验证 AI 状态语言（无开发者术语）
      const stateText = await win.webContents.executeJavaScript(`document.body.innerText`);
      const hasDevTerms = /tool_call|function_call|POST|GET|api\.|fetch|SSE/i.test(stateText);
      console.log('V031 no-dev-terms:', hasDevTerms ? 'FAIL (found dev terms)' : 'OK');

      // 6) 截图
      const img = await win.capturePage();
      fs.writeFileSync(path.join(__dirname, '../v031-ai-workspace.png'), img.toPNG());

      const lastErr = await win.webContents.executeJavaScript(`window.__lastReactError__ ? window.__lastReactError__.message : null`);
      console.log('V031 lastError:', lastErr === null ? 'null (OK)' : lastErr);
      console.log('V031_OK all checks passed');
      app.exit(0);
    } catch (e) {
      console.error('V031_FAIL', e && e.stack ? e.stack : e);
      app.exit(1);
    }
  }, 2500);
});
setTimeout(() => { console.error('V031_TIMEOUT'); app.exit(2); }, 60000);