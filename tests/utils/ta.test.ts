import { describe, test } from "node:test";
import assert from "node:assert";
import {
  calculateMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBOLL,
  calculateKDJ,
} from "../../src/utils/ta.js";

describe("Technical Analysis Indicators", () => {
  // Simple test data
  const simpleCloses = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  
  // More realistic price data for advanced indicators
  const realCloses = [
    100, 102, 101, 103, 105, 104, 106, 108, 107, 109,
    111, 110, 112, 114, 113, 115, 117, 116, 118, 120,
    119, 121, 123, 122, 124, 126, 125, 127, 129, 128
  ];

  describe("calculateMA", () => {
    test("should return null for initial periods", () => {
      const ma5 = calculateMA(simpleCloses, 5);
      assert.strictEqual(ma5[0], null);
      assert.strictEqual(ma5[1], null);
      assert.strictEqual(ma5[2], null);
      assert.strictEqual(ma5[3], null);
    });

    test("should calculate correct MA values", () => {
      const ma3 = calculateMA(simpleCloses, 3);
      // First valid MA at index 2: (10+11+12)/3 = 11
      assert.strictEqual(ma3[2], 11);
      // At index 3: (11+12+13)/3 = 12
      assert.strictEqual(ma3[3], 12);
      // At index 4: (12+13+14)/3 = 13
      assert.strictEqual(ma3[4], 13);
    });

    test("should handle MA period of 1", () => {
      const ma1 = calculateMA(simpleCloses, 1);
      assert.strictEqual(ma1[0], 10);
      assert.strictEqual(ma1[5], 15);
    });

    test("should return correct array length", () => {
      const ma5 = calculateMA(simpleCloses, 5);
      assert.strictEqual(ma5.length, simpleCloses.length);
    });
  });

  describe("calculateEMA", () => {
    test("should return null for initial periods", () => {
      const ema5 = calculateEMA(simpleCloses, 5);
      assert.strictEqual(ema5[0], null);
      assert.strictEqual(ema5[1], null);
      assert.strictEqual(ema5[2], null);
      assert.strictEqual(ema5[3], null);
    });

    test("should start with SMA for first value", () => {
      const ema3 = calculateEMA(simpleCloses, 3);
      // First EMA at index 2 should equal SMA: (10+11+12)/3 = 11
      assert.strictEqual(ema3[2], 11);
    });

    test("should calculate EMA correctly", () => {
      const ema3 = calculateEMA(simpleCloses, 3);
      const multiplier = 2 / (3 + 1); // 0.5
      
      // EMA[2] = 11 (SMA)
      // EMA[3] = 13 * 0.5 + 11 * 0.5 = 12
      assert.strictEqual(ema3[3], 12);
      
      // EMA[4] = 14 * 0.5 + 12 * 0.5 = 13
      assert.strictEqual(ema3[4], 13);
    });

    test("should produce different values than MA", () => {
      const ma5 = calculateMA(realCloses, 5);
      const ema5 = calculateEMA(realCloses, 5);
      
      // After initial period, EMA should differ from MA
      let hasDifference = false;
      for (let i = 10; i < realCloses.length; i++) {
        if (ma5[i] !== ema5[i]) {
          hasDifference = true;
          break;
        }
      }
      assert.strictEqual(hasDifference, true);
    });
  });

  describe("calculateRSI", () => {
    test("should return null for initial periods", () => {
      const rsi14 = calculateRSI(realCloses, 14);
      for (let i = 0; i < 14; i++) {
        assert.strictEqual(rsi14[i], null);
      }
    });

    test("should return values between 0 and 100", () => {
      const rsi14 = calculateRSI(realCloses, 14);
      for (let i = 14; i < rsi14.length; i++) {
        assert.ok(rsi14[i]! >= 0 && rsi14[i]! <= 100);
      }
    });

    test("should calculate RSI for uptrend", () => {
      // Continuous uptrend should result in high RSI
      const uptrend = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116];
      const rsi14 = calculateRSI(uptrend, 14);
      const lastRSI = rsi14[rsi14.length - 1];
      assert.ok(lastRSI! > 70, `RSI should be > 70 in uptrend, got ${lastRSI}`);
    });

    test("should calculate RSI for downtrend", () => {
      // Continuous downtrend should result in low RSI
      const downtrend = [100, 99, 98, 97, 96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85, 84];
      const rsi14 = calculateRSI(downtrend, 14);
      const lastRSI = rsi14[rsi14.length - 1];
      assert.ok(lastRSI! < 30, `RSI should be < 30 in downtrend, got ${lastRSI}`);
    });
  });

  describe("calculateMACD", () => {
    test("should return objects with correct structure", () => {
      const macd = calculateMACD(realCloses);
      assert.ok(Array.isArray(macd.macd));
      assert.ok(Array.isArray(macd.signal));
      assert.ok(Array.isArray(macd.histogram));
      assert.strictEqual(macd.macd.length, realCloses.length);
      assert.strictEqual(macd.signal.length, realCloses.length);
      assert.strictEqual(macd.histogram.length, realCloses.length);
    });

    test("should have null values during initial period", () => {
      const macd = calculateMACD(realCloses, 12, 26, 9);
      // Slow EMA needs 26 periods, so first 25 should be null
      for (let i = 0; i < 25; i++) {
        assert.strictEqual(macd.macd[i], null);
      }
    });

    test("should calculate histogram as MACD - Signal", () => {
      const macd = calculateMACD(realCloses, 12, 26, 9);
      for (let i = 0; i < realCloses.length; i++) {
        if (macd.macd[i] !== null && macd.signal[i] !== null) {
          const expectedHist = macd.macd[i]! - macd.signal[i]!;
          assert.ok(Math.abs(macd.histogram[i]! - expectedHist) < 0.0001);
        }
      }
    });

    test("should work with custom periods", () => {
      const macd = calculateMACD(realCloses, 5, 10, 3);
      assert.ok(macd.macd.length === realCloses.length);
      // Should have values sooner with shorter periods
      assert.notStrictEqual(macd.macd[9], null);
    });
  });

  describe("calculateBOLL", () => {
    test("should return objects with correct structure", () => {
      const boll = calculateBOLL(realCloses, 20, 2);
      assert.ok(Array.isArray(boll.upper));
      assert.ok(Array.isArray(boll.middle));
      assert.ok(Array.isArray(boll.lower));
      assert.strictEqual(boll.upper.length, realCloses.length);
      assert.strictEqual(boll.middle.length, realCloses.length);
      assert.strictEqual(boll.lower.length, realCloses.length);
    });

    test("should have null values during initial period", () => {
      const boll = calculateBOLL(realCloses, 20, 2);
      for (let i = 0; i < 19; i++) {
        assert.strictEqual(boll.upper[i], null);
        assert.strictEqual(boll.middle[i], null);
        assert.strictEqual(boll.lower[i], null);
      }
    });

    test("should have upper > middle > lower", () => {
      const boll = calculateBOLL(realCloses, 20, 2);
      for (let i = 19; i < realCloses.length; i++) {
        assert.ok(boll.upper[i]! > boll.middle[i]!);
        assert.ok(boll.middle[i]! > boll.lower[i]!);
      }
    });

    test("should have middle band equal to MA", () => {
      const boll = calculateBOLL(realCloses, 20, 2);
      const ma20 = calculateMA(realCloses, 20);
      for (let i = 19; i < realCloses.length; i++) {
        assert.ok(Math.abs(boll.middle[i]! - ma20[i]!) < 0.0001);
      }
    });

    test("should adjust band width with stdDev multiplier", () => {
      const boll2 = calculateBOLL(realCloses, 20, 2);
      const boll1 = calculateBOLL(realCloses, 20, 1);
      
      for (let i = 19; i < realCloses.length; i++) {
        const width2 = boll2.upper[i]! - boll2.lower[i]!;
        const width1 = boll1.upper[i]! - boll1.lower[i]!;
        assert.ok(width2 > width1);
      }
    });
  });

  describe("calculateKDJ", () => {
    const highs = realCloses.map(c => c + 2);
    const lows = realCloses.map(c => c - 2);

    test("should return objects with correct structure", () => {
      const kdj = calculateKDJ(highs, lows, realCloses, 9);
      assert.ok(Array.isArray(kdj.k));
      assert.ok(Array.isArray(kdj.d));
      assert.ok(Array.isArray(kdj.j));
      assert.strictEqual(kdj.k.length, realCloses.length);
      assert.strictEqual(kdj.d.length, realCloses.length);
      assert.strictEqual(kdj.j.length, realCloses.length);
    });

    test("should have null values during initial period", () => {
      const kdj = calculateKDJ(highs, lows, realCloses, 9);
      for (let i = 0; i < 8; i++) {
        assert.strictEqual(kdj.k[i], null);
        assert.strictEqual(kdj.d[i], null);
        assert.strictEqual(kdj.j[i], null);
      }
    });

    test("should have values after initial period", () => {
      const kdj = calculateKDJ(highs, lows, realCloses, 9);
      for (let i = 8; i < realCloses.length; i++) {
        assert.notStrictEqual(kdj.k[i], null);
        assert.notStrictEqual(kdj.d[i], null);
        assert.notStrictEqual(kdj.j[i], null);
      }
    });

    test("should satisfy J = 3*K - 2*D", () => {
      const kdj = calculateKDJ(highs, lows, realCloses, 9);
      for (let i = 8; i < realCloses.length; i++) {
        const expectedJ = 3 * kdj.k[i]! - 2 * kdj.d[i]!;
        assert.ok(Math.abs(kdj.j[i]! - expectedJ) < 0.0001);
      }
    });

    test("should start with K and D near 50", () => {
      const kdj = calculateKDJ(highs, lows, realCloses, 9);
      // First valid values should be influenced by initial K=50, D=50
      // but won't be exactly 50 due to RSV calculation
      assert.ok(kdj.k[8]! > 30 && kdj.k[8]! < 70);
      assert.ok(kdj.d[8]! > 30 && kdj.d[8]! < 70);
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty arrays", () => {
      const empty: number[] = [];
      assert.strictEqual(calculateMA(empty, 5).length, 0);
      assert.strictEqual(calculateEMA(empty, 5).length, 0);
      assert.strictEqual(calculateRSI(empty, 14).length, 0);
    });

    test("should handle arrays shorter than period", () => {
      const short = [10, 11, 12];
      const ma5 = calculateMA(short, 5);
      assert.strictEqual(ma5.length, 3);
      assert.strictEqual(ma5[0], null);
      assert.strictEqual(ma5[1], null);
      assert.strictEqual(ma5[2], null);
    });

    test("should handle constant prices in RSI", () => {
      const constant = new Array(20).fill(100);
      const rsi14 = calculateRSI(constant, 14);
      // With no price changes, RSI should be 50 (or handle division by zero gracefully)
      for (let i = 14; i < rsi14.length; i++) {
        assert.ok(rsi14[i]! >= 0 && rsi14[i]! <= 100);
      }
    });

    test("should handle identical highs and lows in KDJ", () => {
      const constant = new Array(15).fill(100);
      const kdj = calculateKDJ(constant, constant, constant, 9);
      // Should return 50 when range is zero
      for (let i = 8; i < kdj.k.length; i++) {
        assert.ok(kdj.k[i]! >= 0 && kdj.k[i]! <= 150);
      }
    });
  });
});
