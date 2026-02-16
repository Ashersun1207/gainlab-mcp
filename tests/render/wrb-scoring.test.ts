import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWRBScoringOption } from "../../src/render/charts/wrb-scoring.js";
import { analyzeWRB } from "../../src/utils/wrb.js";
import type { OHLCV } from "../../src/data/types.js";

function candle(o: number, h: number, l: number, c: number, v = 1000, ts = 0): OHLCV {
  return { timestamp: ts || Date.now(), open: o, high: h, low: l, close: c, volume: v };
}

describe("WRB Scoring Chart", () => {
  it("should return valid ECharts option", () => {
    const data = generateTestData(); // 20+ candles with at least 1 WRB/HG
    const result = analyzeWRB(data);
    const option = buildWRBScoringOption({ data, symbol: "BTCUSDT", timeframe: "1d", wrbResult: result });
    assert.ok(option);
    assert.ok(option.backgroundColor);
    assert.ok(option.series);
    assert.ok(Array.isArray(option.series));
  });

  it("should include candlestick series", () => {
    const data = generateSimpleData();
    const result = analyzeWRB(data);
    const option = buildWRBScoringOption({ data, symbol: "TEST", timeframe: "1d", wrbResult: result });
    const series = option.series as any[];
    const candleSeries = series.find(s => s.type === "candlestick");
    assert.ok(candleSeries, "Should have candlestick series");
  });

  it("should include volume series", () => {
    const data = generateSimpleData();
    const result = analyzeWRB(data);
    const option = buildWRBScoringOption({ data, symbol: "TEST", timeframe: "1d", wrbResult: result });
    const series = option.series as any[];
    const volSeries = series.find(s => s.type === "bar");
    assert.ok(volSeries, "Should have volume bar series");
  });

  it("should have title with summary", () => {
    const data = generateSimpleData();
    const result = analyzeWRB(data);
    const option = buildWRBScoringOption({ data, symbol: "BTCUSDT", timeframe: "4h", wrbResult: result });
    const title = option.title as any;
    assert.ok(title.text.includes("BTCUSDT"));
    assert.ok(title.subtext.includes("WRB"));
  });

  it("should handle data with no WRB signals", () => {
    // All same-size candles, no WRB
    const data = Array.from({length: 20}, (_, i) => candle(100, 101, 99, 100.5, 1000, Date.now() + i * 86400000));
    const result = analyzeWRB(data);
    const option = buildWRBScoringOption({ data, symbol: "TEST", timeframe: "1d", wrbResult: result });
    assert.ok(option);
  });
});

function generateSimpleData(): OHLCV[] {
  const base = Date.now();
  return Array.from({length: 20}, (_, i) => {
    const o = 100 + Math.sin(i) * 2;
    return candle(o, o + 1.5, o - 1, o + 0.5, 1000 + i * 100, base + i * 86400000);
  });
}

function generateTestData(): OHLCV[] {
  // Create data with a guaranteed WRB + HG pattern
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
  for (let i = 7; i < 20; i++) {
    data.push(candle(105 + Math.sin(i), 106.5, 104, 105.5, 1500, base + i * 86400000));
  }
  return data;
}
