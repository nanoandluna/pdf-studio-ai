// ============================================================
// Domain Model — PDF Studio AI
// 所有业务层共享的领域类型，不依赖任何具体 PDF Engine
// ============================================================

/** PDF 文档（打开后） */
export interface PdfDocument {
  id: string;
  path: string;
  name: string;
  pageCount: number;
  modified: boolean;
  /** 每页的旋转角度（0/90/180/270），由页面操作命令维护 */
  pageRotations: number[];
  /** 是否有文本层（供搜索/OCR 决策） */
  hasTextLayer: boolean;
  /** 文档级元数据 */
  meta: PdfMeta;
}

export interface PdfMeta {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  fileSize: number;
}

/** 单页（供缩略图/视图使用） */
export interface PdfPage {
  index: number; // 0-based
  label: string; // 1-based 显示标签
  rotation: number; // 0/90/180/270
  width: number;
  height: number;
}

/** 页面范围（1-based，支持 1-5、8、10-12 语法） */
export interface PageRange {
  start: number; // 1-based inclusive
  end: number; // 1-based inclusive
}

/** 标注基类（Overlay 风格，不修改 Content Stream） */
export type AnnotationKind = 'text' | 'highlight' | 'rectangle' | 'arrow' | 'pen';

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  pageIndex: number; // 0-based
  /** 标注坐标，相对于页面尺寸（0-1 归一化），便于跨缩放渲染 */
  // 通用几何
  color: string;
  opacity: number;
  createdAt: number;
  // 按 kind 扩展的字段
  points?: Point[]; // highlight / pen / arrow
  rect?: Rect; // rectangle / highlight
  text?: string; // text
  fontSize?: number; // text
  x?: number; // text
  y?: number; // text
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 当前文档编辑状态（对已打开文档的变更描述） */
export interface DocumentState {
  document: PdfDocument | null;
  /** 页面顺序（当前顺序，初始为 [0..n-1]） */
  pageOrder: number[];
  /** 已删除页（软删除，用于 undo） */
  deletedPages: number[];
  annotations: Annotation[];
}

// ============================================================
// AI 相关领域类型
// ============================================================

export type AIMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AIMessage {
  id: string;
  role: AIMessageRole;
  content: string;
  /** tool call 请求（assistant 发起） */
  toolCalls?: AIToolCall[];
  /** tool call 结果（role=tool 时） */
  toolCallId?: string;
  /** 引用的页码（1-based），用于"来源：Page 3"跳转 */
  citations?: number[];
  /** V0.4：AI 提议的 PDF 操作（等待用户确认后才执行） */
  pendingActions?: AIProposedAction[];
  /** V0.4：已执行的 AI 操作（可撤销） */
  executedActions?: AIProposedAction[];
  /** V0.4：是否来自 Document Intelligence 分析 */
  isInsight?: boolean;
  createdAt: number;
}

/** V0.4：AI 提议的 PDF 操作 —— AI 可以提出修改，但不能悄悄修改 PDF */
export interface AIProposedAction {
  id: string;
  kind: 'delete' | 'rotate' | 'reorder' | 'extract';
  /** 1-based 页码 */
  pages: number[];
  /** 旋转角度（rotate 用） */
  angle?: number;
  /** 新顺序（reorder 用，1-based） */
  newOrder?: number[];
  label: string;
  /** 执行结果（执行后填充） */
  result?: string;
}

/** V0.4：阅读上下文（AI 记住当前阅读位置） */
export interface ReadingContext {
  currentPage: number; // 1-based
  pageCount: number;
  hasSelection: boolean;
  selectedText?: string;
  selectionPage?: number;
  searchQuery?: string;
  searchResultCount?: number;
  searchCurrentPage?: number;
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIToolResult {
  ok: boolean;
  /** 返回给 LLM 的文本/JSON 字符串 */
  output: string;
  /** 附加数据（供 UI 使用，例如页码引用） */
  data?: unknown;
  error?: string;
}

/** OpenAI-compatible Provider 配置 */
export interface AIProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  enabled: boolean;
}

/** AI 聊天消息（OpenAI 协议） */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
}

export interface ChatOptions {
  temperature?: number;
  model?: string;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  toolCalls?: AIToolCall[];
  finishReason?: string;
}

// ============================================================
// 设置 / 最近文件
// ============================================================

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeId = 'obsidian' | 'paper' | 'midnight' | 'aurora';

export interface AppSettings {
  /** 兼容旧设置：light/dark/system */
  theme: ThemeMode;
  /** V0.2 主题 ID（优先于 theme） */
  themeId: ThemeId;
  language: string;
  /** 每次打开 PDF 时是否提示 AI 数据外发 */
  aiDataNotice: boolean;
  /** 侧边栏折叠状态 */
  sidebarCollapsed?: boolean;
}

export interface RecentFileEntry {
  path: string;
  name: string;
  lastOpenedAt: number;
  pageCount?: number;
  /** 文件是否仍然存在 */
  available: boolean;
}

export interface SearchResult {
  pageIndex: number; // 0-based
  pageLabel: number; // 1-based
  matches: { start: number; end: number }[];
  context: string;
}

export interface OcrProgress {
  pageIndex: number;
  pageCount: number;
  status: 'queued' | 'processing' | 'done' | 'error';
  textLength: number;
}

// ============================================================
// V0.2 — Cloud AI Provider 架构
// ============================================================

export type ProviderId = 'openai' | 'deepseek' | 'qwen' | 'ollama' | 'custom';

/** 模型能力 */
export interface AIModel {
  id: string;
  name: string;
  providerId: ProviderId;
  capabilities: {
    streaming: boolean;
    toolCalling: boolean;
    vision: boolean;
  };
  contextWindow?: number;
}

/** Provider 连接状态 */
export type ProviderStatus = 'not-configured' | 'connected' | 'error';

/** 统一的 Chat 请求 */
export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: unknown[];
  stream?: boolean;
  documentContext?: DocumentContext;
}

/** 流式分块 */
export interface ChatChunk {
  /** 累积文本（增量由 delta 提供） */
  delta?: string;
  content?: string;
  toolCalls?: AIToolCall[];
  done?: boolean;
  usage?: AIUsage;
}

export interface ChatResponseV2 {
  content: string;
  toolCalls?: AIToolCall[];
  finishReason?: string;
  usage?: AIUsage;
}

export interface ConnectionResult {
  ok: boolean;
  message: string;
  latencyMs?: number;
}

/** AI 用量（预留，V0.2 不要求完整账单） */
export interface AIUsage {
  provider: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
}

/** 文档上下文（AI 读取当前 PDF 的抽象） */
export interface DocumentContext {
  documentId: string;
  fileName: string;
  currentPage?: number;
  selectedPages?: number[];
  relevantPages?: number[];
  extractedText?: string;
  selectedText?: string;
}

/** AI 上下文选择范围 */
export type AIContextScope = 'document' | 'current-page' | 'selected-pages' | 'selected-text';

/** AI Provider 统一接口 */
export interface AIProviderV2 {
  id: ProviderId;
  name: string;
  /** 获取可用模型列表 */
  getModels(config: AIProviderConfig): Promise<AIModel[]>;
  /** 非流式对话 */
  chat(request: ChatRequest, config: AIProviderConfig): Promise<ChatResponseV2>;
  /** 流式对话（逐 token） */
  streamChat(request: ChatRequest, config: AIProviderConfig): AsyncIterable<ChatChunk>;
  testConnection(config: AIProviderConfig): Promise<ConnectionResult>;
}
