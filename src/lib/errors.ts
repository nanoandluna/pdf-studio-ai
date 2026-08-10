// ============================================================
// 友好错误 — 所有用户可见错误信息必须友好
// ============================================================

export class FriendlyError extends Error {
  /** 用户可见的友好消息 */
  friendly: string;
  /** 内部诊断（只记日志，不展示） */
  detail?: string;

  constructor(friendly: string, detail?: string) {
    super(friendly);
    this.name = 'FriendlyError';
    this.friendly = friendly;
    this.detail = detail;
  }
}

/** 将任意异常转换为友好错误 */
export function toFriendlyError(err: unknown, fallback: string): FriendlyError {
  if (err instanceof FriendlyError) return err;
  const detail = err instanceof Error ? err.message : String(err);
  return new FriendlyError(fallback, detail);
}

/** 根据文件操作错误生成友好消息 */
export function fileErrorFriendly(err: unknown, action: string): FriendlyError {
  const detail = err instanceof Error ? err.message : String(err);
  if (/ENOENT|no such file/i.test(detail)) {
    return new FriendlyError(`无法${action}：文件可能已经被移动或删除。`, detail);
  }
  if (/EACCES|EPERM|permission/i.test(detail)) {
    return new FriendlyError(`无法${action}：没有访问权限，请检查文件是否被占用。`, detail);
  }
  return toFriendlyError(err, `无法${action}，请稍后重试。`);
}
