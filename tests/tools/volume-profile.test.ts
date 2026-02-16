// Integration tests for Volume Profile tool (chart builder + VP calculation)

import { describe, test } from "node:test";
import assert from "node:assert";
import { buildVolumeProfileOption } from "../../src/render/charts/volume-profile.js";
import { calculateVolumeProfile } from "../../src/utils/volume-profile.js";
import type { OHLCV } from "../../src/data/types.js";

describe("Volume Profile Tool Integration", () => {
  // Sample K-line data
  const sampleData: OHLCV[] = Array.from({ length: 120 }, (_, i) => ({
    timestamp: Date.now() - (120 - i) * 86400000,
    open: 100 + Math.sin(i * 0.1) * 10,
    high: 105 + Math.sin(i * 0.1) * 10,
    low: 95 + Math.sin(i * 0.1) * 10,
    close: 100 + Math.sin(i * 0.1) * 10 + (i % 2 === 0 ? 1 : -1),
    volume: 1000000 + Math.random() * 500000,
  }));

  test("should build complete VP chart option", () => {
    const vpResult = calculateVolumeProfile(sampleData, 24, 0.7);
    const option = buildVolumeProfileOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      vpResult,
    });

    assert.ok(option);
    assert.ok(option.grid);
    assert.ok(option.series);
    assert.ok(option.xAxis);
    assert.ok(option.yAxis);
  });

  test("should have 3 grids: kline, volume, VP bars", () => {
    const vpResult = calculateVolumeProfile(sampleData, 24, 0.7);
    const option = buildVolumeProfileOption({
      data: sampleData,
      symbol: "AAPL",
      timeframe: "1d",
      vpResult,
    });

    assert.strictEqual((option.grid as any[]).length, 3);
    assert.strictEqual((option.xAxis as any[]).length, 3);
    assert.strictEqual((option.yAxis as any[]).length, 3);
  });

  test("should have K-line, Volume, Buy Volume, and Sell Volume series", () => {
    const vpResult = calculateVolumeProfile(sampleData, 24, 0.7);
    const option = buildVolumeProfileOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      vpResult,
    });

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("K Line"));
    assert.ok(seriesNames.includes("Volume"));
    assert.ok(seriesNames.includes("Buy Volume"));
    assert.ok(seriesNames.includes("Sell Volume"));
  });

  test("should include markLine for POC, VAH, VAL", () => {
    const vpResult = calculateVolumeProfile(sampleData, 24, 0.7);
    const option = buildVolumeProfileOption({
      data: sampleData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      vpResult,
    });

    const klineSeries = (option.series as any[]).find(s => s.name === "K Line");
    assert.ok(klineSeries.markLine, "K-line should have markLine");
    assert.strictEqual(klineSeries.markLine.data.length, 3, "Should have 3 markLines (POC, VAH, VAL)");
  });

  test("should include title with symbol and VP info", () => {
    const vpResult = calculateVolumeProfile(sampleData, 24, 0.7);
    const option = buildVolumeProfileOption({
      data: sampleData,
      symbol: "ETHUSDT",
      timeframe: "4h",
      vpResult,
    });

    const title = option.title as any;
    assert.ok(title.text.includes("ETHUSDT"));
    assert.ok(title.text.includes("Volume Profile"));
    assert.ok(title.subtext.includes("POC"));
    assert.ok(title.subtext.includes("VAH"));
    assert.ok(title.subtext.includes("VAL"));
  });

  test("should work with different row counts", () => {
    for (const rows of [10, 24, 50]) {
      const vpResult = calculateVolumeProfile(sampleData, rows, 0.7);
      const option = buildVolumeProfileOption({
        data: sampleData,
        symbol: "BTCUSDT",
        timeframe: "1d",
        vpResult,
      });
      assert.ok(option.series);
      // Buy Volume + Sell Volume data should match row count
      const buyVolSeries = (option.series as any[]).find(s => s.name === "Buy Volume");
      assert.strictEqual(buyVolSeries.data.length, rows);
    }
  });

  test("should handle minimal data (30 candles)", () => {
    const minData = sampleData.slice(0, 30);
    const vpResult = calculateVolumeProfile(minData, 10, 0.7);
    const option = buildVolumeProfileOption({
      data: minData,
      symbol: "BTCUSDT",
      timeframe: "1d",
      vpResult,
    });
    assert.ok(option);
    assert.ok((option.series as any[]).length >= 4);
  });
});
