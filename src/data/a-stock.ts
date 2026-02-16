import { proxyFetch } from "../utils/fetch.js";
import { OHLCV, FundamentalData } from "./types.js";

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

function getLimitDateRange(limit: number): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0];
  const daysBack = Math.ceil(limit * 1.2);
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().split("T")[0];
  return { from: fromStr, to };
}

/**
 * Normalize A-stock symbol to EODHD format
 * @param symbol - Raw symbol (e.g., "600519" or "600519.SHG")
 * @returns EODHD format symbol (e.g., "600519.SHG")
 */
function normalizeSymbol(symbol: string): string {
  // Already has exchange suffix
  if (symbol.includes(".")) {
    return symbol;
  }
  
  // Bare 6-digit code: codes starting with 6 → .SHG (Shanghai), others → .SHE (Shenzhen)
  if (symbol.startsWith("6")) {
    return `${symbol}.SHG`;
  } else {
    return `${symbol}.SHE`;
  }
}

export async function getAStockKlines(
  symbol: string,
  limit: number = 100
): Promise<OHLCV[]> {
  const apiKey = getApiKey();
  const { from, to } = getLimitDateRange(limit);
  const eodhSymbol = normalizeSymbol(symbol);
  
  const url = `${EODHD_BASE_URL}/eod/${eodhSymbol}?api_token=${apiKey}&fmt=json&from=${from}&to=${to}`;
  const response = await proxyFetch(url);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EODHD API error (${response.status}): ${text}`);
  }
  
  const data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("EODHD API returned unexpected format (expected array)");
  }
  
  const ohlcv: OHLCV[] = data
    .map((item: any) => ({
      timestamp: new Date(item.date + "T00:00:00Z").getTime(),
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    }))
    .sort((a: OHLCV, b: OHLCV) => a.timestamp - b.timestamp)
    .slice(-limit);
  
  return ohlcv;
}

export async function getAStockFundamentals(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit: number = 5
): Promise<FundamentalData[]> {
  const apiKey = getApiKey();
  const eodhSymbol = normalizeSymbol(symbol);
  
  const url = `${EODHD_BASE_URL}/fundamentals/${eodhSymbol}?api_token=${apiKey}&fmt=json`;
  const response = await proxyFetch(url);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`EODHD API error (${response.status}): ${text}`);
  }
  
  const data = await response.json();
  
  // Extract financials from the response
  const financials = data?.Financials;
  if (!financials) {
    throw new Error("No Financials section found in EODHD response");
  }
  
  const incomeStatement = period === "annual" 
    ? financials.Income_Statement?.yearly 
    : financials.Income_Statement?.quarterly;
  
  if (!incomeStatement) {
    throw new Error(`No ${period} Income_Statement data found`);
  }
  
  // Convert EODHD format to FundamentalData[]
  // incomeStatement is an object with dates as keys: { "2024-12-31": {...}, "2023-12-31": {...} }
  const entries = Object.entries(incomeStatement)
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA)) // Sort descending by date
    .slice(0, limit);
  
  const fundamentalData: FundamentalData[] = entries.map(([date, metrics]: [string, any]) => {
    // Format period string
    const year = date.split("-")[0];
    let periodStr: string;
    
    if (period === "quarter") {
      // Extract quarter from date (e.g., "2024-03-31" → "2024-Q1")
      const month = parseInt(date.split("-")[1]);
      const quarter = Math.ceil(month / 3);
      periodStr = `${year}-Q${quarter}`;
    } else {
      periodStr = year;
    }
    
    // Extract key metrics
    const metricsRecord: Record<string, number | null> = {
      totalRevenue: metrics.totalRevenue ?? null,
      grossProfit: metrics.grossProfit ?? null,
      operatingIncome: metrics.operatingIncome ?? null,
      netIncome: metrics.netIncome ?? null,
      ebitda: metrics.ebitda ?? null,
      eps: metrics.eps ?? null,
    };
    
    return {
      period: periodStr,
      metrics: metricsRecord,
    };
  });
  
  return fundamentalData;
}
