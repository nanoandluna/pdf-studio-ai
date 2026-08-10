/// <reference types="vite/client" />

// 允许导入 .mjs?url 等静态资源 URL（pdf.js worker）
declare module '*?url' {
  const src: string;
  export default src;
}
