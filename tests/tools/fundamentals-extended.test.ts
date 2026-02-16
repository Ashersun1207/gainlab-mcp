import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildFundamentalsOption } from "../../src/render/charts/fundamentals.js";
import type { FundamentalData } from "../../src/data/types.js";

describe("Fundamentals Extended Chart", () => {
  it("should handle cash flow metrics", () => {
    const data = new Map<string, FundamentalData[]>();
    data.set("AAPL", [
      { period: "2025", metrics: { operatingCashFlow: 111482000000, freeCashFlow: 98767000000, capitalExpenditure: 12715000000 } },
      { period: "2024", metrics: { operatingCashFlow: 118254000000, freeCashFlow: 108807000000, capitalExpenditure: 9447000000 } },
    ]);
    const option = buildFundamentalsOption({
      data,
      symbols: ["AAPL"],
      metrics: ["operating_cash_flow", "free_cash_flow", "capex"],
      period: "annual"
    });
    assert.ok(option);
    assert.ok(option.series);
  });

  it("should handle ratio metrics", () => {
    const data = new Map<string, FundamentalData[]>();
    data.set("AAPL", [
      { period: "2025", metrics: { peRatio: 34.09, returnOnEquity: 1.52, currentRatio: 0.89 } },
    ]);
    const option = buildFundamentalsOption({
      data,
      symbols: ["AAPL"],
      metrics: ["pe_ratio", "roe", "current_ratio"],
      period: "annual"
    });
    assert.ok(option);
  });

  it("should handle mixed metrics across categories", () => {
    const data = new Map<string, FundamentalData[]>();
    data.set("AAPL", [
      { period: "2025", metrics: { revenue: 416000000000, freeCashFlow: 98767000000, peRatio: 34 } },
    ]);
    const option = buildFundamentalsOption({
      data,
      symbols: ["AAPL"],
      metrics: ["revenue", "free_cash_flow", "pe_ratio"],
      period: "annual"
    });
    assert.ok(option);
    const series = option.series as any[];
    assert.equal(series.length, 3);
  });

  it("should handle multi-company comparison with new metrics", () => {
    const data = new Map<string, FundamentalData[]>();
    data.set("AAPL", [{ period: "2025", metrics: { freeCashFlow: 98767000000 } }]);
    data.set("MSFT", [{ period: "2025", metrics: { freeCashFlow: 74000000000 } }]);
    const option = buildFundamentalsOption({
      data,
      symbols: ["AAPL", "MSFT"],
      metrics: ["free_cash_flow"],
      period: "annual"
    });
    assert.ok(option);
  });
});
