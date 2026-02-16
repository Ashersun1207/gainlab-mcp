export interface OHLCV {
  timestamp: number;  // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FundamentalData {
  period: string;       // "2025-Q4" | "2025"
  metrics: Record<string, number | null>;
}

export interface DCFData {
  symbol: string;
  date: string;
  dcf: number;
  stockPrice: number;
}

export interface CalendarEvent {
  date: string;         // "2026-02-15"
  type: string;
  title: string;
  market: string;
  symbol?: string;
  importance?: "low" | "medium" | "high";
}

export type Market = "crypto" | "us_stock" | "a_stock" | "commodity";

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d" | "1w" | "1M";
