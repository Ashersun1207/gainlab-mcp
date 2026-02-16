import { OHLCV, FundamentalData, Market, Timeframe } from "./types.js";
import { getCryptoKlines } from "./crypto.js";
import { getUSStockKlines, getUSStockFundamentals } from "./us-stock.js";
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
      // TODO: EODHD integration (Phase 3)
      throw new Error("A-stock data not yet implemented. Set EODHD_API_KEY and wait for Phase 3.");
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
    case "crypto":
    case "a_stock":
    case "commodity":
      throw new Error(`Fundamental data not supported for market: ${market}`);
    default:
      throw new Error(`Unknown market: ${market}`);
  }
}

export { type OHLCV, type FundamentalData, type Market, type Timeframe } from "./types.js";
