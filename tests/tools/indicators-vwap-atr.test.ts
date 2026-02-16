// Integration tests for VWAP and ATR in indicators chart builder

import { describe, test } from "node:test";
import assert from "node:assert";
import { buildIndicatorsOption } from "../../src/render/charts/indicators.js";
import type { OHLCV } from "../../src/data/types.js";

describe("Indicators Chart — VWAP & ATR", () => {
  // Sample K-line data with realistic timestamps
  const baseTimestamp = new Date("2026-01-01").getTime();
  const sampleData: OHLCV[] = Array.from({ length: 100 }, (_, i) => ({
    timestamp: baseTimestamp + i * 86400000,
    open: 100 + Math.sin(i * 0.1) * 10,
    high: 105 + Math.sin(i * 0.1) * 10,
    low: 95 + Math.sin(i * 0.1) * 10,
    close: 100 + Math.sin(i * 0.1) * 10 + (i % 2 === 0 ? 1 : -1),
    volume: 1000000 + Math.random() * 500000,
  }));

  test("should build chart with VWAP overlay", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["VWAP"],
    });

    assert.ok(option);
    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("VWAP"), "Should include VWAP series");
    
    // VWAP is an overlay — should not add extra grid
    // 2 grids: main + volume
    assert.strictEqual((option.grid as any[]).length, 2);
  });

  test("should build chart with VWAP and Anchored VWAP", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["VWAP"],
      anchorDate: "2026-02-01",
    });

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("VWAP"), "Should include VWAP");
    assert.ok(seriesNames.includes("Anchored VWAP"), "Should include Anchored VWAP");
  });

  test("should build chart with ATR in sub-panel", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "AAPL",
      timeframe: "1d",
      indicators: ["ATR"],
    });

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("ATR(14)"), "Should include ATR series");
    
    // ATR is a sub-indicator — 3 grids: main + volume + ATR
    assert.strictEqual((option.grid as any[]).length, 3);
  });

  test("should build chart with VWAP + ATR + other indicators", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["MA", "VWAP", "RSI", "ATR"],
      maPeriods: [7],
    });

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("MA7"));
    assert.ok(seriesNames.includes("VWAP"));
    assert.ok(seriesNames.includes("RSI(14)"));
    assert.ok(seriesNames.includes("ATR(14)"));

    // 4 grids: main + volume + RSI + ATR
    assert.strictEqual((option.grid as any[]).length, 4);
  });

  test("should not add Anchored VWAP when anchor_date is not in data range", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["VWAP"],
      anchorDate: "2020-01-01", // way before data range
    });

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("VWAP"));
    // Since 2020-01-01 < all data timestamps, anchorIndex = 0, so Anchored VWAP should appear
    assert.ok(seriesNames.includes("Anchored VWAP"));
  });

  test("should include VWAP and ATR in indicator title", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "AAPL",
      timeframe: "1d",
      indicators: ["VWAP", "ATR"],
    });

    const title = option.title as any;
    assert.ok(title.subtext.includes("VWAP"));
    assert.ok(title.subtext.includes("ATR"));
  });
});
