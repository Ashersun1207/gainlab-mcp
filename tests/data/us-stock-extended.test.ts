import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getUSStockCashFlow,
  getUSStockKeyMetrics,
  getUSStockDCF,
  getUSStockAnalystEstimates,
} from "../../src/data/us-stock.js";

describe("US Stock Extended Data", () => {
  it("should get cash flow data for AAPL", async () => {
    const data = await getUSStockCashFlow("AAPL", "annual", 3);
    
    assert.ok(Array.isArray(data), "Should return an array");
    assert.ok(data.length > 0, "Should have at least one entry");
    
    const item = data[0];
    assert.ok(item.period, "Should have period");
    assert.ok(item.metrics, "Should have metrics");
    
    // Check expected cash flow fields
    assert.ok(
      item.metrics.operatingCashFlow !== undefined,
      "Should have operatingCashFlow"
    );
    assert.ok(
      item.metrics.freeCashFlow !== undefined,
      "Should have freeCashFlow"
    );
    assert.ok(
      item.metrics.capitalExpenditure !== undefined,
      "Should have capitalExpenditure"
    );
    
    // Check that negative values are converted to positive
    if (item.metrics.capitalExpenditure !== null) {
      assert.ok(
        item.metrics.capitalExpenditure >= 0,
        "capitalExpenditure should be positive"
      );
    }
  });

  it("should get key metrics data for AAPL", async () => {
    const data = await getUSStockKeyMetrics("AAPL", "annual", 3);
    
    assert.ok(Array.isArray(data), "Should return an array");
    assert.ok(data.length > 0, "Should have at least one entry");
    
    const item = data[0];
    assert.ok(item.period, "Should have period");
    assert.ok(item.metrics, "Should have metrics");
    
    // Check expected key metrics fields
    assert.ok(
      item.metrics.marketCap !== undefined,
      "Should have marketCap"
    );
    assert.ok(
      item.metrics.peRatio !== undefined,
      "Should have peRatio"
    );
    assert.ok(
      item.metrics.pbRatio !== undefined,
      "Should have pbRatio"
    );
    assert.ok(
      item.metrics.returnOnEquity !== undefined,
      "Should have returnOnEquity"
    );
  });

  it("should get DCF data for AAPL", async () => {
    const data = await getUSStockDCF("AAPL");
    
    assert.ok(data, "Should return data");
    assert.strictEqual(data.symbol, "AAPL", "Should have correct symbol");
    assert.ok(data.date, "Should have date");
    assert.ok(typeof data.dcf === "number", "DCF should be a number");
    assert.ok(typeof data.stockPrice === "number", "stockPrice should be a number");
  });

  it("should get analyst estimates for AAPL", async () => {
    const data = await getUSStockAnalystEstimates("AAPL", "annual", 2);
    
    assert.ok(Array.isArray(data), "Should return an array");
    assert.ok(data.length > 0, "Should have at least one entry");
    
    const item = data[0];
    assert.ok(item.period, "Should have period");
    assert.ok(item.metrics, "Should have metrics");
    
    // Check expected analyst estimate fields
    assert.ok(
      item.metrics.revenueAvg !== undefined,
      "Should have revenueAvg"
    );
    assert.ok(
      item.metrics.epsAvg !== undefined,
      "Should have epsAvg"
    );
  });

  it("should get quarterly cash flow data", async () => {
    const data = await getUSStockCashFlow("MSFT", "quarter", 4);
    
    assert.ok(Array.isArray(data), "Should return an array");
    assert.ok(data.length > 0, "Should have at least one entry");
    
    const item = data[0];
    // Check period format for quarterly data (e.g., "2024-Q1")
    assert.ok(
      /^\d{4}-Q[1-4]$/.test(item.period),
      "Quarterly period should match format YYYY-Q#"
    );
  });
});
