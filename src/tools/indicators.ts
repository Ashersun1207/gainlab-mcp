import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getKlines } from "../data/index.js";
import { buildIndicatorsOption } from "../render/charts/indicators.js";
import { renderToPNG, renderToHTML } from "../render/engine.js";

const IndicatorsSchema = {
  symbol: z.string().describe('Trading pair or ticker symbol'),
  market: z.enum(["crypto", "us_stock", "a_stock", "commodity"]).describe("Market type"),
  timeframe: z.enum(["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"]).default("1d"),
  indicators: z.array(z.enum(["MA", "EMA", "RSI", "MACD", "BOLL", "KDJ", "VOL", "VWAP", "ATR"]))
    .min(1)
    .describe("Technical indicators to display (VOL is always shown)"),
  ma_periods: z.array(z.number().min(1).max(200))
    .default([7, 25, 99])
    .describe("Periods for MA/EMA indicators (default: [7, 25, 99])"),
  anchor_date: z.string().optional().describe("Anchor date for Anchored VWAP (YYYY-MM-DD). Only used when VWAP is selected."),
  limit: z.number().min(10).max(500).default(100),
  format: z.enum(["interactive", "image"]).default("interactive"),
};

export function registerIndicatorsTool(server: McpServer) {
  server.tool(
    "gainlab_indicators",
    "Draw a K-line chart with technical indicators (MA/EMA/RSI/MACD/BOLL/KDJ). Overlay indicators (MA/EMA/BOLL) appear on the main chart, while oscillators (RSI/MACD/KDJ) get separate panels below. Volume is always shown.",
    IndicatorsSchema,
    async (params) => {
      try {
        // Remove VOL from indicators list (it's always shown)
        const indicators = params.indicators.filter(ind => ind !== "VOL");
        
        if (indicators.length === 0) {
          return {
            content: [{
              type: "text",
              text: "Please specify at least one indicator (MA/EMA/RSI/MACD/BOLL/KDJ). Volume is shown by default."
            }],
            isError: true
          };
        }
        
        const data = await getKlines(params.symbol, params.market, params.timeframe, params.limit);
        
        if (data.length === 0) {
          return {
            content: [{ type: "text", text: `No data found for ${params.symbol}` }]
          };
        }
        
        // Check if we have enough data for indicators
        const maxPeriod = Math.max(...params.ma_periods, 26, 20, 14, 9); // MACD needs 26+9=35
        if (data.length < maxPeriod + 10) {
          return {
            content: [{
              type: "text",
              text: `Warning: Only ${data.length} data points available. Some indicators may need more data for accurate calculation. Consider increasing --limit.`
            }]
          };
        }
        
        const option = buildIndicatorsOption({
          data,
          symbol: params.symbol,
          timeframe: params.timeframe,
          indicators,
          maPeriods: params.ma_periods,
          anchorDate: params.anchor_date,
        });
        
        if (params.format === "image") {
          const pngBuffer = await renderToPNG(option);
          return {
            content: [{
              type: "image",
              data: pngBuffer.toString("base64"),
              mimeType: "image/png"
            }]
          };
        } else {
          const html = renderToHTML(option);
          const indicatorList = indicators.join(", ");
          return {
            content: [
              {
                type: "text",
                text: `📊 ${params.symbol} ${params.timeframe} with ${indicatorList} (${data.length} candles)`
              },
              {
                type: "resource",
                resource: {
                  uri: `gainlab://chart/indicators/${params.symbol}`,
                  mimeType: "text/html",
                  text: html
                }
              },
            ],
          };
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}
