import { describe, test } from "node:test";
import assert from "node:assert";
import { buildIndicatorsOption } from "../../src/render/charts/indicators.js";
import type { OHLCV } from "../../src/data/types.js";

describe("Indicators Chart Builder", () => {
  // Sample K-line data
  const sampleData: OHLCV[] = Array.from({ length: 100 }, (_, i) => ({
    timestamp: Date.now() - (100 - i) * 86400000,
    open: 100 + Math.sin(i * 0.1) * 10,
    high: 105 + Math.sin(i * 0.1) * 10,
    low: 95 + Math.sin(i * 0.1) * 10,
    close: 100 + Math.sin(i * 0.1) * 10 + (i % 2 === 0 ? 1 : -1),
    volume: 1000000 + Math.random() * 500000,
  }));

  test("should build chart with MA indicator", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["MA"],
      maPeriods: [7, 25, 99],
    });

    assert.ok(option);
    assert.ok(option.series);
    assert.ok(Array.isArray(option.series));
    
    // Should have: K-line + Volume + 3 MA lines
    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("K Line"));
    assert.ok(seriesNames.includes("Volume"));
    assert.ok(seriesNames.includes("MA7"));
    assert.ok(seriesNames.includes("MA25"));
    assert.ok(seriesNames.includes("MA99"));
  });

  test("should build chart with EMA indicator", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "AAPL",
      timeframe: "1d",
      indicators: ["EMA"],
      maPeriods: [12, 26],
    });

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("EMA12"));
    assert.ok(seriesNames.includes("EMA26"));
  });

  test("should build chart with BOLL indicator", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "AAPL",
      timeframe: "1d",
      indicators: ["BOLL"],
    });

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("BOLL Upper"));
    assert.ok(seriesNames.includes("BOLL Middle"));
    assert.ok(seriesNames.includes("BOLL Lower"));
  });

  test("should build chart with RSI indicator in separate panel", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["RSI"],
    });

    // Should have 3 grids: main (K-line) + volume + RSI
    assert.strictEqual(option.grid?.length, 3);
    assert.strictEqual(option.xAxis?.length, 3);
    assert.strictEqual(option.yAxis?.length, 3);

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("RSI(14)"));
    assert.ok(seriesNames.includes("RSI 70"));
    assert.ok(seriesNames.includes("RSI 30"));
  });

  test("should build chart with MACD indicator in separate panel", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["MACD"],
    });

    // Should have 3 grids: main + volume + MACD
    assert.strictEqual(option.grid?.length, 3);

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("MACD"));
    assert.ok(seriesNames.includes("Signal"));
    assert.ok(seriesNames.includes("MACD Histogram"));
  });

  test("should build chart with KDJ indicator in separate panel", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["KDJ"],
    });

    // Should have 3 grids: main + volume + KDJ
    assert.strictEqual(option.grid?.length, 3);

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("K"));
    assert.ok(seriesNames.includes("D"));
    assert.ok(seriesNames.includes("J"));
    assert.ok(seriesNames.includes("KDJ 80"));
    assert.ok(seriesNames.includes("KDJ 20"));
  });

  test("should build chart with multiple indicators", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["MA", "RSI", "MACD"],
      maPeriods: [7, 25],
    });

    // Should have 4 grids: main + volume + RSI + MACD
    assert.strictEqual(option.grid?.length, 4);
    assert.strictEqual(option.xAxis?.length, 4);
    assert.strictEqual(option.yAxis?.length, 4);

    const seriesNames = (option.series as any[]).map(s => s.name);
    // Overlay indicators
    assert.ok(seriesNames.includes("MA7"));
    assert.ok(seriesNames.includes("MA25"));
    // Sub-panel indicators
    assert.ok(seriesNames.includes("RSI(14)"));
    assert.ok(seriesNames.includes("MACD"));
  });

  test("should build chart with all indicators", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["MA", "EMA", "BOLL", "RSI", "MACD", "KDJ"],
      maPeriods: [7],
    });

    // Should have 5 grids: main + volume + RSI + MACD + KDJ
    assert.strictEqual(option.grid?.length, 5);

    const seriesNames = (option.series as any[]).map(s => s.name);
    // All indicators should be present
    assert.ok(seriesNames.includes("MA7"));
    assert.ok(seriesNames.includes("EMA7"));
    assert.ok(seriesNames.includes("BOLL Upper"));
    assert.ok(seriesNames.includes("RSI(14)"));
    assert.ok(seriesNames.includes("MACD"));
    assert.ok(seriesNames.includes("K"));
  });

  test("should include title with symbol and timeframe", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "AAPL",
      timeframe: "1d",
      indicators: ["MA", "RSI"],
    });

    assert.ok(option.title);
    const title = option.title as any;
    assert.ok(title.text.includes("AAPL"));
    assert.ok(title.text.includes("1d"));
    assert.ok(title.subtext.includes("MA"));
    assert.ok(title.subtext.includes("RSI"));
  });

  test("should include dataZoom for all panels", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["RSI", "MACD"],
    });

    assert.ok(option.dataZoom);
    assert.ok(Array.isArray(option.dataZoom));
    const dataZoom = (option.dataZoom as any[])[0];
    
    // Should zoom all x-axes (4 grids: main + volume + RSI + MACD)
    assert.strictEqual(dataZoom.xAxisIndex.length, 4);
  });

  test("should show legend", () => {
    const option = buildIndicatorsOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["MA"],
    });

    assert.ok(option.legend);
    const legend = option.legend as any;
    assert.strictEqual(legend.show, true);
  });

  test("should handle minimal data", () => {
    const minimalData = sampleData.slice(0, 30);
    const option = buildIndicatorsOption({
      data: minimalData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      indicators: ["MA"],
      maPeriods: [7],
    });

    assert.ok(option);
    assert.ok(option.series);
  });
});
