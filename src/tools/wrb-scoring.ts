import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getKlines } from "../data/index.js";
import { analyzeWRB } from "../utils/wrb.js";
import { buildWRBScoringOption } from "../render/charts/wrb-scoring.js";
import { renderToPNG, renderToHTML } from "../render/engine.js";

const WRBScoringSchema = {
  symbol: z.string().describe("Asset symbol (e.g., BTCUSDT, AAPL, 600519)"),
  market: z.enum(["crypto", "us_stock", "a_stock", "commodity"]).describe("Market type"),
  timeframe: z.enum(["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"]).default("1d").describe("Timeframe"),
  limit: z.number().min(50).max(500).default(200).describe("Number of candles to analyze"),
  lookback_period: z.number().min(3).max(20).default(5).describe("WRB lookback period"),
  sensitivity: z.number().min(1.0).max(3.0).default(1.5).describe("WRB sensitivity multiplier"),
  use_body: z.boolean().default(true).describe("Use candle body (true) or full range (false) for WRB detection"),
  gap_extension: z.enum(["none", "stopLoss", "both"]).default("stopLoss").describe("Gap zone extension mode: none=strict gap, stopLoss=extend to WRB range for stop loss, both=full WRB range"),
  format: z.enum(["interactive", "image"]).default("interactive").describe("Output format"),
};

export function registerWRBScoringTool(server: McpServer) {
  server.tool(
    "gainlab_wrb_scoring",
    "Analyze Wide Range Bars and Hidden Gaps (WRB/HG) on a candlestick chart. " +
    "Detects significant price moves (WRB), gap zones (HG), and marks high-quality setups (Pro). " +
    "Based on the HG_PRO system — useful for identifying key support/resistance zones and trade entries.",
    WRBScoringSchema,
    async (params) => {
      try {
        // 1. Fetch klines
        const data = await getKlines(params.symbol, params.market, params.timeframe, params.limit);
        
        if (data.length === 0) {
          return {
            content: [{ type: "text", text: `No data found for ${params.symbol} on ${params.market}` }],
          };
        }

        if (data.length < 10) {
          return {
            content: [{ type: "text", text: `Insufficient data (${data.length} candles). Need at least 10.` }],
          };
        }

        // 2. Run WRB analysis
        const wrbResult = analyzeWRB(data, {
          lookbackPeriod: params.lookback_period,
          sensitivity: params.sensitivity,
          useBody: params.use_body,
          gapExtension: params.gap_extension,
        });

        // 3. Build chart
        const option = buildWRBScoringOption({
          data,
          symbol: params.symbol,
          timeframe: params.timeframe,
          wrbResult,
        });

        // 4. Build summary text
        const { summary } = wrbResult;
        let summaryText = `📊 ${params.symbol} ${params.timeframe} WRB/HG Analysis — ` +
          `${data.length} candles | ` +
          `WRB: ${summary.totalWRB} | ` +
          `Gaps: ${summary.totalGaps} (Active: ${summary.activeGaps}, Filled: ${summary.filledGaps}) | ` +
          `Pro: ${summary.proGaps}`;

        if (summary.lastSignal) {
          const signal = summary.lastSignal;
          const direction = signal.type === "buy" ? "🟢 Bullish" : "🔴 Bearish";
          summaryText += `\n\nLatest signal: ${direction}${signal.pro ? " (PRO)" : ""} at candle #${signal.index}`;
        }

        // 5. Render
        if (params.format === "image") {
          const pngBuffer = await renderToPNG(option);
          return {
            content: [
              { type: "text" as const, text: summaryText },
              {
                type: "image" as const,
                data: pngBuffer.toString("base64"),
                mimeType: "image/png",
              },
            ],
          };
        } else {
          const html = renderToHTML(option);
          return {
            content: [
              { type: "text" as const, text: summaryText },
              {
                type: "resource" as const,
                resource: {
                  uri: `gainlab://chart/wrb-scoring/${params.symbol}`,
                  mimeType: "text/html",
                  text: html,
                },
              },
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
