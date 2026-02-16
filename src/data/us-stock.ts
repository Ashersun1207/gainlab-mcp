import { proxyFetch } from "../utils/fetch.js";
import { OHLCV, FundamentalData } from "./types.js";

const FMP_BASE_URL = "https://financialmodelingprep.com";

function getApiKey(): string {
  const key = process.env.FMP_API_KEY;
  if (!key) {
    throw new Error(
      "FMP_API_KEY not found. Please set it in ~/.openclaw/.env"
    );
  }
  return key;
}

/**
 * Convert limit to a date range for FMP API
 * Assumes ~252 trading days per year
 */
function getLimitDateRange(limit: number): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().split("T")[0]; // YYYY-MM-DD
  
  // Rough estimate: add 40% buffer for weekends/holidays
  const daysBack = Math.ceil(limit * 1.4);
  const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const fromStr = from.toISOString().split("T")[0];
  
  return { from: fromStr, to };
}

interface FMPHistoricalPrice {
  date: string; // "2026-02-14"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change?: number;
  changePercent?: number;
  vwap?: number;
}

/**
 * Get US stock kline data from FMP
 * @param symbol Stock symbol (e.g., "AAPL")
 * @param limit Number of data points to return
 * @returns Array of OHLCV data
 */
export async function getUSStockKlines(
  symbol: string,
  limit: number = 100
): Promise<OHLCV[]> {
  const apiKey = getApiKey();
  const { from, to } = getLimitDateRange(limit);
  
  const url = `${FMP_BASE_URL}/stable/historical-price-eod/full?symbol=${symbol}&from=${from}&to=${to}&apikey=${apiKey}`;
  
  const response = await proxyFetch(url);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `FMP API error (${response.status}): ${text}`
    );
  }
  
  const data: FMPHistoricalPrice[] = await response.json();
  
  if (!Array.isArray(data)) {
    throw new Error("FMP API returned unexpected format (expected array)");
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

interface FMPIncomeStatement {
  date: string; // "2025-12-31"
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string; // "FY"
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  grossProfitRatio: number;
  researchAndDevelopmentExpenses: number;
  generalAndAdministrativeExpenses: number;
  sellingAndMarketingExpenses: number;
  sellingGeneralAndAdministrativeExpenses: number;
  otherExpenses: number;
  operatingExpenses: number;
  costAndExpenses: number;
  interestIncome: number;
  interestExpense: number;
  depreciationAndAmortization: number;
  ebitda: number;
  ebitdaratio: number;
  operatingIncome: number;
  operatingIncomeRatio: number;
  totalOtherIncomeExpensesNet: number;
  incomeBeforeTax: number;
  incomeBeforeTaxRatio: number;
  incomeTaxExpense: number;
  netIncome: number;
  netIncomeRatio: number;
  eps: number;
  epsdiluted: number;
  weightedAverageShsOut: number;
  weightedAverageShsOutDil: number;
  link: string;
  finalLink: string;
}

/**
 * Get US stock fundamental data from FMP
 * @param symbol Stock symbol (e.g., "AAPL")
 * @param period "annual" or "quarter"
 * @param limit Number of periods to return (default: 5)
 * @returns Array of FundamentalData
 */
export async function getUSStockFundamentals(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit: number = 5
): Promise<FundamentalData[]> {
  const apiKey = getApiKey();
  const url = `${FMP_BASE_URL}/stable/income-statement?symbol=${symbol}&period=${period}&limit=${limit}&apikey=${apiKey}`;
  
  const response = await proxyFetch(url);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `FMP API error (${response.status}): ${text}`
    );
  }
  
  const data: FMPIncomeStatement[] = await response.json();
  
  if (!Array.isArray(data)) {
    throw new Error("FMP API returned unexpected format (expected array)");
  }
  
  // Convert to FundamentalData format
  const fundamentals: FundamentalData[] = data.map((item) => {
    // Extract year from date field (YYYY-MM-DD format)
    const year = item.date.split("-")[0];
    
    // For quarterly reports, period field is like "FY" or "Q1", "Q2", etc.
    // We need to parse it correctly
    let periodStr: string;
    if (period === "annual") {
      periodStr = year;
    } else {
      // Extract quarter number from period field (e.g., "Q1" -> "1")
      const quarterMatch = item.period.match(/Q?(\d)/);
      const quarter = quarterMatch ? quarterMatch[1] : "1";
      periodStr = `${year}-Q${quarter}`;
    }
    
    return {
      period: periodStr,
      metrics: {
        revenue: item.revenue,
        costOfRevenue: item.costOfRevenue,
        grossProfit: item.grossProfit,
        grossProfitRatio: item.grossProfitRatio,
        researchAndDevelopmentExpenses: item.researchAndDevelopmentExpenses,
        operatingExpenses: item.operatingExpenses,
        operatingIncome: item.operatingIncome,
        operatingIncomeRatio: item.operatingIncomeRatio,
        ebitda: item.ebitda,
        ebitdaRatio: item.ebitdaratio,
        netIncome: item.netIncome,
        netIncomeRatio: item.netIncomeRatio,
        eps: item.eps,
        epsDiluted: item.epsdiluted,
        weightedAverageShares: item.weightedAverageShsOut,
        weightedAverageSharesDiluted: item.weightedAverageShsOutDil,
      },
    };
  });
  
  return fundamentals;
}
