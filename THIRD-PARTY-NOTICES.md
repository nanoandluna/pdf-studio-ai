# Third-Party Notices

PDF Studio AI 基于以下第三方组件构建。此处列出发行版中**静态打包**的主要组件及其许可证。完整依赖树请见 `package-lock.json`。

## 运行时组件

| 组件 | 版本 | 许可证 | 用途 |
|---|---|---|---|
| Electron | 33.x | MIT | 桌面运行时（Chromium + Node.js） |
| React | 18.x | MIT | UI 框架 |
| pdf.js（pdfjs-dist） | 4.10.x | Apache-2.0 | PDF 渲染 / 文本提取 / 搜索 |
| pdf-lib | 1.x | MIT | PDF 编辑 / 合并 / 拆分 / 保存 |
| Tesseract.js | 5.x | Apache-2.0 | OCR（WASM，中文/英文） |
| Zustand | 4.x/5.x | MIT | 状态管理 |
| Vite | 6.x | MIT | 构建工具（开发期） |
| Tailwind CSS | 3.x | MIT | 样式（开发期） |
| Vitest | 2.x | MIT | 测试（开发期） |

> Electron 发行版内嵌 Chromium / Node.js / V8，遵循其各自许可（BSD-3-Clause / MIT / BSD-3-Clause）。

## 许可证文本

### MIT License（Electron / React / pdf-lib / Zustand 等）

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### Apache License 2.0（pdf.js / Tesseract.js）

Apache-2.0 全文较长，请见 <https://www.apache.org/licenses/LICENSE-2.0>。

> 简要说明（非替代许可证全文）：Apache License 2.0 允许自由使用、修改、分发，要求保留版权声明并注明修改。分发的衍生作品必须附带相同的 Apache-2.0 许可证声明。

---

*本文件随软件发行版一起分发。若你发现任何遗漏的第三方组件，请提交 issue。*
