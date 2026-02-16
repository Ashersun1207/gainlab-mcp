import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Test the tool logic by importing the underlying functions directly
import { analyzeWRB } from "../../src/utils/wrb.js";
import { buildWRBScoringOption } from "../../src/render/charts/wrb-scoring.js";
import { renderToHTML } from "../../src/render/engine.js";
import type { OHLCV } from "../../src/data/types.js";

function candle(o: number, h: number, l: number, c: number, v = 1000, ts = 0): OHLCV {
  return { timestamp: ts || Date.now(), open: o, high: h, low: l, close: c, volume: v };
}

function generateTestData(): OHLCV[] {
  const base = Date.now();
  const data: OHLCV[] = [];
  // 5 small candles
  for (let i = 0; i < 5; i++) {
    data.push(candle(100, 100.5, 99.5, 100.2, 1000, base + i * 86400000));
  }
  // WRB candle (big bullish)
  data.push(candle(100, 106, 99.8, 105, 5000, base + 5 * 86400000));
  // Gap candle (low > oldBar.high = 100.5)
  data.push(candle(103, 107, 101, 106, 3000, base + 6 * 86400000));
  // More candles
  for (let i = 7; i < 30; i++) {
    data.push(candle(105 + Math.sin(i), 106.5, 104, 105.5, 1500, base + i * 86400000));
  }
  return data;
}

describe("WRB Scoring Tool Integration", () => {
  it("should produce complete analysis pipeline", () => {
    const data = generateTestData();
    const result = analyzeWRB(data);
    assert.ok(result.summary.totalWRB > 0, "Should detect at least one WRB");
  });

  it("should render chart from analysis", () => {
    const data = generateTestData();
    const result = analyzeWRB(data);
    const option = buildWRBScoringOption({ data, symbol: "BTCUSDT", timeframe: "1d", wrbResult: result });
    const html = renderToHTML(option);
    assert.ok(html.includes("echarts"), "HTML should include echarts");
    assert.ok(html.length > 1000, "HTML should be substantial");
  });

  it("should handle different config parameters", () => {
    const data = generateTestData();
    const result = analyzeWRB(data, {
      lookbackPeriod: 3,
      sensitivity: 2.0,
      useBody: false,
      gapExtension: "both",
    });
    assert.ok(result);
    assert.ok(result.wrbFlags.length === data.length);
  });

  it("should generate summary with signal info", () => {
    const data = generateTestData();
    const result = analyzeWRB(data);
    const { summary } = result;
    assert.ok(typeof summary.totalWRB === "number");
    assert.ok(typeof summary.totalGaps === "number");
    assert.ok(typeof summary.activeGaps === "number");
    assert.ok(typeof summary.filledGaps === "number");
    assert.ok(typeof summary.proGaps === "number");
  });

  it("should handle minimal data gracefully", () => {
    const data = Array.from({length: 10}, (_, i) => 
      candle(100, 101, 99, 100.5, 1000, Date.now() + i * 86400000)
    );
    const result = analyzeWRB(data);
    const option = buildWRBScoringOption({ data, symbol: "TEST", timeframe: "1d", wrbResult: result });
    assert.ok(option);
  });
});
