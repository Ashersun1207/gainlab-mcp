// Tests for VWAP, Anchored VWAP, and ATR indicators

import { describe, test } from "node:test";
import assert from "node:assert";
import {
  calculateVWAP,
  calculateAnchoredVWAP,
  calculateATR,
} from "../../src/utils/ta.js";

describe("VWAP / Anchored VWAP / ATR Indicators", () => {
  // Test data
  const highs  = [105, 108, 107, 110, 109, 112, 111, 114, 113, 116, 115, 118, 117, 120, 119];
  const lows   = [ 95,  98,  97, 100,  99, 102, 101, 104, 103, 106, 105, 108, 107, 110, 109];
  const closes = [102, 105, 103, 107, 105, 109, 107, 111, 109, 113, 111, 115, 113, 117, 115];
  const volumes = [1000, 1500, 1200, 1800, 1100, 1600, 1300, 1900, 1000, 1700, 1400, 2000, 1500, 2200, 1600];

  describe("calculateVWAP", () => {
    test("should return correct array length", () => {
      const vwap = calculateVWAP(highs, lows, closes, volumes);
      assert.strictEqual(vwap.length, closes.length);
    });

    test("should have first value equal to typical price of first bar", () => {
      const vwap = calculateVWAP(highs, lows, closes, volumes);
      const tp0 = (highs[0] + lows[0] + closes[0]) / 3;
      assert.ok(Math.abs(vwap[0]! - tp0) < 0.001, `First VWAP ${vwap[0]} should equal TP ${tp0}`);
    });

    test("should calculate cumulative VWAP correctly", () => {
      const vwap = calculateVWAP(highs, lows, closes, volumes);
      // Manual calculation for first two bars
      const tp0 = (highs[0] + lows[0] + closes[0]) / 3;
      const tp1 = (highs[1] + lows[1] + closes[1]) / 3;
      const expected = (tp0 * volumes[0] + tp1 * volumes[1]) / (volumes[0] + volumes[1]);
      assert.ok(Math.abs(vwap[1]! - expected) < 0.001);
    });

    test("should handle empty arrays", () => {
      const vwap = calculateVWAP([], [], [], []);
      assert.strictEqual(vwap.length, 0);
    });

    test("should handle zero volume", () => {
      const zeroVols = [0, 0, 0];
      const h = [100, 100, 100];
      const l = [90, 90, 90];
      const c = [95, 95, 95];
      const vwap = calculateVWAP(h, l, c, zeroVols);
      assert.strictEqual(vwap[0], null);
      assert.strictEqual(vwap[1], null);
    });

    test("should converge toward typical price with equal volumes", () => {
      const equalVols = [100, 100, 100, 100, 100];
      const h = [110, 120, 130, 140, 150];
      const l = [90, 100, 110, 120, 130];
      const c = [100, 110, 120, 130, 140];
      const vwap = calculateVWAP(h, l, c, equalVols);
      // Last VWAP should be average of all typical prices
      const avgTP = h.map((_, i) => (h[i] + l[i] + c[i]) / 3).reduce((a, b) => a + b) / 5;
      assert.ok(Math.abs(vwap[4]! - avgTP) < 0.001);
    });
  });

  describe("calculateAnchoredVWAP", () => {
    test("should return null before anchor index", () => {
      const avwap = calculateAnchoredVWAP(highs, lows, closes, volumes, 5);
      for (let i = 0; i < 5; i++) {
        assert.strictEqual(avwap[i], null, `Index ${i} should be null`);
      }
      assert.notStrictEqual(avwap[5], null, "Index 5 should have a value");
    });

    test("should start with typical price at anchor", () => {
      const avwap = calculateAnchoredVWAP(highs, lows, closes, volumes, 3);
      const tp3 = (highs[3] + lows[3] + closes[3]) / 3;
      assert.ok(Math.abs(avwap[3]! - tp3) < 0.001);
    });

    test("should equal regular VWAP when anchored at index 0", () => {
      const vwap = calculateVWAP(highs, lows, closes, volumes);
      const avwap = calculateAnchoredVWAP(highs, lows, closes, volumes, 0);
      for (let i = 0; i < closes.length; i++) {
        if (vwap[i] === null) {
          assert.strictEqual(avwap[i], null);
        } else {
          assert.ok(Math.abs(vwap[i]! - avwap[i]!) < 0.001, `Index ${i}: VWAP ${vwap[i]} != AVWAP ${avwap[i]}`);
        }
      }
    });

    test("should return correct array length", () => {
      const avwap = calculateAnchoredVWAP(highs, lows, closes, volumes, 10);
      assert.strictEqual(avwap.length, closes.length);
    });
  });

  describe("calculateATR", () => {
    test("should return null for initial periods", () => {
      const atr = calculateATR(highs, lows, closes, 14);
      for (let i = 0; i < 13; i++) {
        assert.strictEqual(atr[i], null, `Index ${i} should be null`);
      }
    });

    test("should have first ATR as average of true ranges", () => {
      const atr = calculateATR(highs, lows, closes, 5);
      // Calculate expected first ATR manually
      const trs: number[] = [];
      trs.push(highs[0] - lows[0]); // First bar
      for (let i = 1; i < 5; i++) {
        const hl = highs[i] - lows[i];
        const hpc = Math.abs(highs[i] - closes[i - 1]);
        const lpc = Math.abs(lows[i] - closes[i - 1]);
        trs.push(Math.max(hl, hpc, lpc));
      }
      const expectedATR = trs.reduce((a, b) => a + b) / 5;
      assert.ok(Math.abs(atr[4]! - expectedATR) < 0.001, `First ATR ${atr[4]} should be ${expectedATR}`);
    });

    test("should return positive values", () => {
      const atr = calculateATR(highs, lows, closes, 5);
      for (let i = 4; i < atr.length; i++) {
        assert.ok(atr[i]! > 0, `ATR at index ${i} should be positive`);
      }
    });

    test("should handle empty arrays", () => {
      const atr = calculateATR([], [], [], 14);
      assert.strictEqual(atr.length, 0);
    });

    test("should handle constant prices", () => {
      const constH = new Array(20).fill(100);
      const constL = new Array(20).fill(100);
      const constC = new Array(20).fill(100);
      const atr = calculateATR(constH, constL, constC, 14);
      // All true ranges are 0, so ATR should be 0
      for (let i = 13; i < atr.length; i++) {
        assert.ok(Math.abs(atr[i]!) < 0.001, `ATR should be ~0 for constant prices, got ${atr[i]}`);
      }
    });

    test("should use Wilder smoothing after initial period", () => {
      const atr = calculateATR(highs, lows, closes, 5);
      // After initial SMA, ATR uses Wilder smoothing:
      // ATR[i] = (prevATR * (period-1) + TR[i]) / period
      const tr5 = Math.max(
        highs[5] - lows[5],
        Math.abs(highs[5] - closes[4]),
        Math.abs(lows[5] - closes[4])
      );
      const expected = (atr[4]! * 4 + tr5) / 5;
      assert.ok(Math.abs(atr[5]! - expected) < 0.001, `ATR[5] ${atr[5]} should be ${expected}`);
    });

    test("should return correct array length", () => {
      const atr = calculateATR(highs, lows, closes, 5);
      assert.strictEqual(atr.length, closes.length);
    });
  });
});
