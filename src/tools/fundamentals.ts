import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getFundamentals, getCashFlow, getKeyMetrics } from "../data/index.js";
import { buildFundamentalsOption } from "../render/charts/fundamentals.js";
import { renderToPNG, renderToHTML } from "../render/engine.js";
import type { FundamentalData } from "../data/types.js";

const FundamentalsSchema = {
  symbols: z.array(z.string()).min(1).max(5).describe("Stock symbols (1-5 companies for comparison)"),
  market: z.enum(["us_stock", "a_stock"]).describe("Market type (fundamentals only available for stocks)"),
  metrics: z.array(z.enum([
    // Income Statement (existing)
    "revenue", "net_income", "gross_margin", "operating_margin", "eps", "ebitda",
    // Cash Flow (new)
    "operating_cash_flow", "free_cash_flow", "capex",
    // Valuation ratios (new - snapshot, not time series)
    "pe_ratio", "pb_ratio", "ev_ebitda",
    // Profitability (new)
    "roe", "roa", "profit_margin",
    // Health (new)
    "current_ratio", "dividend_yield",
  ])).min(1).describe("Fundamental metrics to display"),
  period: z.enum(["annual", "quarter"]).default("annual").describe("Reporting period"),
  years: z.number().min(1).max(10).default(5).describe("Number of years/quarters of historical data"),
  format: z.enum(["interactive", "image"]).default("interactive").describe("Output format: interactive HTML or PNG image"),
};

// Metric categories for smart data fetching
const INCOME_METRICS = new Set([
  "revenue", "net_income", "gross_margin", "operating_margin", "eps", "ebitda"
]);
const CASH_FLOW_METRICS = new Set([
  "operating_cash_flow", "free_cash_flow", "capex"
]);
const KEY_METRICS = new Set([
  "pe_ratio", "pb_ratio", "ev_ebitda", "roe", "roa", "profit_margin", "current_ratio", "dividend_yield"
]);

// Available metrics mapping (all supported metrics)
const AVAILABLE_METRICS = new Set([
  ...INCOME_METRICS,
  ...CASH_FLOW_METRICS,
  ...KEY_METRICS,
]);

export function registerFundamentalsTool(server: McpServer) {
  server.tool(
    "gainlab_fundamentals",
    "Visualize fundamental financial data (revenue, profit, margins, earnings) for stocks. Supports multi-company comparison.",
    FundamentalsSchema,
    async (params) => {
      try {
        // Validate market
        if (params.market !== "us_stock" && params.market !== "a_stock") {
          return {
            content: [{
              type: "text",
              text: "Error: Fundamental data is only available for us_stock and a_stock markets. Crypto and commodities are not supported.",
            }],
            isError: true,
          };
        }

        // Filter out unsupported metrics
        const requestedMetrics = params.metrics;
        const supportedMetrics = requestedMetrics.filter(m => AVAILABLE_METRICS.has(m));
        const unsupportedMetrics = requestedMetrics.filter(m => !AVAILABLE_METRICS.has(m));

        if (supportedMetrics.length === 0) {
          return {
            content: [{
              type: "text",
              text: `Error: None of the requested metrics are available. Supported metrics: ${Array.from(AVAILABLE_METRICS).join(", ")}`,
            }],
            isError: true,
          };
        }

        let warningMessage = "";
        if (unsupportedMetrics.length > 0) {
          warningMessage = `⚠️ Unsupported metrics skipped: ${unsupportedMetrics.join(", ")}\n`;
        }

        // Determine which data sources are needed based on requested metrics
        const needsIncome = supportedMetrics.some(m => INCOME_METRICS.has(m));
        const needsCashFlow = supportedMetrics.some(m => CASH_FLOW_METRICS.has(m));
        const needsKeyMetrics = supportedMetrics.some(m => KEY_METRICS.has(m));

        // Fetch data for all symbols in parallel
        const dataMap = new Map<string, FundamentalData[]>();
        const fetchPromises = params.symbols.map(async (symbol) => {
          try {
            // Fetch all needed data sources in parallel
            const fetchTasks: Promise<FundamentalData[]>[] = [];
            
            if (needsIncome) {
              fetchTasks.push(getFundamentals(symbol, params.market, params.period, params.years));
            }
            if (needsCashFlow) {
              fetchTasks.push(getCashFlow(symbol, params.market, params.period, params.years));
            }
            if (needsKeyMetrics) {
              fetchTasks.push(getKeyMetrics(symbol, params.market, params.period, params.years));
            }
            
            const results = await Promise.all(fetchTasks);
            
            // Merge all data by period
            const mergedData = new Map<string, FundamentalData>();
            
            for (const dataArray of results) {
              for (const item of dataArray) {
                if (!mergedData.has(item.period)) {
                  mergedData.set(item.period, { period: item.period, metrics: {} });
                }
                // Merge metrics
                Object.assign(mergedData.get(item.period)!.metrics, item.metrics);
              }
            }
            
            // Convert map back to array
            const mergedArray = Array.from(mergedData.values());
            dataMap.set(symbol, mergedArray);
          } catch (error: any) {
            console.error(`Failed to fetch fundamentals for ${symbol}:`, error.message);
            dataMap.set(symbol, []);  // Empty data for failed symbols
          }
        });

        await Promise.all(fetchPromises);

        // Check if we have any data
        const totalDataPoints = Array.from(dataMap.values()).reduce((sum, data) => sum + data.length, 0);
        if (totalDataPoints === 0) {
          return {
            content: [{
              type: "text",
              text: `No fundamental data found for ${params.symbols.join(", ")} on ${params.market}`,
            }],
          };
        }

        // Build chart option
        const option = buildFundamentalsOption({
          data: dataMap,
          symbols: params.symbols,
          metrics: supportedMetrics,
          period: params.period,
        });

        // Render
        if (params.format === "image") {
          const pngBuffer = await renderToPNG(option);
          return {
            content: [
              ...(warningMessage ? [{ type: "text" as const, text: warningMessage }] : []),
              {
                type: "image" as const,
                data: pngBuffer.toString("base64"),
                mimeType: "image/png",
              },
            ],
          };
        } else {
          const html = renderToHTML(option);
          const symbolsStr = params.symbols.join(", ");
          const metricsStr = supportedMetrics.join(", ");
          const description = params.symbols.length > 1
            ? `${symbolsStr} — ${metricsStr} (${params.period}, ${params.years} periods)`
            : `${symbolsStr} Fundamentals — ${metricsStr} (${params.period}, ${params.years} periods)`;

          return {
            content: [
              { type: "text" as const, text: `${warningMessage}📊 ${description}` },
              {
                type: "resource" as const,
                resource: {
                  uri: `gainlab://chart/fundamentals/${params.symbols.join("+")}`,
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
