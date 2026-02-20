import { describe, it, before } from "node:test";
import assert from "node:assert";
import { getAStockKlines, getAStockFundamentals } from "../../src/data/a-stock.js";
import { apiTest } from "../helpers/api-guard.js";

describe("A-Stock Data Layer (EODHD)", () => {
  before(() => {
    // Verify EODHD_API_KEY is available
    if (!process.env.EODHD_API_KEY) {
      throw new Error(
        "EODHD_API_KEY not found. Please set it in ~/.openclaw/.env"
      );
    }
  });

  describe("getAStockKlines", () => {
    apiTest("should fetch Shanghai stock klines with bare code (600519)", async () => {
      const symbol = "600519"; // 贵州茅台
      const limit = 10;
      const klines = await getAStockKlines(symbol, limit);

      assert.ok(Array.isArray(klines), "Should return an array");
      assert.ok(klines.length > 0, "Should have at least one data point");
      assert.ok(klines.length <= limit, `Should not exceed limit of ${limit}`);

      // Verify structure
      const first = klines[0];
      assert.ok(typeof first.timestamp === "number", "timestamp should be a number");
      assert.ok(typeof first.open === "number", "open should be a number");
      assert.ok(typeof first.high === "number", "high should be a number");
      assert.ok(typeof first.low === "number", "low should be a number");
      assert.ok(typeof first.close === "number", "close should be a number");
      assert.ok(typeof first.volume === "number", "volume should be a number");

      // Verify timestamp is in milliseconds (Unix ms)
      assert.ok(first.timestamp > 1000000000000, "timestamp should be in milliseconds");

      // Verify data is sorted chronologically
      for (let i = 1; i < klines.length; i++) {
        assert.ok(
          klines[i].timestamp >= klines[i - 1].timestamp,
          "Data should be sorted chronologically"
        );
      }

      console.log(`✓ Fetched ${klines.length} klines for ${symbol}`);
      console.log(`  Latest: ${new Date(klines[klines.length - 1].timestamp).toISOString().split("T")[0]}, Close: ${klines[klines.length - 1].close}`);
    });

    apiTest("should fetch Shanghai stock klines with full symbol (600519.SHG)", async () => {
      const symbol = "600519.SHG"; // 贵州茅台 (explicit)
      const limit = 5;
      const klines = await getAStockKlines(symbol, limit);

      assert.ok(Array.isArray(klines), "Should return an array");
      assert.ok(klines.length > 0, "Should have at least one data point");
      assert.ok(klines.length <= limit, `Should not exceed limit of ${limit}`);

      console.log(`✓ Fetched ${klines.length} klines for ${symbol}`);
    });

    apiTest("should fetch Shenzhen stock klines with bare code (000001)", async () => {
      const symbol = "000001"; // 平安银行
      const limit = 10;
      const klines = await getAStockKlines(symbol, limit);

      assert.ok(Array.isArray(klines), "Should return an array");
      assert.ok(klines.length > 0, "Should have at least one data point");
      assert.ok(klines.length <= limit, `Should not exceed limit of ${limit}`);

      console.log(`✓ Fetched ${klines.length} klines for ${symbol}`);
      console.log(`  Latest: ${new Date(klines[klines.length - 1].timestamp).toISOString().split("T")[0]}, Close: ${klines[klines.length - 1].close}`);
    });

    apiTest("should fetch Shenzhen stock klines with full symbol (000001.SHE)", async () => {
      const symbol = "000001.SHE"; // 平安银行 (explicit)
      const limit = 5;
      const klines = await getAStockKlines(symbol, limit);

      assert.ok(Array.isArray(klines), "Should return an array");
      assert.ok(klines.length > 0, "Should have at least one data point");

      console.log(`✓ Fetched ${klines.length} klines for ${symbol}`);
    });

    it("should handle invalid symbol gracefully", async () => {
      const symbol = "INVALID999";
      
      await assert.rejects(
        async () => await getAStockKlines(symbol, 10),
        /EODHD API error/,
        "Should throw EODHD API error for invalid symbol"
      );

      console.log(`✓ Invalid symbol handled correctly`);
    });
  });

  describe("getAStockFundamentals", () => {
    apiTest("should fetch annual fundamentals for Shanghai stock (600519)", async () => {
      const symbol = "600519"; // 贵州茅台
      const period = "annual";
      const limit = 3;
      const fundamentals = await getAStockFundamentals(symbol, period, limit);

      assert.ok(Array.isArray(fundamentals), "Should return an array");
      assert.ok(fundamentals.length > 0, "Should have at least one period");
      assert.ok(fundamentals.length <= limit, `Should not exceed limit of ${limit}`);

      // Verify structure
      const first = fundamentals[0];
      assert.ok(typeof first.period === "string", "period should be a string");
      assert.ok(first.period.match(/^\d{4}$/), "Annual period should be in YYYY format");
      assert.ok(typeof first.metrics === "object", "metrics should be an object");
      
      // Verify key metrics exist
      assert.ok("totalRevenue" in first.metrics, "Should have totalRevenue metric");
      assert.ok("netIncome" in first.metrics, "Should have netIncome metric");

      console.log(`✓ Fetched ${fundamentals.length} annual periods for ${symbol}`);
      fundamentals.forEach(f => {
        console.log(`  ${f.period}: Revenue=${f.metrics.totalRevenue}, NetIncome=${f.metrics.netIncome}`);
      });
    });

    apiTest("should fetch quarterly fundamentals for Shenzhen stock (000001)", async () => {
      const symbol = "000001"; // 平安银行
      const period = "quarter";
      const limit = 4;
      const fundamentals = await getAStockFundamentals(symbol, period, limit);

      assert.ok(Array.isArray(fundamentals), "Should return an array");
      assert.ok(fundamentals.length > 0, "Should have at least one period");

      // Verify structure
      const first = fundamentals[0];
      assert.ok(typeof first.period === "string", "period should be a string");
      assert.ok(first.period.match(/^\d{4}-Q[1-4]$/), "Quarterly period should be in YYYY-Q# format");
      
      console.log(`✓ Fetched ${fundamentals.length} quarterly periods for ${symbol}`);
      fundamentals.forEach(f => {
        console.log(`  ${f.period}: Revenue=${f.metrics.totalRevenue}, NetIncome=${f.metrics.netIncome}`);
      });
    });

    apiTest("should fetch fundamentals with full symbol (600519.SHG)", async () => {
      const symbol = "600519.SHG";
      const fundamentals = await getAStockFundamentals(symbol, "annual", 2);

      assert.ok(Array.isArray(fundamentals), "Should return an array");
      assert.ok(fundamentals.length > 0, "Should have at least one period");

      console.log(`✓ Fetched ${fundamentals.length} annual periods for ${symbol}`);
    });

    it("should handle invalid symbol gracefully", async () => {
      const symbol = "INVALID999";
      
      await assert.rejects(
        async () => await getAStockFundamentals(symbol, "annual", 5),
        /EODHD API error/,
        "Should throw EODHD API error for invalid symbol"
      );

      console.log(`✓ Invalid symbol handled correctly`);
    });
  });
});
