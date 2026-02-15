import { OHLCV, Market, Timeframe } from "./types.js";
import { getCryptoKlines } from "./crypto.js";

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
      // TODO: FMP integration (Phase 2)
      throw new Error("US stock data not yet implemented. Set FMP_API_KEY and wait for Phase 2.");
    case "a_stock":
      // TODO: EODHD integration (Phase 2)
      throw new Error("A-stock data not yet implemented. Set EODHD_API_KEY and wait for Phase 2.");
    case "commodity":
      // TODO: FMP/EODHD integration (Phase 2)
      throw new Error("Commodity data not yet implemented. Wait for Phase 2.");
    default:
      throw new Error(`Unknown market: ${market}`);
  }
}

export { type OHLCV, type Market, type Timeframe } from "./types.js";
