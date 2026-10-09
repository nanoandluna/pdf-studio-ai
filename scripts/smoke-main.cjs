const { app, BrowserWindow, dialog } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');

const root = path.join(__dirname, '..');
const outputDir = process.env.PDF_STUDIO_SMOKE_DIR;
app.setVersion(require('../package.json').version);
app.setPath('userData', path.join(outputDir, 'profile'));
process.env.VITE_DEV_SERVER_URL = '';
dialog.showSaveDialog = async () => ({ canceled: false, filePath: path.join(outputDir, 'output.pdf') });
require(path.join(root, 'dist/main/index.cjs'));
const timeout = setTimeout(() => { console.error('SMOKE TIMEOUT'); app.exit(1); }, 60_000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    assert.ok(win.webContents.getLastWebPreferences().sandbox, 'renderer must be sandboxed');
    const run = code => win.webContents.executeJavaScript(code, true);
    for (let i = 0; i < 100; i++) {
      if (await run('!!window.__pdfStudioTest__ && !!window.pdfStudio')) break;
      await sleep(100);
    }
    const fixture = JSON.stringify(path.join(root, 'tests/fixtures/sample-multi-page.pdf'));
    const opened = await run(`(async () => {
      const data = await window.pdfStudio.readFile(${fixture});
      await window.__pdfStudioTest__.document.getState().openBytes(data, '', 'smoke.pdf');
      return window.__pdfStudioTest__.document.getState().document.pageCount;
    })()`);
    assert.equal(opened, 4, 'real pdf.js loads four fixture pages');
    const result = await run(`(async () => {
      const store = window.__pdfStudioTest__.document.getState();
      await store.rotatePages([1], 90);
      await store.deletePages([0]);
      await store.reorderPages([3, 2, 1, 0]);
      return [await store.save(), await store.save()];
    })()`);
    assert.deepEqual(result, [true, true], 'both real disk saves succeed');
    const pdf = await PDFDocument.load(fs.readFileSync(path.join(outputDir, 'output.pdf')));
    assert.equal(pdf.getPageCount(), 3);
    assert.equal(pdf.getPage(2).getRotation().angle, 90, 'rotation is applied once');
    await run(`(async () => {
      const store = window.__pdfStudioTest__.document.getState();
      await store.undo(); await store.undo(); await store.undo(); await store.save();
    })()`);
    const undone = await PDFDocument.load(fs.readFileSync(path.join(outputDir, 'output.pdf')));
    assert.equal(undone.getPageCount(), 4, 'undo after save restores deleted page');
    assert.ok(undone.getPages().every(page => page.getRotation().angle === 0));
    const denied = await run(`window.pdfStudio.readFile(${JSON.stringify(path.join(root, 'package.json'))}).then(() => false, () => true)`);
    assert.ok(denied, 'arbitrary disk reads are denied');
    const canvas = await run('document.querySelector("[data-page] canvas")?.width ?? 0');
    assert.ok(canvas > 0, 'real viewer renders a page');
    const version = await run('window.pdfStudio.appVersion()');
    assert.equal(version, require('../package.json').version);
    await sleep(200);
    const shot = await win.capturePage();
    fs.writeFileSync(path.join(outputDir, 'viewer.png'), shot.toPNG());
    console.log(`SMOKE PASS: sandbox, preload, rendering, repeated save, undo, IPC, version. Evidence: ${outputDir}`);
    clearTimeout(timeout);
    app.exit(0);
  } catch (error) {
    console.error('SMOKE FAIL', error);
    app.exit(1);
  }
});
