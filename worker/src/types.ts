// ══════════════════════════════════════════════════════════════
// GainLab API Contract — Wire Format Types
//
// 这是前后端 SSE 通信的 **线上格式** 定义。
// 前端 mcpClient.ts 负责将 wire format 映射为内部类型。
// 修改此文件必须同步检查：gainlab-app/src/services/mcpClient.ts
// ══════════════════════════════════════════════════════════════

// ── SSE 事件（线上格式）──
export type SSEEventType = 'text_delta' | 'tool_call' | 'tool_result' | 'done' | 'error';

export interface SSETextDelta { type: 'text_delta'; text: string; }
export interface SSEToolCall {
  type: 'tool_call';
  tool: { id: string; name: string; arguments: Record<string, unknown> };
  // ⚠️ 前端映射为 { toolCall: { id, name, args } }（arguments → args）
}
export interface SSEToolResult {
  type: 'tool_result';
  result: unknown;
  widgetState?: WidgetState;
}
export interface SSEDone { type: 'done'; }
export interface SSEError {
  type: 'error';
  message: string;
  // ⚠️ 前端映射为 { error: message }（message → error）
}
export type SSEEvent = SSETextDelta | SSEToolCall | SSEToolResult | SSEDone | SSEError;

// ── WidgetState 基础类型 ──
export interface WidgetState {
  type: string;
  [key: string]: unknown;
}

// ── 端点响应类型 ──
export interface KlineBar {
  timestamp: number; open: number; high: number;
  low: number; close: number; volume: number;
}

export interface QuoteResponse {
  symbol?: string; price: number; change: number;
  changePercent: number; volume?: number;
}

export interface SearchResult {
  symbol: string; name: string; exchange?: string;
}

// ── MarketType ──
// Worker 实际支持 4 种，前端定义了 10 种（含预留的 hk/eu/uk/jp/fx/comm）
// Worker 对不支持的 market 返回 400 UNSUPPORTED_MARKET
export type WorkerMarketType = 'crypto' | 'us' | 'cn' | 'metal';
