# Third-Party Notices

PDF Studio AI uses the following main components. Exact versions and the transitive dependency tree are recorded in `package-lock.json`.

| Component | Version family | License | Purpose |
|---|---|---|---|
| Electron | 44 | MIT, plus bundled Chromium/Node.js notices | Desktop runtime |
| React / React DOM | 18 | MIT | Interface |
| pdfjs-dist | 4.10 | Apache-2.0 | PDF rendering and text extraction |
| pdf-lib | 1 | MIT | Page editing, merging and splitting |
| Tesseract.js | 5 | Apache-2.0 | Local OCR |
| Zustand | 5 | MIT | State management |
| Vite / Tailwind CSS / Vitest | 6 / 3 / 5 | MIT | Development and build tools |

`npm run build` copies available LICENSE/NOTICE/COPYING texts from installed npm runtime packages, their dependencies and Electron into `dist/licenses/`. Packaged applications distribute these texts in `resources/licenses/`. Electron's distribution includes additional Chromium notices; retain those files when redistributing.

OCR also downloads worker/core/language resources from third-party hosts. Tesseract and language-data notices must accompany any future offline redistribution of those resources. Full offline OCR resources are not bundled in this version.

The project itself is MIT licensed; that does not replace third-party license terms. Report missing attributions through a repository issue.
