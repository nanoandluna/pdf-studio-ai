// ============================================================
// aiAbort — AI 请求轮次控制（轻量取消机制）
// 开源前健壮性加固（#8）：发送新请求或关闭文档时，旧请求的
// 流式写入必须停止（避免对已销毁 doc 继续 extractText / 写脏数据）。
// 用递增序号判断"是否还是当前轮"，不依赖 Provider 的 abort 支持。
// ============================================================

let seq = 0;

/** 开始一轮新请求，返回本轮的序号 */
export function beginAiRequest(): number {
  return ++seq;
}

/** 当前有效轮次序号 */
export function currentAiRequestSeq(): number {
  return seq;
}

/** 取消所有在途 AI 请求（序号 +1，旧轮次全部失效） */
export function cancelAiRequests(): void {
  seq++;
}
