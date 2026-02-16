import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildKlineOption } from "../../src/render/charts/kline.js";
import type { OHLCV } from "../../src/data/types.js";

function makeFakeCandles(n: number): OHLCV[] {
  const candles: OHLCV[] = [];
  let price = 100;
  const baseTime = Date.now() - n * 86400000;
  for (let i = 0; i < n; i++) {
    const open = price;
    const close = price + (Math.random() - 0.5) * 10;
    const high = Math.max(open, close) + Math.random() * 5;
    const low = Math.min(open, close) - Math.random() * 5;
    candles.push({
      timestamp: baseTime + i * 86400000,
      open, high, low, close,
      volume: Math.random() * 1000000,
    });
    price = close;
  }
  return candles;
}

describe("buildKlineOption", () => {
  it("returns ECharts option with candlestick and volume series", () => {
    const data = makeFakeCandles(30);
    const option = buildKlineOption(data, "BTCUSDT", "1d");

    assert.ok(option.series, "should have series");
    const series = option.series as any[];
    assert.equal(series.length, 2, "should have 2 series (kline + volume)");
    assert.equal(series[0].type, "candlestick", "first series should be candlestick");
    assert.equal(series[1].type, "bar", "second series should be bar (volume)");
  });

  it("candlestick data matches input length", () => {
    const data = makeFakeCandles(50);
    const option = buildKlineOption(data, "ETHUSDT", "4h");
    const series = option.series as any[];
    assert.equal(series[0].data.length, 50, "candlestick data length should match input");
    assert.equal(series[1].data.length, 50, "volume data length should match input");
  });

  it("includes title with symbol and timeframe", () => {
    const data = makeFakeCandles(10);
    const option = buildKlineOption(data, "SOLUSDT", "1w");
    const title = option.title as any;
    assert.ok(title.text.includes("SOLUSDT"), "title should include symbol");
    assert.ok(title.text.includes("1w"), "title should include timeframe");
  });

  it("has dual grid layout (kline + volume)", () => {
    const data = makeFakeCandles(10);
    const option = buildKlineOption(data, "TEST", "1d");
    const grid = option.grid as any[];
    assert.equal(grid.length, 2, "should have 2 grids");
  });

  it("has dataZoom for interactive scrolling", () => {
    const data = makeFakeCandles(10);
    const option = buildKlineOption(data, "TEST", "1d");
    assert.ok(option.dataZoom, "should have dataZoom");
    const dz = option.dataZoom as any[];
    assert.ok(dz.length > 0, "should have at least one dataZoom");
  });
});
