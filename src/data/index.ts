import { OHLCV, FundamentalData, DCFData, Market, Timeframe } from "./types.js";
import { getCryptoKlines } from "./crypto.js";
import { 
  getUSStockKlines, 
  getUSStockFundamentals,
  getUSStockCashFlow,
  getUSStockKeyMetrics,
  getUSStockDCF,
  getUSStockAnalystEstimates
} from "./us-stock.js";
import { 
  getAStockKlines, 
  getAStockFundamentals,
  getAStockCashFlow,
  getAStockKeyMetrics
} from "./a-stock.js";
import { getCommodityKlines } from "./commodity.js";

export async function getKlines(
  symbol: string,
  market: Market,
  timeframe: Timeframe,
  limit: number = 100
): Promise<OHLCV[]> {
  switch (market) {
    case "crypto":
      return getCryptoKlines(symbol, timeframe, limit);
    case "us_stock":
      // US stocks only support daily data (FMP limitation on Starter plan)
      if (timeframe !== "1d") {
        throw new Error(
          `US stock data only supports daily timeframe (1d), got: ${timeframe}`
        );
      }
      return getUSStockKlines(symbol, limit);
    case "a_stock":
      // A-stocks only support daily data (EODHD EOD endpoint)
      if (timeframe !== "1d") {
        throw new Error(
          `A-stock data only supports daily timeframe (1d), got: ${timeframe}`
        );
      }
      return getAStockKlines(symbol, limit);
    case "commodity":
      // Commodities only support daily data (EODHD EOD endpoint)
      if (timeframe !== "1d") {
        throw new Error(
          `Commodity data only supports daily timeframe (1d), got: ${timeframe}`
        );
      }
      return getCommodityKlines(symbol, limit);
    default:
      throw new Error(`Unknown market: ${market}`);
  }
}

export async function getFundamentals(
  symbol: string,
  market: Market,
  period: "annual" | "quarter" = "annual",
  limit: number = 5
): Promise<FundamentalData[]> {
  switch (market) {
    case "us_stock":
      return getUSStockFundamentals(symbol, period, limit);
    case "a_stock":
      return getAStockFundamentals(symbol, period, limit);
    case "crypto":
    case "commodity":
      throw new Error(`Fundamental data not supported for market: ${market}`);
    default:
      throw new Error(`Unknown market: ${market}`);
  }
}

export async function getCashFlow(
  symbol: string,
  market: Market,
  period: "annual" | "quarter" = "annual",
  limit: number = 5
): Promise<FundamentalData[]> {
  switch (market) {
    case "us_stock":
      return getUSStockCashFlow(symbol, period, limit);
    case "a_stock":
      return getAStockCashFlow(symbol, period, limit);
    case "crypto":
    case "commodity":
      throw new Error(`Cash flow data not supported for market: ${market}`);
    default:
      throw new Error(`Unknown market: ${market}`);
  }
}

export async function getKeyMetrics(
  symbol: string,
  market: Market,
  period: "annual" | "quarter" = "annual",
  limit: number = 5
): Promise<FundamentalData[]> {
  switch (market) {
    case "us_stock":
      return getUSStockKeyMetrics(symbol, period, limit);
    case "a_stock":
      // A-stock key metrics returns a single item, wrap in array
      const metrics = await getAStockKeyMetrics(symbol);
      return [metrics];
    case "crypto":
    case "commodity":
      throw new Error(`Key metrics data not supported for market: ${market}`);
    default:
      throw new Error(`Unknown market: ${market}`);
  }
}

export async function getDCF(
  symbol: string,
  market: Market
): Promise<DCFData> {
  switch (market) {
    case "us_stock":
      return getUSStockDCF(symbol);
    case "a_stock":
    case "crypto":
    case "commodity":
      throw new Error("DCF only available for US stocks");
    default:
      throw new Error(`Unknown market: ${market}`);
  }
}

export async function getAnalystEstimates(
  symbol: string,
  market: Market,
  period: "annual" | "quarter" = "annual",
  limit: number = 3
): Promise<FundamentalData[]> {
  switch (market) {
    case "us_stock":
      return getUSStockAnalystEstimates(symbol, period, limit);
    case "a_stock":
    case "crypto":
    case "commodity":
      throw new Error(`Analyst estimates not supported for market: ${market}`);
    default:
      throw new Error(`Unknown market: ${market}`);
  }
}

export { type OHLCV, type FundamentalData, type DCFData, type Market, type Timeframe } from "./types.js";
