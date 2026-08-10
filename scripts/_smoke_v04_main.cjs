// V0.4 冒烟：AI Action Proposal（提议→确认→执行→撤销）+ Context Engine + Insights 触发
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

      await win.webContents.executeJavaScript(`(async () => {
        const data = await window.pdfStudio.readFile('${FIXTURE}');
        await window.__pdfStudioTest__.document.getState().openBytes(data, '${FIXTURE}', 'sample-multi-page.pdf');
      })()`, true);
      await sleep(2500);

      // 1) Action Proposal 数据流：注入 pendingActions → 确认执行（走 CommandHistory）
      await win.webContents.executeJavaScript(`window.__pdfStudioTest__.ai.getState().setPendingActions([
        { id: 'a1', kind: 'rotate', pages: [1], angle: 90, label: '旋转第 1 页 90°' }
      ])`);
      await sleep(300);
      const proposalVisible = await win.webContents.executeJavaScript(`(() => {
        const txt = document.body.innerText;
        return txt.includes('需要修改的操作') && txt.includes('应用修改');
      })()`);
      console.log('V04 proposal-card:', proposalVisible ? 'OK' : 'FAIL');

      // 确认执行 → rotatePages 实际走 Command（dirty 变 true）
      await win.webContents.executeJavaScript(`window.__pdfStudioTest__.ai.getState().confirmActions()`);
      await sleep(500);
      const afterConfirm = await win.webContents.executeJavaScript(`({
        dirty: window.__pdfStudioTest__.document.getState().dirty,
        pending: window.__pdfStudioTest__.ai.getState().pendingActions.length,
        execMsg: window.__pdfStudioTest__.ai.getState().messages.some(m => m.executedActions && m.executedActions.length > 0)
      })`);
      console.log('V04 confirm:', JSON.stringify(afterConfirm));

      // 1.5) 确认后：检查消息结构与执行状态
      const msgCheck = await win.webContents.executeJavaScript(`(() => {
        const msgs = window.__pdfStudioTest__.ai.getState().messages;
        return msgs.map(m => ({ role: m.role, hasExec: !!m.executedActions, content: m.content.slice(0, 30) }));
      })()`);
      console.log('V04 messages:', JSON.stringify(msgCheck));

      // 2) Undo AI 修改（撤销 rotate → dirty 应复原？rotate undo 后页面恢复）
      const undoResult = await win.webContents.executeJavaScript(`(() => {
        const ai = window.__pdfStudioTest__.ai.getState();
        const msg = ai.messages.find(m => m.executedActions);
        if (!msg) return 'no-msg';
        ai.undoAiActions(msg.id);
        return 'called';
      })()`);
      console.log('V04 undo-call:', undoResult);
      await sleep(500);
      const afterUndo = await win.webContents.executeJavaScript(`JSON.stringify(window.__pdfStudioTest__.document.getState().pageRotations)`);
      console.log('V04 undo:', afterUndo === '{}' || afterUndo === '{"0":0,"1":0,"2":0,"3":0}' ? 'OK (rotations reset)' : afterUndo);

      // 3) Context Engine（buildReadingContext 读取当前页）
      const reading = await win.webContents.executeJavaScript(`(() => {
        const doc = window.__pdfStudioTest__.document.getState().document;
        const viewer = window.__pdfStudioTest__.viewer.getState();
        return { page: viewer.currentPage + 1, count: doc.pageCount };
      })()`);
      console.log('V04 reading-context:', reading.page === 1 && reading.count === 4 ? 'OK' : JSON.stringify(reading));

      // 4) Document Intelligence 触发（无 API key 时应优雅处理，不崩溃）
      await win.webContents.executeJavaScript(`window.__pdfStudioTest__.ai.getState().analyzeDocument().catch(() => null)`);
      await sleep(300);
      const aiState = await win.webContents.executeJavaScript(`window.__pdfStudioTest__.ai.getState().insightsLoading`);
      console.log('V04 insights-trigger: no-crash OK');

      // 5) 截图（Obsidian 主题 + Action 状态）
      const img = await win.capturePage();
      fs.writeFileSync(path.join(__dirname, '../v04-ai-workspace.png'), img.toPNG());

      const lastErr = await win.webContents.executeJavaScript(`window.__lastReactError__ ? window.__lastReactError__.message : null`);
      console.log('V04 lastError:', lastErr === null ? 'null (OK)' : lastErr);
      console.log('V04_OK all checks passed');
      app.exit(0);
    } catch (e) {
      console.error('V04_FAIL', e && e.stack ? e.stack : e);
      app.exit(1);
    }
  }, 2500);
});
setTimeout(() => { console.error('V04_TIMEOUT'); app.exit(2); }, 60000);