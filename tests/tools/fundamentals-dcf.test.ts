import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDCFGaugeOption } from "../../src/render/charts/dcf-gauge.js";
import { buildEstimatesOption } from "../../src/render/charts/analyst-estimates.js";

describe("DCF Gauge Chart", () => {
  it("should build gauge for overvalued stock", () => {
    const option = buildDCFGaugeOption({
      symbol: "AAPL",
      dcfValue: 151.14,
      stockPrice: 255.78,
    });
    assert.ok(option);
    assert.ok(option.series);
    const title = option.title as any;
    assert.ok(title.subtext.includes("Premium"));
  });

  it("should build gauge for undervalued stock", () => {
    const option = buildDCFGaugeOption({
      symbol: "TEST",
      dcfValue: 200,
      stockPrice: 150,
    });
    const title = option.title as any;
    assert.ok(title.subtext.includes("Discount"));
  });

  it("should include analyst target when provided", () => {
    const option = buildDCFGaugeOption({
      symbol: "AAPL",
      dcfValue: 151,
      stockPrice: 255,
      analystTarget: 292,
    });
    const graphic = option.graphic as any[];
    const hasTarget = graphic.some(g => g.style?.text?.includes("Analyst Target"));
    assert.ok(hasTarget);
  });
});

describe("Analyst Estimates Chart", () => {
  it("should build revenue estimates chart", () => {
    const option = buildEstimatesOption({
      symbol: "AAPL",
      actuals: [
        { period: "2024", metrics: { revenue: 390000000000 } },
        { period: "2025", metrics: { revenue: 416000000000 } },
      ],
      estimates: [
        { period: "2026", metrics: { revenueAvg: 450000000000, revenueLow: 430000000000, revenueHigh: 470000000000 } },
        { period: "2027", metrics: { revenueAvg: 490000000000, revenueLow: 460000000000, revenueHigh: 520000000000 } },
      ],
      metric: "revenue",
    });
    assert.ok(option);
    assert.ok(option.series);
  });

  it("should build EPS estimates chart", () => {
    const option = buildEstimatesOption({
      symbol: "AAPL",
      actuals: [
        { period: "2025", metrics: { eps: 7.9 } },
      ],
      estimates: [
        { period: "2026", metrics: { epsAvg: 8.49, epsLow: 7.8, epsHigh: 9.1 } },
      ],
      metric: "eps",
    });
    assert.ok(option);
  });

  it("should handle empty estimates", () => {
    const option = buildEstimatesOption({
      symbol: "TEST",
      actuals: [{ period: "2025", metrics: { revenue: 100000000 } }],
      estimates: [],
      metric: "revenue",
    });
    assert.ok(option);
  });
});
