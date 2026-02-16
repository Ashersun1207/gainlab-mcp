import { proxyFetch } from "../utils/fetch.js";
import { OHLCV, FundamentalData, DCFData } from "./types.js";

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

interface FMPCashFlowStatement {
  date: string;
  symbol: string;
  reportedCurrency: string;
  cik: string;
  fillingDate: string;
  acceptedDate: string;
  calendarYear: string;
  period: string;
  netCashProvidedByOperatingActivities?: number;
  operatingCashFlow?: number;
  freeCashFlow?: number;
  capitalExpenditure?: number;
  netIncome?: number;
  stockBasedCompensation?: number;
  commonDividendsPaid?: number;
  commonStockRepurchased?: number;
}

/**
 * Get US stock cash flow data from FMP
 * @param symbol Stock symbol (e.g., "AAPL")
 * @param period "annual" or "quarter"
 * @param limit Number of periods to return (default: 5)
 * @returns Array of FundamentalData
 */
export async function getUSStockCashFlow(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit: number = 5
): Promise<FundamentalData[]> {
  const apiKey = getApiKey();
  const url = `${FMP_BASE_URL}/stable/cash-flow-statement?symbol=${symbol}&period=${period}&limit=${limit}&apikey=${apiKey}`;
  
  const response = await proxyFetch(url);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `FMP API error (${response.status}): ${text}`
    );
  }
  
  const data: FMPCashFlowStatement[] = await response.json();
  
  if (!Array.isArray(data)) {
    throw new Error("FMP API returned unexpected format (expected array)");
  }
  
  const cashFlowData: FundamentalData[] = data.map((item) => {
    const year = item.date.split("-")[0];
    
    let periodStr: string;
    if (period === "annual") {
      periodStr = year;
    } else {
      const quarterMatch = item.period.match(/Q?(\d)/);
      const quarter = quarterMatch ? quarterMatch[1] : "1";
      periodStr = `${year}-Q${quarter}`;
    }
    
    return {
      period: periodStr,
      metrics: {
        operatingCashFlow: item.netCashProvidedByOperatingActivities ?? item.operatingCashFlow ?? null,
        freeCashFlow: item.freeCashFlow ?? null,
        capitalExpenditure: item.capitalExpenditure ? Math.abs(item.capitalExpenditure) : null,
        netIncome: item.netIncome ?? null,
        stockBasedCompensation: item.stockBasedCompensation ?? null,
        dividendsPaid: item.commonDividendsPaid ? Math.abs(item.commonDividendsPaid) : null,
        shareRepurchase: item.commonStockRepurchased ? Math.abs(item.commonStockRepurchased) : null,
      },
    };
  });
  
  return cashFlowData;
}

interface FMPKeyMetrics {
  date: string;
  symbol: string;
  period: string;
  marketCap?: number;
  enterpriseValue?: number;
  evToEBITDA?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  currentRatio?: number;
  netDebtToEBITDA?: number;
  earningsYield?: number;
  freeCashFlowYield?: number;
  dividendYield?: number;
}

interface FMPRatios {
  date: string;
  symbol: string;
  period: string;
  priceToEarningsRatio?: number;
  priceToBookRatio?: number;
  priceToSalesRatio?: number;
  priceToFreeCashFlowRatio?: number;
  grossProfitMargin?: number;
  netProfitMargin?: number;
  operatingProfitMargin?: number;
  debtToEquityRatio?: number;
  interestCoverageRatio?: number;
}

/**
 * Get US stock key metrics from FMP
 * @param symbol Stock symbol (e.g., "AAPL")
 * @param period "annual" or "quarter"
 * @param limit Number of periods to return (default: 5)
 * @returns Array of FundamentalData
 */
export async function getUSStockKeyMetrics(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit: number = 5
): Promise<FundamentalData[]> {
  const apiKey = getApiKey();
  
  // Fetch key metrics
  const metricsUrl = `${FMP_BASE_URL}/stable/key-metrics?symbol=${symbol}&period=${period}&limit=${limit}&apikey=${apiKey}`;
  const metricsResponse = await proxyFetch(metricsUrl);
  
  if (!metricsResponse.ok) {
    const text = await metricsResponse.text();
    throw new Error(
      `FMP API error (${metricsResponse.status}): ${text}`
    );
  }
  
  const metricsData: FMPKeyMetrics[] = await metricsResponse.json();
  
  if (!Array.isArray(metricsData)) {
    throw new Error("FMP API returned unexpected format (expected array)");
  }
  
  // Fetch ratios
  const ratiosUrl = `${FMP_BASE_URL}/stable/ratios?symbol=${symbol}&period=${period}&limit=${limit}&apikey=${apiKey}`;
  const ratiosResponse = await proxyFetch(ratiosUrl);
  
  if (!ratiosResponse.ok) {
    const text = await ratiosResponse.text();
    throw new Error(
      `FMP API error (${ratiosResponse.status}): ${text}`
    );
  }
  
  const ratiosData: FMPRatios[] = await ratiosResponse.json();
  
  if (!Array.isArray(ratiosData)) {
    throw new Error("FMP API returned unexpected format (expected array)");
  }
  
  // Merge metrics and ratios by date
  const keyMetricsData: FundamentalData[] = metricsData.map((item) => {
    const year = item.date.split("-")[0];
    
    let periodStr: string;
    if (period === "annual") {
      periodStr = year;
    } else {
      const quarterMatch = item.period.match(/Q?(\d)/);
      const quarter = quarterMatch ? quarterMatch[1] : "1";
      periodStr = `${year}-Q${quarter}`;
    }
    
    // Find matching ratios data by date
    const matchingRatio = ratiosData.find(r => r.date === item.date);
    
    return {
      period: periodStr,
      metrics: {
        marketCap: item.marketCap ?? null,
        enterpriseValue: item.enterpriseValue ?? null,
        evToEbitda: item.evToEBITDA ?? null,
        returnOnEquity: item.returnOnEquity ?? null,
        returnOnAssets: item.returnOnAssets ?? null,
        currentRatio: item.currentRatio ?? null,
        debtToEbitda: item.netDebtToEBITDA ?? null,
        earningsYield: item.earningsYield ?? null,
        freeCashFlowYield: item.freeCashFlowYield ?? null,
        dividendYield: item.dividendYield ?? null,
        peRatio: matchingRatio?.priceToEarningsRatio ?? null,
        pbRatio: matchingRatio?.priceToBookRatio ?? null,
        psRatio: matchingRatio?.priceToSalesRatio ?? null,
        priceToFreeCashFlow: matchingRatio?.priceToFreeCashFlowRatio ?? null,
        grossProfitMargin: matchingRatio?.grossProfitMargin ?? null,
        netProfitMargin: matchingRatio?.netProfitMargin ?? null,
        operatingProfitMargin: matchingRatio?.operatingProfitMargin ?? null,
        debtToEquity: matchingRatio?.debtToEquityRatio ?? null,
        interestCoverage: matchingRatio?.interestCoverageRatio ?? null,
      },
    };
  });
  
  return keyMetricsData;
}

interface FMPDCFResponse {
  symbol: string;
  date: string;
  dcf: number;
  "Stock Price": number;
}

/**
 * Get US stock DCF (Discounted Cash Flow) valuation from FMP
 * @param symbol Stock symbol (e.g., "AAPL")
 * @returns DCFData
 */
export async function getUSStockDCF(symbol: string): Promise<DCFData> {
  const apiKey = getApiKey();
  const url = `${FMP_BASE_URL}/stable/discounted-cash-flow?symbol=${symbol}&apikey=${apiKey}`;
  
  const response = await proxyFetch(url);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `FMP API error (${response.status}): ${text}`
    );
  }
  
  const data: FMPDCFResponse[] = await response.json();
  
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("FMP API returned unexpected format (expected non-empty array)");
  }
  
  const dcfItem = data[0];
  
  return {
    symbol: dcfItem.symbol,
    date: dcfItem.date,
    dcf: dcfItem.dcf,
    stockPrice: dcfItem["Stock Price"],
  };
}

interface FMPAnalystEstimates {
  date: string;
  symbol: string;
  estimatedRevenueAvg?: number;
  estimatedRevenueLow?: number;
  estimatedRevenueHigh?: number;
  estimatedEpsAvg?: number;
  estimatedEpsLow?: number;
  estimatedEpsHigh?: number;
  estimatedEbitdaAvg?: number;
  estimatedNetIncomeAvg?: number;
  numberAnalystEstimatedRevenue?: number;
  numberAnalystsEstimatedEps?: number;
}

/**
 * Get US stock analyst estimates from FMP
 * @param symbol Stock symbol (e.g., "AAPL")
 * @param period "annual" or "quarter"
 * @param limit Number of periods to return (default: 3)
 * @returns Array of FundamentalData
 */
export async function getUSStockAnalystEstimates(
  symbol: string,
  period: "annual" | "quarter" = "annual",
  limit: number = 3
): Promise<FundamentalData[]> {
  const apiKey = getApiKey();
  const url = `${FMP_BASE_URL}/stable/analyst-estimates?symbol=${symbol}&period=${period}&limit=${limit}&apikey=${apiKey}`;
  
  const response = await proxyFetch(url);
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `FMP API error (${response.status}): ${text}`
    );
  }
  
  const data: FMPAnalystEstimates[] = await response.json();
  
  if (!Array.isArray(data)) {
    throw new Error("FMP API returned unexpected format (expected array)");
  }
  
  const estimatesData: FundamentalData[] = data.map((item) => {
    const year = item.date.split("-")[0];
    
    let periodStr: string;
    if (period === "annual") {
      periodStr = year;
    } else {
      // For analyst estimates, the date format might be different
      // Try to extract quarter from date (e.g., "2024-03-31" → Q1)
      const month = parseInt(item.date.split("-")[1]);
      const quarter = Math.ceil(month / 3);
      periodStr = `${year}-Q${quarter}`;
    }
    
    return {
      period: periodStr,
      metrics: {
        revenueAvg: item.estimatedRevenueAvg ?? null,
        revenueLow: item.estimatedRevenueLow ?? null,
        revenueHigh: item.estimatedRevenueHigh ?? null,
        epsAvg: item.estimatedEpsAvg ?? null,
        epsLow: item.estimatedEpsLow ?? null,
        epsHigh: item.estimatedEpsHigh ?? null,
        ebitdaAvg: item.estimatedEbitdaAvg ?? null,
        netIncomeAvg: item.estimatedNetIncomeAvg ?? null,
        numAnalystsRevenue: item.numberAnalystEstimatedRevenue ?? null,
        numAnalystsEps: item.numberAnalystsEstimatedEps ?? null,
      },
    };
  });
  
  return estimatesData;
}
