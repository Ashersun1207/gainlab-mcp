import { proxyFetch } from "../utils/fetch.js";
import { OHLCV } from "./types.js";

const EODHD_BASE_URL = "https://eodhd.com/api";

function getApiKey(): string {
  const key = process.env.EODHD_API_KEY;
  if (!key) {
    throw new Error(
      "EODHD_API_KEY not found. Please set it in ~/.openclaw/.env"
    );
  }
  return key;
}

/**
 * Convert limit to a date range for EODHD API
 * Commodities trade 24/5, so use calendar days with a smaller buffer
 */
function getLimitDateRange(limit: number): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0]; // YYYY-MM-DD
  
  // Add 20% buffer for weekends
  const daysBack = Math.ceil(limit * 1.2);
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().split("T")[0];
  
  return { from: fromStr, to };
}

interface EODHDEodData {
  date: string; // "2026-02-14"
  open: number;
  high: number;
  low: number;
  close: number;
  adjusted_close: number;
  volume: number;
}

/**
 * Get commodity kline data from EODHD
 * @param symbol Commodity symbol (e.g., "XAUUSD" for gold, "XAGUSD" for silver)
 * @param limit Number of data points to return
 * @returns Array of OHLCV data
 */
export async function getCommodityKlines(
  symbol: string,
  limit: number = 100
): Promise<OHLCV[]> {
  const apiKey = getApiKey();
  const { from, to } = getLimitDateRange(limit);
  
  // EODHD commodity symbols (gold/silver) use .FOREX suffix
  const eodhSymbol = symbol.includes(".") ? symbol : `${symbol}.FOREX`;
  
  const url = `${EODHD_BASE_URL}/eod/${eodhSymbol}?api_token=${apiKey}&fmt=json&from=${from}&to=${to}`;
  
  const response = await proxyFetch(url);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `EODHD API error (${response.status}): ${text}`
    );
  }
  
  const data: EODHDEodData[] = await response.json();
  
  if (!Array.isArray(data)) {
    throw new Error("EODHD API returned unexpected format (expected array)");
  }
  
  // Convert to OHLCV format and sort by date ascending
  const ohlcv: OHLCV[] = data
    .map((item) => ({
      timestamp: new Date(item.date + "T00:00:00Z").getTime(),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit); // Take the most recent 'limit' items
  
  return ohlcv;
}
