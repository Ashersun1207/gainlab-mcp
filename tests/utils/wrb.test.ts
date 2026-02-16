// WRB Detection Tests
// Comprehensive test coverage for WRB/HG detection utilities

import { describe, it } from "node:test";
import assert from "node:assert";
import type { OHLCV } from "../../src/data/types.js";
import {
  detectWRB,
  detectHiddenGaps,
  isProGap,
  trackGapFills,
  analyzeWRB,
} from "../../src/utils/wrb.ts";

// Test helper: create candle
function candle(o: number, h: number, l: number, c: number, v = 1000, ts = 0): OHLCV {
  return {
    timestamp: ts || Date.now(),
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v,
  };
}

describe("detectWRB", () => {
  it("should detect WRB when bar beats ALL previous bars by sensitivity", () => {
    const data = [
      candle(100, 102, 99, 101),   // body = 1
      candle(101, 103, 100, 102),  // body = 1
      candle(102, 104, 101, 103),  // body = 1
      candle(103, 105, 102, 104),  // body = 1
      candle(104, 106, 103, 105),  // body = 1
      candle(105, 112, 104, 111),  // body = 6 > 1*1.5 for all previous 5 -> WRB
    ];

    const result = detectWRB(data, { lookbackPeriod: 5, sensitivity: 1.5, useBody: true });

    assert.strictEqual(result.length, 6);
    assert.strictEqual(result[5], true, "Last bar should be WRB");
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(result[i], false, `Bar ${i} should not be WRB (insufficient lookback or not wider)`);
    }
  });

  it("should not detect WRB if bar doesn't beat ALL previous bars", () => {
    const data = [
      candle(100, 102, 99, 101),   // body = 1
      candle(101, 105, 100, 104),  // body = 3 (one bar is wide)
      candle(102, 104, 101, 103),  // body = 1
      candle(103, 105, 102, 104),  // body = 1
      candle(104, 106, 103, 105),  // body = 1
      candle(105, 109, 104, 108),  // body = 3, but doesn't beat bar[1] (3) * 1.5 = 4.5
    ];

    const result = detectWRB(data, { lookbackPeriod: 5, sensitivity: 1.5, useBody: true });

    assert.strictEqual(result[5], false, "Last bar should not be WRB (doesn't beat all previous)");
  });

  it("should handle zero range bars correctly", () => {
    const data = [
      candle(100, 102, 99, 101),
      candle(101, 103, 100, 102),
      candle(102, 104, 101, 103),
      candle(103, 105, 102, 104),
      candle(104, 106, 103, 105),
      candle(105, 105, 105, 105),  // zero range -> not WRB
    ];

    const result = detectWRB(data, { lookbackPeriod: 5, sensitivity: 1.5, useBody: true });

    assert.strictEqual(result[5], false, "Zero range bar should not be WRB");
  });

  it("should use full range when useBody=false", () => {
    const data = [
      candle(100, 101, 99, 100),   // range = 2
      candle(100, 101, 99, 100),   // range = 2
      candle(100, 101, 99, 100),   // range = 2
      candle(100, 101, 99, 100),   // range = 2
      candle(100, 101, 99, 100),   // range = 2
      candle(100, 106, 99, 105),   // range = 7 > 2*1.5 for all -> WRB
    ];

    const result = detectWRB(data, { lookbackPeriod: 5, sensitivity: 1.5, useBody: false });

    assert.strictEqual(result[5], true, "Should detect WRB using full range");
  });

  it("should return all false for insufficient data", () => {
    const data = [
      candle(100, 102, 99, 101),
      candle(101, 103, 100, 102),
    ];

    const result = detectWRB(data, { lookbackPeriod: 5, sensitivity: 1.5 });

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0], false);
    assert.strictEqual(result[1], false);
  });

  it("should handle empty data", () => {
    const result = detectWRB([], { lookbackPeriod: 5 });
    assert.strictEqual(result.length, 0);
  });
});

describe("isProGap", () => {
  it("should detect Pro via Condition 1: WRB engulfs oldBar", () => {
    const oldBar = candle(100, 101, 99, 100);  // body = 0 (doji-ish, bearish)
    const wrbBar = candle(99, 103, 98, 102);   // body = 3 (bullish), opposite direction
    // wrbBody (3) > oldBody (0) * 0.9 -> true

    const result = isProGap(oldBar, wrbBar, null, "buy");
    assert.strictEqual(result, true, "Should be Pro (engulfing)");
  });

  it("should detect Pro via Condition 2: hammer (buy gap)", () => {
    const oldBar = candle(100, 101, 95, 100);  // lower shadow = 5, body = 0 -> hammer
    const wrbBar = candle(100, 105, 99, 104);  // doesn't engulf (same direction)

    const result = isProGap(oldBar, wrbBar, null, "buy");
    assert.strictEqual(result, true, "Should be Pro (hammer)");
  });

  it("should detect Pro via Condition 2: shooting star (sell gap)", () => {
    const oldBar = candle(100, 106, 99, 100);  // upper shadow = 6, body = 0 -> shooting star
    const wrbBar = candle(100, 102, 95, 96);   // doesn't engulf

    const result = isProGap(oldBar, wrbBar, null, "sell");
    assert.strictEqual(result, true, "Should be Pro (shooting star)");
  });

  it("should detect Pro via Condition 3: oldBar engulfs prev2Bar", () => {
    const prev2Bar = candle(100, 101, 99, 100);  // body = 0, bearish
    const oldBar = candle(99, 102, 98, 101);     // body = 2, bullish, opposite direction
    const wrbBar = candle(101, 103, 100, 102);   // body = 1

    // oldBody (2) > prev2Body (0) * 0.9 -> true
    const result = isProGap(oldBar, wrbBar, prev2Bar, "buy");
    assert.strictEqual(result, true, "Should be Pro (oldBar engulfs prev2Bar)");
  });

  it("should not be Pro if no conditions met", () => {
    const oldBar = candle(100, 101, 99.5, 100.5);  // body = 0.5, small shadows
    const wrbBar = candle(100.5, 102, 99.5, 101);  // body = 0.5, same bull direction
    const prev2Bar = candle(99, 100, 98.5, 99.5);  // body = 0.5, same bull direction

    const result = isProGap(oldBar, wrbBar, prev2Bar, "buy");
    assert.strictEqual(result, false, "Should not be Pro");
  });
});

describe("detectHiddenGaps", () => {
  it("should detect bullish gap with 'none' extension", () => {
    const data = [
      candle(100, 101, 99, 100),   // oldBar
      candle(100, 110, 99, 109),   // wrbBar (WRB)
      candle(105, 106, 104, 105),  // newBar (newBar.low=104 > oldBar.high=101)
    ];
    const wrbFlags = [false, true, false];

    const gaps = detectHiddenGaps(data, wrbFlags, { gapExtension: "none" });

    assert.strictEqual(gaps.length, 3);
    assert.strictEqual(gaps[1]?.type, "buy");
    assert.strictEqual(gaps[1]?.top, 104, "gapTop should be newBar.low");
    assert.strictEqual(gaps[1]?.bottom, 101, "gapBottom should be oldBar.high");
    assert.strictEqual(gaps[1]?.filled, false);
  });

  it("should detect bearish gap with 'none' extension", () => {
    const data = [
      candle(100, 101, 99, 100),   // oldBar
      candle(100, 101, 90, 91),    // wrbBar (WRB)
      candle(96, 97, 95, 96),      // newBar (newBar.high=97 < oldBar.low=99)
    ];
    const wrbFlags = [false, true, false];

    const gaps = detectHiddenGaps(data, wrbFlags, { gapExtension: "none" });

    assert.strictEqual(gaps[1]?.type, "sell");
    assert.strictEqual(gaps[1]?.top, 99, "gapTop should be oldBar.low");
    assert.strictEqual(gaps[1]?.bottom, 97, "gapBottom should be newBar.high");
  });

  it("should detect bullish gap with 'stopLoss' extension", () => {
    const data = [
      candle(100, 101, 99, 100),   // oldBar
      candle(100, 110, 95, 109),   // wrbBar (WRB), low=95
      candle(105, 106, 104, 105),  // newBar, low=104
    ];
    const wrbFlags = [false, true, false];

    const gaps = detectHiddenGaps(data, wrbFlags, { gapExtension: "stopLoss" });

    assert.strictEqual(gaps[1]?.type, "buy");
    assert.strictEqual(gaps[1]?.top, 104, "gapTop = min(wrbBar.high=110, newBar.low=104) = 104");
    assert.strictEqual(gaps[1]?.bottom, 95, "gapBottom = wrbBar.low");
  });

  it("should detect bearish gap with 'stopLoss' extension", () => {
    const data = [
      candle(100, 101, 99, 100),   // oldBar
      candle(100, 105, 90, 91),    // wrbBar (WRB), high=105, low=90
      candle(96, 97, 95, 96),      // newBar, high=97
    ];
    const wrbFlags = [false, true, false];

    const gaps = detectHiddenGaps(data, wrbFlags, { gapExtension: "stopLoss" });

    assert.strictEqual(gaps[1]?.type, "sell");
    assert.strictEqual(gaps[1]?.top, 105, "gapTop = wrbBar.high");
    assert.strictEqual(gaps[1]?.bottom, 97, "gapBottom = max(wrbBar.low=90, newBar.high=97) = 97");
  });

  it("should detect gap with 'both' extension", () => {
    const data = [
      candle(100, 101, 99, 100),   // oldBar
      candle(100, 110, 95, 109),   // wrbBar (WRB)
      candle(105, 106, 104, 105),  // newBar
    ];
    const wrbFlags = [false, true, false];

    const gaps = detectHiddenGaps(data, wrbFlags, { gapExtension: "both" });

    assert.strictEqual(gaps[1]?.type, "buy");
    assert.strictEqual(gaps[1]?.top, 110, "gapTop = wrbBar.high");
    assert.strictEqual(gaps[1]?.bottom, 95, "gapBottom = wrbBar.low");
  });

  it("should not detect gap if no price gap exists", () => {
    const data = [
      candle(100, 101, 99, 100),   // oldBar
      candle(100, 110, 99, 109),   // wrbBar (WRB)
      candle(100, 101, 99, 100),   // newBar (overlaps oldBar, no gap)
    ];
    const wrbFlags = [false, true, false];

    const gaps = detectHiddenGaps(data, wrbFlags, { gapExtension: "none" });

    assert.strictEqual(gaps[1], null, "Should not detect gap (no price gap)");
  });

  it("should handle edge cases: first/last bars", () => {
    const data = [
      candle(100, 110, 99, 109),   // first bar, WRB
      candle(105, 106, 104, 105),
    ];
    const wrbFlags = [true, false];

    const gaps = detectHiddenGaps(data, wrbFlags);

    assert.strictEqual(gaps[0], null, "First bar cannot have gap (no oldBar)");
  });

  it("should detect Pro gap correctly", () => {
    const data = [
      candle(100, 101, 95, 100),   // oldBar (hammer: lower shadow=5, body=0)
      candle(100, 110, 99, 109),   // wrbBar (WRB)
      candle(105, 106, 104, 105),  // newBar
    ];
    const wrbFlags = [false, true, false];

    const gaps = detectHiddenGaps(data, wrbFlags);

    assert.strictEqual(gaps[1]?.pro, true, "Should detect Pro gap (hammer)");
  });
});

describe("trackGapFills", () => {
  it("should mark buy gap as filled when price touches bottom", () => {
    const data = [
      candle(100, 101, 99, 100),
      candle(100, 110, 99, 109),
      candle(105, 106, 104, 105),
      candle(104, 105, 100, 101),  // low=100 touches gap bottom
    ];
    const wrbFlags = [false, true, false, false];
    const gaps = detectHiddenGaps(data, wrbFlags, { gapExtension: "none" });

    trackGapFills(data, gaps);

    assert.strictEqual(gaps[1]?.filled, true, "Buy gap should be filled");
    assert.strictEqual(gaps[1]?.filledIndex, 3, "Should be filled at index 3");
    assert.strictEqual(gaps[1]?.endIndex, 3, "endIndex should update to 3");
  });

  it("should mark sell gap as filled when price touches top", () => {
    const data = [
      candle(100, 101, 99, 100),
      candle(100, 101, 90, 91),
      candle(96, 97, 95, 96),
      candle(98, 100, 97, 99),  // high=100 touches gap top (99)
    ];
    const wrbFlags = [false, true, false, false];
    const gaps = detectHiddenGaps(data, wrbFlags, { gapExtension: "none" });

    trackGapFills(data, gaps);

    assert.strictEqual(gaps[1]?.filled, true, "Sell gap should be filled");
    assert.strictEqual(gaps[1]?.filledIndex, 3);
  });

  it("should not mark gap as filled if price doesn't reach threshold", () => {
    const data = [
      candle(100, 101, 99, 100),
      candle(100, 110, 99, 109),
      candle(105, 106, 104, 105),
      candle(105, 106, 102, 105),  // low=102, doesn't reach bottom=101
    ];
    const wrbFlags = [false, true, false, false];
    const gaps = detectHiddenGaps(data, wrbFlags, { gapExtension: "none" });

    trackGapFills(data, gaps);

    assert.strictEqual(gaps[1]?.filled, false, "Gap should not be filled");
  });

  it("should respect maxScope when checking fills", () => {
    const data = [
      candle(100, 101, 99, 100),
      candle(100, 110, 99, 109),
      candle(105, 106, 104, 105),
      candle(105, 106, 104, 105),
      candle(105, 106, 104, 105),
      candle(104, 105, 100, 101),  // would fill, but outside scope
    ];
    const wrbFlags = [false, true, false, false, false, false];
    const gaps = detectHiddenGaps(data, wrbFlags, { gapExtension: "none", maxScope: 2 });

    trackGapFills(data, gaps);

    // Gap endIndex = startIndex(1) + maxScope(2) = 3, so bar[5] is outside scope
    assert.strictEqual(gaps[1]?.filled, false, "Gap should not be filled (outside scope)");
  });
});

describe("analyzeWRB", () => {
  it("should return complete analysis with all components", () => {
    const data = [
      candle(100, 101, 99, 100),
      candle(101, 102, 100, 101),
      candle(102, 103, 101, 102),
      candle(103, 104, 102, 103),
      candle(104, 105, 103, 104),
      candle(104, 112, 103, 111),  // WRB
      candle(108, 109, 107, 108),  // newBar, creates bullish gap
      candle(107, 108, 105, 106),  // fills gap
    ];

    const result = analyzeWRB(data, { lookbackPeriod: 5, sensitivity: 1.5, gapExtension: "none" });

    assert.strictEqual(result.wrbFlags.length, 8);
    assert.strictEqual(result.gaps.length, 8);
    assert.strictEqual(result.wrbFlags[5], true, "Bar 5 should be WRB");
    assert.notEqual(result.gaps[5], null, "Bar 5 should have gap");

    // Summary
    assert.strictEqual(result.summary.totalWRB, 1);
    assert.strictEqual(result.summary.totalGaps, 1);
    assert.strictEqual(result.summary.filledGaps, 1);
    assert.strictEqual(result.summary.activeGaps, 0);

    // Last signal
    assert.notEqual(result.summary.lastSignal, null);
    assert.strictEqual(result.summary.lastSignal?.index, 5);
    assert.strictEqual(result.summary.lastSignal?.type, "buy");
  });

  it("should separate active and filled gaps correctly", () => {
    const data = [
      candle(100, 101, 99, 100),
      candle(101, 102, 100, 101),
      candle(102, 103, 101, 102),
      candle(103, 104, 102, 103),
      candle(104, 105, 103, 104),
      candle(104, 112, 103, 111),  // WRB
      candle(108, 109, 107, 108),  // creates gap
    ];

    const result = analyzeWRB(data);

    assert.strictEqual(result.activeGaps.length, 1, "Should have 1 active gap");
    assert.strictEqual(result.filledGaps.length, 0, "Should have 0 filled gaps");
    assert.strictEqual(result.summary.activeGaps, 1);
  });

  it("should count Pro gaps correctly", () => {
    const data = [
      candle(100, 101, 95, 100),   // hammer (will make Pro)
      candle(100, 102, 99, 101),
      candle(102, 103, 101, 102),
      candle(103, 104, 102, 103),
      candle(104, 105, 103, 104),
      candle(104, 112, 103, 111),  // WRB
      candle(108, 109, 107, 108),  // creates Pro gap
    ];

    const result = analyzeWRB(data);

    assert.strictEqual(result.summary.proGaps, 1, "Should detect 1 Pro gap");
    assert.strictEqual(result.activeGaps[0].pro, true);
  });

  it("should handle empty data", () => {
    const result = analyzeWRB([]);

    assert.strictEqual(result.wrbFlags.length, 0);
    assert.strictEqual(result.gaps.length, 0);
    assert.strictEqual(result.summary.totalWRB, 0);
    assert.strictEqual(result.summary.totalGaps, 0);
    assert.strictEqual(result.summary.lastSignal, null);
  });

  it("should handle single candle", () => {
    const data = [candle(100, 101, 99, 100)];
    const result = analyzeWRB(data);

    assert.strictEqual(result.wrbFlags[0], false);
    assert.strictEqual(result.gaps[0], null);
    assert.strictEqual(result.summary.totalWRB, 0);
  });

  it("should handle all same price (zero range)", () => {
    const data = [
      candle(100, 100, 100, 100),
      candle(100, 100, 100, 100),
      candle(100, 100, 100, 100),
      candle(100, 100, 100, 100),
      candle(100, 100, 100, 100),
      candle(100, 100, 100, 100),
    ];

    const result = analyzeWRB(data);

    assert.strictEqual(result.summary.totalWRB, 0, "No WRB in flat data");
    assert.strictEqual(result.summary.totalGaps, 0, "No gaps in flat data");
  });

  it("should handle multiple WRBs and gaps", () => {
    const data = [
      candle(100, 101, 99, 100),
      candle(101, 102, 100, 101),
      candle(102, 103, 101, 102),
      candle(103, 104, 102, 103),
      candle(104, 105, 103, 104),
      candle(104, 112, 103, 111),  // WRB #1
      candle(108, 109, 107, 108),  // gap #1
      candle(108, 109, 107, 108),
      candle(108, 109, 107, 108),
      candle(108, 109, 107, 108),
      candle(108, 109, 107, 108),
      candle(108, 117, 107, 116),  // WRB #2
      candle(113, 114, 112, 113),  // gap #2
    ];

    const result = analyzeWRB(data, { lookbackPeriod: 5 });

    assert.strictEqual(result.summary.totalWRB, 2, "Should detect 2 WRBs");
    assert.strictEqual(result.summary.totalGaps, 2, "Should detect 2 gaps");
    assert.strictEqual(result.summary.lastSignal?.index, 11, "Last signal at WRB #2");
  });
});
