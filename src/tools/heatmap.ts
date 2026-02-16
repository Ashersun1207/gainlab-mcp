// Heatmap MCP tool — sector treemap + correlation matrix

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getUSStockScreener, getCryptoScreener } from "../data/screener.js";
import { buildCorrelationMatrix } from "../utils/correlation.js";
import { buildSectorTreemapOption } from "../render/charts/sector-treemap.js";
import { buildCorrelationMatrixOption } from "../render/charts/correlation-matrix.js";
import { renderToPNG, renderToHTML } from "../render/engine.js";
import type { Market } from "../data/types.js";

const HeatmapSchema = {
  type: z.enum(["sector_treemap", "correlation_matrix"]).describe(
    "Heatmap type: sector_treemap for Finviz-style sector heatmap, correlation_matrix for N×N asset correlation"
  ),
  // sector_treemap params
  market: z.enum(["crypto", "us_stock"]).optional().describe(
    "Market for sector treemap (required for sector_treemap)"
  ),
  sector: z.string().optional().describe(
    "Filter by sector, e.g. 'Technology', 'DeFi' (optional)"
  ),
  change_period: z.enum(["1d", "5d"]).default("1d").describe(
    "Change period for coloring (default: 1d)"
  ),
  min_market_cap: z.number().optional().describe(
    "Minimum market cap in USD (default: 10B for US stocks, 1M volume for crypto)"
  ),
  limit: z.number().min(10).max(200).default(50).describe(
    "Maximum number of items to display (default: 50)"
  ),
  // correlation_matrix params
  symbols: z.array(z.string()).min(2).max(20).optional().describe(
    "Symbols for correlation matrix, e.g. ['BTCUSDT', 'AAPL', 'XAUUSD']"
  ),
  markets: z.array(z.enum(["crypto", "us_stock", "a_stock", "commodity"])).optional().describe(
    "Market for each symbol (same order), e.g. ['crypto', 'us_stock', 'commodity']"
  ),
  days: z.number().min(30).max(365).default(90).describe(
    "Number of days for correlation calculation (default: 90)"
  ),
  // common
  format: z.enum(["interactive", "image"]).default("interactive"),
};

export function registerHeatmapTool(server: McpServer) {
  server.tool(
    "gainlab_heatmap",
    "Draw a sector heatmap (treemap) or asset correlation matrix. " +
    "Sector treemap shows market overview with blocks sized by market cap and colored by price change. " +
    "Correlation matrix shows pairwise Pearson correlation between assets.",
    HeatmapSchema,
    async (params) => {
      try {
        if (params.type === "sector_treemap") {
          return await handleSectorTreemap(params);
        } else {
          return await handleCorrelationMatrix(params);
        }
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    }
  );
}

async function handleSectorTreemap(params: {
  market?: "crypto" | "us_stock";
  sector?: string;
  change_period: "1d" | "5d";
  min_market_cap?: number;
  limit: number;
  format: "interactive" | "image";
}) {
  const market = params.market;
  if (!market) {
    return {
      content: [{ type: "text" as const, text: "Error: 'market' is required for sector_treemap (us_stock or crypto)" }],
      isError: true,
    };
  }

  let items;
  if (market === "us_stock") {
    items = await getUSStockScreener({
      sector: params.sector,
      minMarketCap: params.min_market_cap ?? 10_000_000_000,
      limit: params.limit,
    });
  } else {
    items = await getCryptoScreener({
      sector: params.sector,
      minVolume: params.min_market_cap ?? 1_000_000,
      limit: params.limit,
    });
  }

  if (items.length === 0) {
    return {
      content: [{ type: "text" as const, text: `No data found for ${market}${params.sector ? ` sector=${params.sector}` : ""}` }],
    };
  }

  const option = buildSectorTreemapOption({
    items,
    market,
    changePeriod: params.change_period,
  });

  const width = 1000;
  const height = 650;

  if (params.format === "image") {
    const pngBuffer = await renderToPNG(option, width, height);
    return {
      content: [{
        type: "image" as const,
        data: pngBuffer.toString("base64"),
        mimeType: "image/png" as const,
      }],
    };
  } else {
    const html = renderToHTML(option, width, height);
    return {
      content: [
        {
          type: "text" as const,
          text: `📊 Sector treemap for ${market}${params.sector ? ` (${params.sector})` : ""}: ${items.length} items, ${params.change_period} change`,
        },
        {
          type: "resource" as const,
          resource: {
            uri: `gainlab://chart/heatmap/sector-treemap/${market}`,
            mimeType: "text/html",
            text: html,
          },
        },
      ],
    };
  }
}

async function handleCorrelationMatrix(params: {
  symbols?: string[];
  markets?: Market[];
  days: number;
  format: "interactive" | "image";
}) {
  if (!params.symbols || params.symbols.length < 2) {
    return {
      content: [{ type: "text" as const, text: "Error: 'symbols' is required for correlation_matrix (at least 2 symbols)" }],
      isError: true,
    };
  }
  if (!params.markets || params.markets.length !== params.symbols.length) {
    return {
      content: [{
        type: "text" as const,
        text: `Error: 'markets' must have the same length as 'symbols'. Got ${params.symbols.length} symbols and ${params.markets?.length ?? 0} markets.`,
      }],
      isError: true,
    };
  }

  const assets = params.symbols.map((symbol, i) => ({
    symbol,
    market: params.markets![i],
  }));

  const matrix = await buildCorrelationMatrix(assets, params.days);
  const option = buildCorrelationMatrixOption({ matrix });

  const n = params.symbols.length;
  const cellSize = n > 10 ? 40 : 55;
  const padding = 200;
  const size = Math.max(500, n * cellSize + padding);

  if (params.format === "image") {
    const pngBuffer = await renderToPNG(option, size, size);
    return {
      content: [{
        type: "image" as const,
        data: pngBuffer.toString("base64"),
        mimeType: "image/png" as const,
      }],
    };
  } else {
    const html = renderToHTML(option, size, size);
    return {
      content: [
        {
          type: "text" as const,
          text: `📊 Correlation matrix: ${params.symbols.join(", ")} (${params.days} days)`,
        },
        {
          type: "resource" as const,
          resource: {
            uri: `gainlab://chart/heatmap/correlation-matrix`,
            mimeType: "text/html",
            text: html,
          },
        },
      ],
    };
  }
}
