// ============================================================
// 统一 Logger — 不打印 API Key / PDF 敏感内容
// ============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  private level: LogLevel = 'info';

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
  }

  private format(level: LogLevel, msg: string, meta?: unknown): string {
    const ts = new Date().toISOString();
    const metaStr = meta === undefined ? '' : ` ${JSON.stringify(sanitize(meta))}`;
    return `[${ts}] [${level.toUpperCase()}] ${msg}${metaStr}`;
  }

  debug(msg: string, meta?: unknown): void {
    if (this.shouldLog('debug')) console.debug(this.format('debug', msg, meta));
  }

  info(msg: string, meta?: unknown): void {
    if (this.shouldLog('info')) console.info(this.format('info', msg, meta));
  }

  warn(msg: string, meta?: unknown): void {
    if (this.shouldLog('warn')) console.warn(this.format('warn', msg, meta));
  }

  error(msg: string, meta?: unknown): void {
    if (this.shouldLog('error')) console.error(this.format('error', msg, meta));
  }
}

/** 递归清洗敏感字段（apiKey / key / token / secret / password / authorization） */
function sanitize(obj: unknown, depth = 0): unknown {
  if (depth > 4) return '[MaxDepth]';
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const lk = k.toLowerCase();
    if (/(api_?key|secret|token|password|authorization|credential)/.test(lk)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitize(v, depth + 1);
    }
  }
  return out;
}

export const logger = new Logger();
