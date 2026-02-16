import { test } from "node:test";
import assert from "node:assert";
import { getCommodityKlines } from "../../src/data/commodity.js";

test("getCommodityKlines - XAUUSD (Gold)", async () => {
  const result = await getCommodityKlines("XAUUSD", 10);
  
  console.log(`✓ Fetched ${result.length} XAUUSD (Gold) klines`);
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
  
  // Gold price should be in reasonable range (rough sanity check)
  assert.ok(latest.close > 1000, "Gold price should be > 1000");
  assert.ok(latest.close < 10000, "Gold price should be < 10000");
  
  console.log("  ✓ All validations passed");
});

test("getCommodityKlines - XAGUSD (Silver)", async () => {
  const result = await getCommodityKlines("XAGUSD", 5);
  
  console.log(`✓ Fetched ${result.length} XAGUSD (Silver) klines`);
  console.log("  Sample:", result[result.length - 1]);
  
  assert.ok(result.length > 0, "Should return data");
  assert.ok(result.length <= 5, "Should respect limit");
  
  const latest = result[result.length - 1];
  
  // Silver price should be in reasonable range
  assert.ok(latest.close > 10, "Silver price should be > 10");
  assert.ok(latest.close < 100, "Silver price should be < 100");
  
  console.log("  ✓ All validations passed");
});

test("getCommodityKlines - with .FOREX suffix", async () => {
  // Test that we can pass symbol with .FOREX suffix directly
  const result = await getCommodityKlines("XAUUSD.FOREX", 3);
  
  console.log(`✓ Fetched ${result.length} XAUUSD.FOREX klines (with suffix)`);
  
  assert.ok(result.length > 0, "Should return data");
  assert.ok(result.length <= 3, "Should respect limit");
});

test("getCommodityKlines - error handling (no API key)", async () => {
  const originalKey = process.env.EODHD_API_KEY;
  delete process.env.EODHD_API_KEY;
  
  try {
    await getCommodityKlines("XAUUSD", 10);
    assert.fail("Should throw error when API key is missing");
  } catch (err: any) {
    assert.ok(err.message.includes("EODHD_API_KEY"), "Error should mention EODHD_API_KEY");
    console.log("  ✓ Correctly throws error when API key is missing");
  } finally {
    if (originalKey) {
      process.env.EODHD_API_KEY = originalKey;
    }
  }
});

test("getCommodityKlines - invalid symbol error handling", async () => {
  try {
    await getCommodityKlines("INVALID_SYMBOL_12345", 10);
    assert.fail("Should throw error for invalid symbol");
  } catch (err: any) {
    assert.ok(err.message.includes("EODHD API error"), "Error should mention EODHD API error");
    console.log("  ✓ Correctly handles invalid symbol");
  }
});
