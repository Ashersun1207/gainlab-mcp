import { describe, test } from "node:test";
import assert from "node:assert";
import { buildOverlayOption, type OverlaySeriesData } from "../../src/render/charts/overlay.js";

describe("Overlay Chart Builder", () => {
  // Sample series data
  const btcData: OverlaySeriesData = {
    symbol: "BTC",
    market: "crypto",
    dates: Array.from({ length: 30 }, (_, i) => Date.now() - (30 - i) * 86400000),
    values: Array.from({ length: 30 }, (_, i) => 40000 + Math.sin(i * 0.2) * 5000),
  };

  const ethData: OverlaySeriesData = {
    symbol: "ETH",
    market: "crypto",
    dates: Array.from({ length: 30 }, (_, i) => Date.now() - (30 - i) * 86400000),
    values: Array.from({ length: 30 }, (_, i) => 2500 + Math.sin(i * 0.3) * 300),
  };

  const aaplData: OverlaySeriesData = {
    symbol: "AAPL",
    market: "us_stock",
    dates: Array.from({ length: 30 }, (_, i) => Date.now() - (30 - i) * 86400000),
    values: Array.from({ length: 30 }, (_, i) => 180 + Math.sin(i * 0.15) * 10),
  };

  test("should build normalized overlay chart with 2 assets", () => {
    const option = buildOverlayOption([btcData, ethData], true, "1d");

    assert.ok(option);
    assert.ok(option.series);
    assert.ok(Array.isArray(option.series));
    assert.strictEqual(option.series.length, 2);

    const series = option.series as any[];
    assert.strictEqual(series[0].name, "BTC (crypto)");
    assert.strictEqual(series[1].name, "ETH (crypto)");
    assert.strictEqual(series[0].type, "line");
    assert.strictEqual(series[1].type, "line");

    // Check Y-axis has % suffix
    const yAxis = option.yAxis as any;
    assert.ok(yAxis.name.includes("%"));
  });

  test("should build raw value overlay chart", () => {
    const option = buildOverlayOption([btcData, ethData], false, "1d");

    assert.ok(option);
    const yAxis = option.yAxis as any;
    assert.ok(yAxis.name);
    assert.ok(!yAxis.name.includes("%")); // No % for raw values
  });

  test("should build overlay chart with multiple assets from different markets", () => {
    const option = buildOverlayOption([btcData, ethData, aaplData], true, "1d");

    assert.ok(option);
    assert.strictEqual(option.series?.length, 3);

    const series = option.series as any[];
    assert.strictEqual(series[0].name, "BTC (crypto)");
    assert.strictEqual(series[1].name, "ETH (crypto)");
    assert.strictEqual(series[2].name, "AAPL (us_stock)");
  });

  test("should use different colors for each asset", () => {
    const option = buildOverlayOption([btcData, ethData, aaplData], true, "1d");

    const series = option.series as any[];
    const colors = series.map((s) => s.lineStyle.color);
    
    // All colors should be different
    assert.strictEqual(new Set(colors).size, 3);
  });

  test("should include title with normalization status", () => {
    const normalizedOption = buildOverlayOption([btcData, ethData], true, "1d");
    const rawOption = buildOverlayOption([btcData, ethData], false, "1d");

    const normalizedTitle = (normalizedOption.title as any).text;
    const rawTitle = (rawOption.title as any).text;

    assert.ok(normalizedTitle.includes("Normalized"));
    assert.ok(!rawTitle.includes("Normalized"));
  });

  test("should include legend with all asset names", () => {
    const option = buildOverlayOption([btcData, ethData, aaplData], true, "1d");

    assert.ok(option.legend);
    const legend = option.legend as any;
    assert.ok(Array.isArray(legend.data));
    assert.strictEqual(legend.data.length, 3);
    assert.ok(legend.data.includes("BTC (crypto)"));
    assert.ok(legend.data.includes("ETH (crypto)"));
    assert.ok(legend.data.includes("AAPL (us_stock)"));
  });

  test("should include dataZoom for interactive scrolling", () => {
    const option = buildOverlayOption([btcData, ethData], true, "1d");

    assert.ok(option.dataZoom);
    assert.ok(Array.isArray(option.dataZoom));
    assert.ok(option.dataZoom.length >= 2); // inside + slider

    const slider = (option.dataZoom as any[]).find((z) => z.type === "slider");
    assert.ok(slider);
  });

  test("should include tooltip showing all values", () => {
    const option = buildOverlayOption([btcData, ethData], true, "1d");

    assert.ok(option.tooltip);
    const tooltip = option.tooltip as any;
    assert.strictEqual(tooltip.trigger, "axis");
    assert.ok(tooltip.formatter); // Custom formatter for multi-value display
  });

  test("should handle date alignment with forward fill", () => {
    // Create data with different date ranges
    const series1: OverlaySeriesData = {
      symbol: "A",
      market: "crypto",
      dates: [1, 2, 3, 5, 6], // Missing 4
      values: [100, 101, 102, 105, 106],
    };

    const series2: OverlaySeriesData = {
      symbol: "B",
      market: "crypto",
      dates: [1, 3, 4, 6], // Missing 2 and 5
      values: [200, 203, 204, 206],
    };

    const option = buildOverlayOption([series1, series2], false, "1d");

    assert.ok(option);
    const series = option.series as any[];
    
    // Both series should have data for all unique dates [1, 2, 3, 4, 5, 6]
    assert.strictEqual(series[0].data.length, 6);
    assert.strictEqual(series[1].data.length, 6);
  });

  test("should normalize correctly to percentage change", () => {
    const simpleData: OverlaySeriesData = {
      symbol: "TEST",
      market: "crypto",
      dates: [1, 2, 3],
      values: [100, 110, 90], // +10%, -10% from start
    };

    const option = buildOverlayOption([simpleData], true, "1d");

    const series = option.series as any[];
    const values = series[0].data;

    // First value should be 0%
    assert.strictEqual(values[0], 0);
    // Second value should be +10%
    assert.ok(Math.abs(values[1] - 10) < 0.01);
    // Third value should be -10%
    assert.ok(Math.abs(values[2] - (-10)) < 0.01);
  });

  test("should set smooth line style", () => {
    const option = buildOverlayOption([btcData, ethData], true, "1d");

    const series = option.series as any[];
    assert.strictEqual(series[0].smooth, true);
    assert.strictEqual(series[1].smooth, true);
  });

  test("should hide symbols on line for cleaner look", () => {
    const option = buildOverlayOption([btcData, ethData], true, "1d");

    const series = option.series as any[];
    assert.strictEqual(series[0].showSymbol, false);
    assert.strictEqual(series[1].showSymbol, false);
  });

  test("should use GainLab theme colors", () => {
    const option = buildOverlayOption([btcData, ethData, aaplData], true, "1d");

    assert.ok(option.backgroundColor);
    const series = option.series as any[];
    
    // Each series should have a color from the palette
    series.forEach((s) => {
      assert.ok(s.lineStyle.color);
      assert.ok(s.itemStyle.color);
    });
  });
});
