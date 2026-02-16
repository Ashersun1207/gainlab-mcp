// Tests for Volume Profile calculation logic

import { describe, test } from "node:test";
import assert from "node:assert";
import { calculateVolumeProfile } from "../../src/utils/volume-profile.js";
import type { OHLCV } from "../../src/data/types.js";

describe("Volume Profile Calculation", () => {
  // Helper: create a simple candle
  function candle(open: number, high: number, low: number, close: number, volume: number, ts = 0): OHLCV {
    return { timestamp: ts, open, high, low, close, volume };
  }

  describe("basic computation", () => {
    test("should return empty result for empty data", () => {
      const result = calculateVolumeProfile([], 24, 0.7);
      assert.strictEqual(result.rows.length, 0);
      assert.strictEqual(result.poc, 0);
      assert.strictEqual(result.vah, 0);
      assert.strictEqual(result.val, 0);
      assert.strictEqual(result.totalVolume, 0);
    });

    test("should create correct number of rows", () => {
      const data: OHLCV[] = [
        candle(100, 110, 90, 105, 1000),
        candle(105, 115, 95, 100, 2000),
      ];
      const result = calculateVolumeProfile(data, 10, 0.7);
      assert.strictEqual(result.rows.length, 10);
    });

    test("should have rows covering the full price range", () => {
      const data: OHLCV[] = [
        candle(100, 120, 80, 110, 1000),
      ];
      const result = calculateVolumeProfile(data, 10, 0.7);
      assert.ok(Math.abs(result.rows[0].priceMin - 80) < 0.001);
      assert.ok(Math.abs(result.rows[9].priceMax - 120) < 0.001);
    });

    test("should distribute total volume correctly", () => {
      const data: OHLCV[] = [
        candle(100, 110, 90, 105, 1000),
        candle(105, 115, 95, 100, 2000),
      ];
      const result = calculateVolumeProfile(data, 10, 0.7);
      assert.strictEqual(result.totalVolume, 3000);

      // Sum of row volumes should approximately equal totalVolume
      const rowVolumeSum = result.rows.reduce((sum, r) => sum + r.volume, 0);
      assert.ok(Math.abs(rowVolumeSum - 3000) < 1, `Row volume sum ${rowVolumeSum} should be ~3000`);
    });

    test("should separate buy and sell volume correctly", () => {
      // Bullish candle (close > open) → buyVolume
      // Bearish candle (close <= open) → sellVolume
      const data: OHLCV[] = [
        candle(100, 110, 100, 110, 1000), // bullish
        candle(110, 110, 100, 100, 2000), // bearish
      ];
      const result = calculateVolumeProfile(data, 10, 0.7);

      const totalBuy = result.rows.reduce((sum, r) => sum + r.buyVolume, 0);
      const totalSell = result.rows.reduce((sum, r) => sum + r.sellVolume, 0);
      assert.ok(Math.abs(totalBuy - 1000) < 1, `Total buy volume should be ~1000, got ${totalBuy}`);
      assert.ok(Math.abs(totalSell - 2000) < 1, `Total sell volume should be ~2000, got ${totalSell}`);
    });

    test("should have row volume = buyVolume + sellVolume for each row", () => {
      const data: OHLCV[] = [
        candle(100, 120, 80, 115, 5000),
        candle(115, 125, 85, 90, 3000),
      ];
      const result = calculateVolumeProfile(data, 20, 0.7);
      for (const row of result.rows) {
        assert.ok(
          Math.abs(row.volume - (row.buyVolume + row.sellVolume)) < 0.01,
          `Row volume ${row.volume} should equal buy+sell ${row.buyVolume + row.sellVolume}`
        );
      }
    });
  });

  describe("POC calculation", () => {
    test("should find POC at the highest volume row", () => {
      // Candle concentrated at 100-110 range with huge volume
      // Other candle spans wider with less volume per row
      const data: OHLCV[] = [
        candle(100, 105, 100, 104, 10000), // concentrated volume in narrow range
        candle(80, 120, 80, 115, 1000),    // spread volume across wide range
      ];
      const result = calculateVolumeProfile(data, 10, 0.7);
      // POC should be near 100-105 range
      assert.ok(result.poc >= 100 && result.poc <= 108, `POC ${result.poc} should be in 100-108 range`);
    });

    test("should set POC to priceMid of highest volume row", () => {
      const data: OHLCV[] = [
        candle(100, 100, 100, 100, 5000), // doji at 100
        candle(200, 200, 200, 200, 1000), // doji at 200
      ];
      const result = calculateVolumeProfile(data, 10, 0.7);
      // POC should be at the row containing price 100
      const pocRow = result.rows.find(r => Math.abs(r.priceMid - result.poc) < 0.01);
      assert.ok(pocRow, "POC should correspond to an actual row");
      // The row containing 100 should have the most volume
      assert.ok(pocRow!.volume >= 5000, `POC row volume ${pocRow!.volume} should be >= 5000`);
    });
  });

  describe("Value Area calculation", () => {
    test("should have VAH >= POC and VAL <= POC", () => {
      const data: OHLCV[] = Array.from({ length: 50 }, (_, i) => 
        candle(100 + i * 0.5, 105 + i * 0.5, 95 + i * 0.5, 102 + i * 0.5, 1000 + Math.random() * 500)
      );
      const result = calculateVolumeProfile(data, 20, 0.7);
      assert.ok(result.vah >= result.poc, `VAH ${result.vah} should be >= POC ${result.poc}`);
      assert.ok(result.val <= result.poc, `VAL ${result.val} should be <= POC ${result.poc}`);
    });

    test("should contain approximately the target percentage of volume", () => {
      const data: OHLCV[] = Array.from({ length: 100 }, (_, i) => 
        candle(100 + Math.sin(i * 0.1) * 20, 110 + Math.sin(i * 0.1) * 20, 90 + Math.sin(i * 0.1) * 20, 105 + Math.sin(i * 0.1) * 20, 1000)
      );
      const result = calculateVolumeProfile(data, 24, 0.7);
      
      // Sum volume in value area rows
      const vaVolume = result.rows
        .filter(r => r.priceMin >= result.val - 0.001 && r.priceMax <= result.vah + 0.001)
        .reduce((sum, r) => sum + r.volume, 0);
      
      const vaPercent = vaVolume / result.totalVolume;
      assert.ok(vaPercent >= 0.7, `Value area volume ${(vaPercent * 100).toFixed(1)}% should be >= 70%`);
    });

    test("should respect custom valueAreaPercent", () => {
      const data: OHLCV[] = Array.from({ length: 50 }, (_, i) => 
        candle(100 + i, 110 + i, 90 + i, 105 + i, 1000)
      );
      const result90 = calculateVolumeProfile(data, 24, 0.9);
      const result50 = calculateVolumeProfile(data, 24, 0.5);
      
      const vaRange90 = result90.vah - result90.val;
      const vaRange50 = result50.vah - result50.val;
      assert.ok(vaRange90 >= vaRange50, `90% VA range ${vaRange90} should be >= 50% VA range ${vaRange50}`);
    });
  });

  describe("edge cases", () => {
    test("should handle single candle", () => {
      const data: OHLCV[] = [candle(100, 110, 90, 105, 5000)];
      const result = calculateVolumeProfile(data, 10, 0.7);
      assert.strictEqual(result.totalVolume, 5000);
      assert.strictEqual(result.rows.length, 10);
      assert.ok(result.poc > 0);
    });

    test("should handle doji candles (high == low)", () => {
      const data: OHLCV[] = [
        candle(100, 100, 100, 100, 5000),
      ];
      // All prices identical → single row
      const result = calculateVolumeProfile(data, 10, 0.7);
      assert.strictEqual(result.totalVolume, 5000);
      assert.ok(result.rows.length >= 1);
    });

    test("should handle all identical prices", () => {
      const data: OHLCV[] = [
        candle(100, 100, 100, 100, 1000),
        candle(100, 100, 100, 100, 2000),
        candle(100, 100, 100, 100, 3000),
      ];
      const result = calculateVolumeProfile(data, 10, 0.7);
      assert.strictEqual(result.totalVolume, 6000);
      assert.strictEqual(result.poc, 100);
    });

    test("should handle very large row count", () => {
      const data: OHLCV[] = [
        candle(100, 110, 90, 105, 1000),
        candle(105, 115, 95, 100, 2000),
      ];
      const result = calculateVolumeProfile(data, 100, 0.7);
      assert.strictEqual(result.rows.length, 100);
      const rowVolumeSum = result.rows.reduce((sum, r) => sum + r.volume, 0);
      assert.ok(Math.abs(rowVolumeSum - 3000) < 1);
    });

    test("should preserve valueAreaPercent in result", () => {
      const data: OHLCV[] = [candle(100, 110, 90, 105, 1000)];
      const result = calculateVolumeProfile(data, 10, 0.85);
      assert.strictEqual(result.valueAreaPercent, 0.85);
    });
  });
});
