import { OHLCV, Timeframe } from "./types.js";
import { proxyFetch } from "../utils/fetch.js";

const BINANCE_BASE = "https://api.binance.com";

const TIMEFRAME_MAP: Record<string, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m",
  "1h": "1h", "4h": "4h", "1d": "1d",
  "1w": "1w", "1M": "1M",
};

export async function getCryptoKlines(
  symbol: string,
  timeframe: Timeframe,
  limit: number = 100
): Promise<OHLCV[]> {
  const interval = TIMEFRAME_MAP[timeframe] || "1d";
  const url = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;

  const response = await proxyFetch(url);
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any[];
  
  return data.map((k: any) => ({
    timestamp: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

export async function getCryptoFundingRate(
  symbol: string,
  limit: number = 100
): Promise<{ timestamp: number; fundingRate: number; }[]> {
  const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol.toUpperCase()}&limit=${limit}`;
  
  const response = await proxyFetch(url);
  if (!response.ok) {
    throw new Error(`Binance Futures API error: ${response.status}`);
  }

  const data = await response.json() as any[];
  return data.map((d: any) => ({
    timestamp: d.fundingTime,
    fundingRate: parseFloat(d.fundingRate),
  }));
}
