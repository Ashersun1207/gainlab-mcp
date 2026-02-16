import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getKlines } from "../data/index.js";
import { buildOverlayOption, type OverlaySeriesData } from "../render/charts/overlay.js";
import { renderToPNG, renderToHTML } from "../render/engine.js";

const OverlaySchema = z.object({
  assets: z
    .array(
      z.object({
        symbol: z.string().describe("Asset symbol (e.g., BTC, AAPL, 600519)"),
        market: z
          .enum(["crypto", "us_stock", "a_stock", "commodity"])
          .describe("Market type"),
      })
    )
    .min(2, "At least 2 assets required")
    .max(6, "Maximum 6 assets allowed"),
  timeframe: z
    .enum(["1d", "1w", "1M"])
    .default("1d")
    .describe("Timeframe (1d, 1w, 1M)"),
  period: z
    .string()
    .default("1Y")
    .describe("Period: 3M, 6M, 1Y, or 5Y"),
  normalize: z
    .boolean()
    .default(true)
    .describe("Normalize to percentage change from first value"),
  format: z
    .enum(["interactive", "image"])
    .default("interactive")
    .describe("Output format"),
});

type OverlayParams = z.infer<typeof OverlaySchema>;

function periodToLimit(period: string): number {
  const periodMap: Record<string, number> = {
    "3M": 65,
    "6M": 130,
    "1Y": 252,
    "5Y": 1260,
  };
  return periodMap[period] || 252;
}

export function registerOverlayTool(server: McpServer) {
  server.tool(
    "gainlab_overlay",
    "Multi-asset overlay chart with optional normalization. Compare 2-6 assets across different markets.",
    OverlaySchema,
    async (params: OverlayParams) => {
      try {
        const limit = periodToLimit(params.period);

        // Fetch all assets in parallel
        const fetchPromises = params.assets.map(async (asset) => {
          const klines = await getKlines(
            asset.symbol,
            asset.market,
            params.timeframe,
            limit
          );
          return {
            symbol: asset.symbol,
            market: asset.market,
            klines,
          };
        });

        const results = await Promise.all(fetchPromises);

        // Check if all assets have data
        const emptyAssets = results.filter((r) => r.klines.length === 0);
        if (emptyAssets.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: `No data found for: ${emptyAssets.map((a) => `${a.symbol} (${a.market})`).join(", ")}`,
              },
            ],
            isError: true,
          };
        }

        // Transform to overlay series data
        const seriesData: OverlaySeriesData[] = results.map((result) => ({
          symbol: result.symbol,
          market: result.market,
          dates: result.klines.map((k) => k.time),
          values: result.klines.map((k) => k.close),
        }));

        const option = buildOverlayOption(
          seriesData,
          params.normalize,
          params.timeframe
        );

        if (params.format === "image") {
          const pngBuffer = await renderToPNG(option);
          return {
            content: [
              {
                type: "image",
                data: pngBuffer.toString("base64"),
                mimeType: "image/png",
              },
            ],
          };
        } else {
          const html = renderToHTML(option);
          const assetList = params.assets
            .map((a) => `${a.symbol} (${a.market})`)
            .join(", ");
          return {
            content: [
              {
                type: "text",
                text: `📊 Multi-Asset Overlay: ${assetList} | Period: ${params.period} | ${params.normalize ? "Normalized" : "Raw Values"}`,
              },
              {
                type: "resource",
                resource: {
                  uri: `gainlab://chart/overlay/${params.assets.map((a) => a.symbol).join("+")}`,
                  mimeType: "text/html",
                  text: html,
                },
              },
            ],
          };
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating overlay chart: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
