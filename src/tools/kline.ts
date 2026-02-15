import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getKlines } from "../data/index.js";
import { buildKlineOption } from "../render/charts/kline.js";
import { renderToPNG, renderToHTML } from "../render/engine.js";

const KlineSchema = {
  symbol: z.string().describe('Trading pair or ticker symbol, e.g. "BTCUSDT", "AAPL", "600519.SHG", "XAUUSD"'),
  market: z.enum(["crypto", "us_stock", "a_stock", "commodity"]).describe("Market type"),
  timeframe: z.enum(["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"]).default("1d").describe("Candlestick timeframe"),
  limit: z.number().min(10).max(500).default(100).describe("Number of candlesticks"),
  format: z.enum(["interactive", "image"]).default("interactive").describe("Output format: interactive HTML or PNG image"),
};

export function registerKlineTool(server: McpServer) {
  server.tool(
    "gainlab_kline",
    "Draw a candlestick (K-line) chart with volume. Supports crypto, US stocks, A-shares, and commodities.",
    KlineSchema,
    async (params) => {
      try {
        // Fetch data
        const data = await getKlines(params.symbol, params.market, params.timeframe, params.limit);
        
        if (data.length === 0) {
          return {
            content: [{ type: "text", text: `No data found for ${params.symbol} on ${params.market}` }],
          };
        }

        // Build chart option
        const option = buildKlineOption(data, params.symbol, params.timeframe);

        if (params.format === "image") {
          const pngBuffer = await renderToPNG(option);
          return {
            content: [{
              type: "image",
              data: pngBuffer.toString("base64"),
              mimeType: "image/png",
            }],
          };
        } else {
          const html = renderToHTML(option);
          return {
            content: [
              { type: "text", text: `📊 ${params.symbol} ${params.timeframe} K-Line Chart (${data.length} candles)` },
              { type: "resource", resource: { uri: `gainlab://chart/kline/${params.symbol}`, mimeType: "text/html", text: html } },
            ],
          };
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    }
  );
}
