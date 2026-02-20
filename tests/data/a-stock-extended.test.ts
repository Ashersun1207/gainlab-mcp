import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getAStockCashFlow,
  getAStockKeyMetrics,
} from "../../src/data/a-stock.js";
import { apiTest } from "../helpers/api-guard.js";

describe("A-Stock Extended Data", () => {
  apiTest("should get cash flow data for 600519 (Moutai)", async () => {
    const data = await getAStockCashFlow("600519", "annual", 3);
    
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
    
    // Check that values are numbers (parsed from strings)
    if (item.metrics.operatingCashFlow !== null) {
      assert.ok(
        typeof item.metrics.operatingCashFlow === "number",
        "operatingCashFlow should be a number"
      );
    }
    
    // Check that negative values are converted to positive
    if (item.metrics.capitalExpenditure !== null) {
      assert.ok(
        item.metrics.capitalExpenditure >= 0,
        "capitalExpenditure should be positive"
      );
    }
  });

  apiTest("should get key metrics data for 600519 (Moutai)", async () => {
    const data = await getAStockKeyMetrics("600519");
    
    assert.ok(data, "Should return data");
    assert.strictEqual(data.period, "latest", "Should have period 'latest'");
    assert.ok(data.metrics, "Should have metrics");
    
    // Check expected key metrics fields from Highlights
    assert.ok(
      data.metrics.peRatio !== undefined,
      "Should have peRatio"
    );
    assert.ok(
      data.metrics.returnOnEquity !== undefined,
      "Should have returnOnEquity"
    );
    assert.ok(
      data.metrics.marketCap !== undefined,
      "Should have marketCap"
    );
    
    // Check expected key metrics fields from Valuation
    assert.ok(
      data.metrics.pbRatio !== undefined,
      "Should have pbRatio"
    );
    assert.ok(
      data.metrics.evToEbitda !== undefined,
      "Should have evToEbitda"
    );
    
    // Check that values are numbers (parsed from strings)
    if (data.metrics.peRatio !== null) {
      assert.ok(
        typeof data.metrics.peRatio === "number",
        "peRatio should be a number"
      );
    }
  });

  apiTest("should get quarterly cash flow data", async () => {
    const data = await getAStockCashFlow("000001", "quarter", 4);
    
    assert.ok(Array.isArray(data), "Should return an array");
    assert.ok(data.length > 0, "Should have at least one entry");
    
    const item = data[0];
    // Check period format for quarterly data (e.g., "2024-Q1")
    assert.ok(
      /^\d{4}-Q[1-4]$/.test(item.period),
      "Quarterly period should match format YYYY-Q#"
    );
  });

  apiTest("should handle symbol with exchange suffix", async () => {
    const data = await getAStockCashFlow("600519.SHG", "annual", 2);
    
    assert.ok(Array.isArray(data), "Should return an array");
    assert.ok(data.length > 0, "Should have at least one entry");
  });
});
