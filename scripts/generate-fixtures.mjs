// ============================================================
// 生成测试用 PDF fixtures（不依赖用户电脑中的 PDF）
// 运行：node scripts/generate-fixtures.mjs
// ============================================================

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../tests/fixtures');
fs.mkdirSync(outDir, { recursive: true });

async function makeSinglePage() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 600]);
  page.drawText('PDF Studio AI Sample Document', { x: 50, y: 500, size: 16, font });
  page.drawText('This is a simple sample PDF used for testing.', { x: 50, y: 460, size: 11, font });
  page.drawText('Page 1 content: Hello World.', { x: 50, y: 420, size: 11, font });
  const bytes = await doc.save();
  fs.writeFileSync(path.join(outDir, 'sample.pdf'), bytes);
  console.log('✓ sample.pdf');
}

async function makeMultiPage() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const texts = [
    'Page one of the multi page document.',
    'Page two discusses the PDF format.',
    'Page three contains searchable keyword AlphaBeta.',
    'Page four has the conclusion and references.',
  ];
  for (let i = 0; i < texts.length; i++) {
    const page = doc.addPage([400, 600]);
    page.drawText(`Multi-Page Sample - Page ${i + 1}`, { x: 50, y: 500, size: 14, font });
    page.drawText(texts[i], { x: 50, y: 460, size: 11, font });
  }
  const bytes = await doc.save();
  fs.writeFileSync(path.join(outDir, 'sample-multi-page.pdf'), bytes);
  console.log('✓ sample-multi-page.pdf');
}

async function makeTextDoc() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) {
    const page = doc.addPage([400, 600]);
    page.drawText(`Text document page ${i + 1}`, { x: 50, y: 500, size: 14, font });
    page.drawText('The quick brown fox jumps over the lazy dog.', { x: 50, y: 460, size: 11, font });
    page.drawText('Search me: unique-token-xyz', { x: 50, y: 420, size: 11, font });
    page.drawRectangle({ x: 50, y: 300, width: 300, height: 60, color: rgb(0.9, 0.9, 0.95) });
  }
  const bytes = await doc.save();
  fs.writeFileSync(path.join(outDir, 'sample-text.pdf'), bytes);
  console.log('✓ sample-text.pdf');
}

await makeSinglePage();
await makeMultiPage();
await makeTextDoc();
console.log('✅ fixtures 生成完毕 →', outDir);
