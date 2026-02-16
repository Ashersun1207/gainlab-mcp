import { describe, test } from "node:test";
import assert from "node:assert";
import { buildFundamentalsOption } from "../../src/render/charts/fundamentals.js";
import type { FundamentalData } from "../../src/data/types.js";

describe("Fundamentals Chart Builder", () => {
  // Sample fundamental data for AAPL
  const aaplData: FundamentalData[] = [
    {
      period: "2024",
      metrics: {
        revenue: 394328000000,
        netIncome: 96995000000,
        grossProfitRatio: 0.461,
        operatingIncomeRatio: 0.307,
        eps: 6.13,
        ebitda: 131000000000,
      },
    },
    {
      period: "2023",
      metrics: {
        revenue: 383285000000,
        netIncome: 96995000000,
        grossProfitRatio: 0.443,
        operatingIncomeRatio: 0.298,
        eps: 6.11,
        ebitda: 125000000000,
      },
    },
    {
      period: "2022",
      metrics: {
        revenue: 394328000000,
        netIncome: 99803000000,
        grossProfitRatio: 0.433,
        operatingIncomeRatio: 0.302,
        eps: 6.11,
        ebitda: 130000000000,
      },
    },
  ];

  // Sample fundamental data for MSFT
  const msftData: FundamentalData[] = [
    {
      period: "2024",
      metrics: {
        revenue: 245122000000,
        netIncome: 88136000000,
        grossProfitRatio: 0.698,
        operatingIncomeRatio: 0.434,
        eps: 11.80,
        ebitda: 137000000000,
      },
    },
    {
      period: "2023",
      metrics: {
        revenue: 211915000000,
        netIncome: 72361000000,
        grossProfitRatio: 0.689,
        operatingIncomeRatio: 0.417,
        eps: 9.68,
        ebitda: 115000000000,
      },
    },
    {
      period: "2022",
      metrics: {
        revenue: 198270000000,
        netIncome: 72738000000,
        grossProfitRatio: 0.684,
        operatingIncomeRatio: 0.422,
        eps: 9.65,
        ebitda: 110000000000,
      },
    },
  ];

  test("should build single company, multiple metrics chart", () => {
    const dataMap = new Map([["AAPL", aaplData]]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL"],
      metrics: ["revenue", "net_income", "eps"],
      period: "annual",
    });

    assert.ok(option);
    assert.ok(option.series);
    assert.ok(Array.isArray(option.series));

    // Should have 3 series (revenue, net_income, eps)
    assert.strictEqual((option.series as any[]).length, 3);

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("Revenue"));
    assert.ok(seriesNames.includes("Net Income"));
    assert.ok(seriesNames.includes("EPS"));

    // Check title
    assert.ok(option.title);
    const title = option.title as any;
    assert.ok(title.text.includes("AAPL"));
  });

  test("should build multiple companies, single metric chart", () => {
    const dataMap = new Map([
      ["AAPL", aaplData],
      ["MSFT", msftData],
    ]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL", "MSFT"],
      metrics: ["revenue"],
      period: "annual",
    });

    assert.ok(option);
    assert.ok(option.series);

    // Should have 2 series (AAPL, MSFT)
    assert.strictEqual((option.series as any[]).length, 2);

    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("AAPL"));
    assert.ok(seriesNames.includes("MSFT"));

    // Check title
    const title = option.title as any;
    assert.ok(title.text.includes("Revenue"));
  });

  test("should build multiple companies, multiple metrics chart with sub-panels", () => {
    const dataMap = new Map([
      ["AAPL", aaplData],
      ["MSFT", msftData],
    ]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL", "MSFT"],
      metrics: ["revenue", "net_income"],
      period: "annual",
    });

    assert.ok(option);
    assert.ok(option.series);
    assert.ok(option.grid);
    assert.ok(option.xAxis);
    assert.ok(option.yAxis);

    // Should have 2 grids (one per metric)
    assert.strictEqual((option.grid as any[]).length, 2);
    assert.strictEqual((option.xAxis as any[]).length, 2);
    assert.strictEqual((option.yAxis as any[]).length, 2);

    // Should have 4 series (2 companies × 2 metrics)
    assert.strictEqual((option.series as any[]).length, 4);

    // Check Y-axis names
    const yAxisNames = (option.yAxis as any[]).map(y => y.name);
    assert.ok(yAxisNames.includes("Revenue"));
    assert.ok(yAxisNames.includes("Net Income"));
  });

  test("should handle gross_margin metric (ratio format)", () => {
    const dataMap = new Map([["AAPL", aaplData]]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL"],
      metrics: ["gross_margin"],
      period: "annual",
    });

    assert.ok(option);
    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("Gross Margin"));
  });

  test("should handle operating_margin metric (ratio format)", () => {
    const dataMap = new Map([["AAPL", aaplData]]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL"],
      metrics: ["operating_margin"],
      period: "annual",
    });

    assert.ok(option);
    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("Operating Margin"));
  });

  test("should handle ebitda metric", () => {
    const dataMap = new Map([["AAPL", aaplData]]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL"],
      metrics: ["ebitda"],
      period: "annual",
    });

    assert.ok(option);
    const seriesNames = (option.series as any[]).map(s => s.name);
    assert.ok(seriesNames.includes("EBITDA"));
  });

  test("should include legend for multiple series", () => {
    const dataMap = new Map([["AAPL", aaplData]]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL"],
      metrics: ["revenue", "net_income"],
      period: "annual",
    });

    assert.ok(option.legend);
    const legend = option.legend as any;
    assert.ok(legend.textStyle);
  });

  test("should include tooltip configuration", () => {
    const dataMap = new Map([["AAPL", aaplData]]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL"],
      metrics: ["revenue"],
      period: "annual",
    });

    assert.ok(option.tooltip);
    const tooltip = option.tooltip as any;
    assert.strictEqual(tooltip.trigger, "axis");
    assert.ok(tooltip.formatter);
  });

  test("should apply theme colors correctly", () => {
    const dataMap = new Map([
      ["AAPL", aaplData],
      ["MSFT", msftData],
    ]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL", "MSFT"],
      metrics: ["revenue"],
      period: "annual",
    });

    assert.ok(option.backgroundColor);
    const series = option.series as any[];
    assert.ok(series[0].itemStyle.color);
    assert.ok(series[1].itemStyle.color);
  });

  test("should include data labels on bars", () => {
    const dataMap = new Map([["AAPL", aaplData]]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL"],
      metrics: ["revenue"],
      period: "annual",
    });

    const series = option.series as any[];
    assert.ok(series[0].label);
    assert.strictEqual(series[0].label.show, true);
    assert.strictEqual(series[0].label.position, "top");
  });

  test("should handle missing data gracefully", () => {
    const partialData: FundamentalData[] = [
      {
        period: "2024",
        metrics: {
          revenue: 394328000000,
          netIncome: null,  // Missing data
          eps: 6.13,
        },
      },
    ];
    const dataMap = new Map([["AAPL", partialData]]);
    
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL"],
      metrics: ["revenue", "net_income", "eps"],
      period: "annual",
    });

    assert.ok(option);
    assert.ok(option.series);
  });

  test("should include dataZoom for multi-panel charts", () => {
    const dataMap = new Map([
      ["AAPL", aaplData],
      ["MSFT", msftData],
    ]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL", "MSFT"],
      metrics: ["revenue", "net_income"],
      period: "annual",
    });

    assert.ok(option.dataZoom);
    assert.ok(Array.isArray(option.dataZoom));
    const dataZoom = (option.dataZoom as any[])[0];
    assert.strictEqual(dataZoom.type, "inside");
    assert.strictEqual(dataZoom.xAxisIndex.length, 2);
  });

  test("should sort periods in reverse chronological order", () => {
    const dataMap = new Map([["AAPL", aaplData]]);
    const option = buildFundamentalsOption({
      data: dataMap,
      symbols: ["AAPL"],
      metrics: ["revenue"],
      period: "annual",
    });

    const xAxis = (option.xAxis as any);
    const periods = xAxis.data;
    
    // Periods should be sorted with most recent first
    assert.ok(periods[0] >= periods[periods.length - 1]);
  });
});
