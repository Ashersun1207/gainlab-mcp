// Volume Profile MCP tool — draws VP chart with POC, VAH, VAL markers

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getKlines } from "../data/index.js";
import { calculateVolumeProfile } from "../utils/volume-profile.js";
import { buildVolumeProfileOption } from "../render/charts/volume-profile.js";
import { renderToPNG, renderToHTML } from "../render/engine.js";

const VolumeProfileSchema = {
  symbol: z.string().describe('Trading pair or ticker symbol'),
  market: z.enum(["crypto", "us_stock", "a_stock", "commodity"]).describe("Market type"),
  timeframe: z.enum(["1m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"]).default("1d"),
  limit: z.number().min(30).max(500).default(120).describe("Number of candles for VP calculation"),
  rows: z.number().min(10).max(100).default(24).describe("Number of price levels"),
  value_area_percent: z.number().min(0.5).max(0.95).default(0.7).describe("Value Area percentage (0.7 = 70%)"),
  format: z.enum(["interactive", "image"]).default("interactive"),
};

export function registerVolumeProfileTool(server: McpServer) {
  server.tool(
    "gainlab_volume_profile",
    "Draw a Volume Profile chart showing price distribution of trading volume with POC, VAH, VAL markers. Helps identify high-volume price nodes and value areas.",
    VolumeProfileSchema,
    async (params) => {
      try {
        const data = await getKlines(params.symbol, params.market, params.timeframe, params.limit);

        if (data.length === 0) {
          return {
            content: [{ type: "text", text: `No data found for ${params.symbol} on ${params.market}` }],
          };
        }

        // Calculate volume profile
        const vpResult = calculateVolumeProfile(data, params.rows, params.value_area_percent);

        // Build chart
        const option = buildVolumeProfileOption({
          data,
          symbol: params.symbol,
          timeframe: params.timeframe,
          vpResult,
        });

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
              {
                type: "text",
                text: [
                  `📊 ${params.symbol} ${params.timeframe} Volume Profile (${data.length} candles, ${params.rows} levels)`,
                  `POC: ${vpResult.poc.toFixed(2)}`,
                  `VAH: ${vpResult.vah.toFixed(2)}`,
                  `VAL: ${vpResult.val.toFixed(2)}`,
                  `Value Area: ${(vpResult.valueAreaPercent * 100).toFixed(0)}%`,
                ].join("\n"),
              },
              {
                type: "resource",
                resource: {
                  uri: `gainlab://chart/volume-profile/${params.symbol}`,
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
