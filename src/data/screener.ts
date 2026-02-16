/**
 * Batch data fetching for heatmaps.
 * - US stocks: EODHD Screener API
 * - Crypto: Binance 24hr ticker
 */

import { proxyFetch } from "../utils/fetch.js";
import {
  getCryptoClassification,
  isExcludedToken,
  extractBaseSymbol,
} from "../utils/crypto-sectors.js";

const EODHD_BASE_URL = "https://eodhd.com/api";
const BINANCE_BASE = "https://api.binance.com";

function getEodhdApiKey(): string {
  const key = process.env.EODHD_API_KEY;
  if (!key) {
    throw new Error("EODHD_API_KEY not found. Please set it in ~/.openclaw/.env");
  }
  return key;
}

// --- Types ---

export interface ScreenerItem {
  code: string;          // ticker symbol
  name: string;          // company / token name
  price: number;         // latest close price
  change1d: number;      // 1-day change %
  change5d: number;      // 5-day change %
  marketCap: number;     // market capitalization (USD)
  volume: number;        // recent volume
  sector: string;
  industry: string;
}

// --- EODHD Screener (US stocks) ---

interface EodhdScreenerParams {
  exchange?: string;      // "us" for US stocks
  sector?: string;        // e.g., "Technology"
  minMarketCap?: number;  // minimum market cap in USD
  limit?: number;         // max results (default 50)
}

export async function getUSStockScreener(params: EodhdScreenerParams = {}): Promise<ScreenerItem[]> {
  const apiKey = getEodhdApiKey();
  const { exchange = "us", sector, minMarketCap = 1_000_000_000, limit = 50 } = params;

  // Build filters array: [["field", "operator", value], ...]
  const filters: any[][] = [
    ["market_capitalization", ">", minMarketCap],
    ["exchange", "=", exchange],
  ];
  if (sector) {
    filters.push(["sector", "=", sector]);
  }

  const filtersEncoded = encodeURIComponent(JSON.stringify(filters));
  const url = `${EODHD_BASE_URL}/screener?sort=market_capitalization.desc&filters=${filtersEncoded}&limit=${limit}&api_token=${apiKey}&fmt=json`;

  const response = await proxyFetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EODHD Screener API error (${response.status}): ${text}`);
  }

  const json = await response.json() as any;
  const data = json?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((item: any) => ({
    code: item.code || "",
    name: item.name || "",
    price: item.adjusted_close ?? 0,
    change1d: item.refund_1d_p ?? 0,
    change5d: item.refund_5d_p ?? 0,
    marketCap: item.market_capitalization ?? 0,
    volume: item.avgvol_1d ?? 0,
    sector: item.sector || "Other",
    industry: item.industry || "Other",
  }));
}

// --- Binance 24hr Ticker (crypto) ---

interface CryptoScreenerParams {
  minVolume?: number;     // minimum 24h USDT volume (default 1M)
  limit?: number;         // max results (default 50)
  sector?: string;        // filter by crypto sector (e.g., "DeFi")
}

export async function getCryptoScreener(params: CryptoScreenerParams = {}): Promise<ScreenerItem[]> {
  const { minVolume = 1_000_000, limit = 50, sector } = params;

  const url = `${BINANCE_BASE}/api/v3/ticker/24hr`;
  const response = await proxyFetch(url);
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any[];

  // Filter: USDT pairs only, exclude stablecoins/wrapped tokens
  let items: ScreenerItem[] = data
    .filter((t: any) => {
      if (!t.symbol?.endsWith("USDT")) return false;
      const base = extractBaseSymbol(t.symbol);
      if (isExcludedToken(base)) return false;
      const vol = parseFloat(t.quoteVolume || "0");
      if (vol < minVolume) return false;
      return true;
    })
    .map((t: any) => {
      const base = extractBaseSymbol(t.symbol);
      const classification = getCryptoClassification(base);
      const quoteVolume = parseFloat(t.quoteVolume || "0");
      return {
        code: base,
        name: base,      // Binance doesn't provide full names
        price: parseFloat(t.lastPrice || "0"),
        change1d: parseFloat(t.priceChangePercent || "0"),
        change5d: 0,     // Binance 24hr doesn't have 5d data
        marketCap: quoteVolume,  // Use 24h volume as proxy for "size" in treemap
        volume: quoteVolume,
        sector: classification.sector,
        industry: classification.industry,
      };
    })
    // Sort by volume (proxy for market cap) descending
    .sort((a, b) => b.marketCap - a.marketCap);

  // Filter by sector if specified
  if (sector) {
    items = items.filter(item => item.sector.toLowerCase() === sector.toLowerCase());
  }

  return items.slice(0, limit);
}
