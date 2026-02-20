import { test } from "node:test";
import assert from "node:assert";
import { getUSStockKlines, getUSStockFundamentals } from "../../src/data/us-stock.js";
import { apiTest } from "../helpers/api-guard.js";

apiTest("getUSStockKlines - AAPL", async () => {
  const result = await getUSStockKlines("AAPL", 10);
  
  console.log(`✓ Fetched ${result.length} AAPL klines`);
  console.log("  Sample:", result[result.length - 1]);
  
  assert.ok(Array.isArray(result), "Should return array");
  assert.ok(result.length > 0, "Should return data");
  assert.ok(result.length <= 10, "Should respect limit");
  
  const latest = result[result.length - 1];
  assert.ok(typeof latest.timestamp === "number", "timestamp should be number");
  assert.ok(latest.timestamp > 0, "timestamp should be positive");
  assert.ok(typeof latest.open === "number", "open should be number");
  assert.ok(typeof latest.high === "number", "high should be number");
  assert.ok(typeof latest.low === "number", "low should be number");
  assert.ok(typeof latest.close === "number", "close should be number");
  assert.ok(typeof latest.volume === "number", "volume should be number");
  
  // Validate price relationships
  assert.ok(latest.high >= latest.low, "high should >= low");
  assert.ok(latest.high >= latest.open, "high should >= open");
  assert.ok(latest.high >= latest.close, "high should >= close");
  assert.ok(latest.low <= latest.open, "low should <= open");
  assert.ok(latest.low <= latest.close, "low should <= close");
  
  console.log("  ✓ All validations passed");
});

apiTest("getUSStockKlines - TSLA", async () => {
  const result = await getUSStockKlines("TSLA", 5);
  
  console.log(`✓ Fetched ${result.length} TSLA klines`);
  
  assert.ok(result.length > 0, "Should return data");
  assert.ok(result.length <= 5, "Should respect limit");
});

apiTest("getUSStockFundamentals - AAPL annual", async () => {
  const result = await getUSStockFundamentals("AAPL", "annual", 3);
  
  console.log(`✓ Fetched ${result.length} AAPL annual reports`);
  console.log("  Periods:", result.map(r => r.period).join(", "));
  console.log("  Sample metrics:", Object.keys(result[0].metrics).slice(0, 5).join(", "));
  
  assert.ok(Array.isArray(result), "Should return array");
  assert.ok(result.length > 0, "Should return data");
  assert.ok(result.length <= 3, "Should respect limit");
  
  const latest = result[0];
  assert.ok(typeof latest.period === "string", "period should be string");
  assert.ok(/^\d{4}$/.test(latest.period), "annual period should be YYYY format");
  assert.ok(typeof latest.metrics === "object", "metrics should be object");
  
  // Check key metrics exist
  assert.ok("revenue" in latest.metrics, "should have revenue");
  assert.ok("netIncome" in latest.metrics, "should have netIncome");
  assert.ok("eps" in latest.metrics, "should have eps");
  
  console.log("  ✓ All validations passed");
});

apiTest("getUSStockFundamentals - MSFT quarterly", async () => {
  const result = await getUSStockFundamentals("MSFT", "quarter", 2);
  
  console.log(`✓ Fetched ${result.length} MSFT quarterly reports`);
  console.log("  Periods:", result.map(r => r.period).join(", "));
  
  assert.ok(result.length > 0, "Should return data");
  assert.ok(result.length <= 2, "Should respect limit");
  
  const latest = result[0];
  // Quarterly period should match YYYY-Qx format
  assert.ok(/^\d{4}-Q\d$/.test(latest.period), "quarterly period should be YYYY-Qx format");
  
  console.log("  ✓ All validations passed");
});

test("getUSStockKlines - error handling (no API key)", async () => {
  const originalKey = process.env.FMP_API_KEY;
  delete process.env.FMP_API_KEY;
  
  try {
    await getUSStockKlines("AAPL", 10);
    assert.fail("Should throw error when API key is missing");
  } catch (err: any) {
    assert.ok(err.message.includes("FMP_API_KEY"), "Error should mention FMP_API_KEY");
    console.log("  ✓ Correctly throws error when API key is missing");
  } finally {
    if (originalKey) {
      process.env.FMP_API_KEY = originalKey;
    }
  }
});
