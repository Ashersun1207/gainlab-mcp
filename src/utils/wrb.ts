// WRB (Wide Range Bar) and Hidden Gap Detection
// Pure math functions following HG_PRO algorithm
// Detects wide range bars, hidden gaps, and gap fills

import type { OHLCV } from "../data/types.js";

export interface HiddenGap {
  type: "buy" | "sell";
  top: number;
  bottom: number;
  startIndex: number;
  endIndex: number;
  filled: boolean;
  filledIndex: number | null;
  pro: boolean;
  diff: number;
}

export interface WRBConfig {
  lookbackPeriod: number;  // default 5
  sensitivity: number;     // default 1.5
  useBody: boolean;        // default true
  gapExtension: "none" | "stopLoss" | "both";  // default "stopLoss"
  maxScope: number;        // default 999
}

export interface WRBResult {
  wrbFlags: boolean[];
  gaps: (HiddenGap | null)[];
  activeGaps: HiddenGap[];
  filledGaps: HiddenGap[];
  summary: {
    totalWRB: number;
    totalGaps: number;
    activeGaps: number;
    filledGaps: number;
    proGaps: number;
    lastSignal: { index: number; type: "buy" | "sell"; pro: boolean } | null;
  };
}

/**
 * Detect Wide Range Bars (WRB).
 * A bar is WRB if its range (body or full range) is greater than 
 * ALL previous `lookbackPeriod` bars multiplied by sensitivity.
 * @param data Array of OHLCV candles
 * @param config Partial WRB configuration
 * @returns Array of boolean flags (true = WRB)
 */
export function detectWRB(
  data: OHLCV[],
  config: Partial<WRBConfig> = {}
): boolean[] {
  const lookbackPeriod = config.lookbackPeriod ?? 5;
  const sensitivity = config.sensitivity ?? 1.5;
  const useBody = config.useBody ?? true;

  const result: boolean[] = [];

  for (let i = 0; i < data.length; i++) {
    // Not enough lookback data
    if (i < lookbackPeriod) {
      result.push(false);
      continue;
    }

    // Calculate current bar range
    const currentRange = useBody
      ? Math.abs(data[i].close - data[i].open)
      : data[i].high - data[i].low;

    // Zero range -> not WRB
    if (currentRange === 0) {
      result.push(false);
      continue;
    }

    // Check if current bar is wider than ALL previous bars * sensitivity
    let isWRB = true;
    for (let j = 1; j <= lookbackPeriod; j++) {
      const prevRange = useBody
        ? Math.abs(data[i - j].close - data[i - j].open)
        : data[i - j].high - data[i - j].low;

      if (currentRange <= prevRange * sensitivity) {
        isWRB = false;
        break;
      }
    }

    result.push(isWRB);
  }

  return result;
}

/**
 * Check if a gap qualifies as "Pro" based on three conditions.
 * Any one condition met = Pro.
 * @param oldBar Bar before WRB (i-1)
 * @param wrbBar WRB bar (i)
 * @param prev2Bar Bar two positions before WRB (i-2), can be null
 * @param gapType Type of gap ("buy" or "sell")
 * @returns True if gap is Pro
 */
export function isProGap(
  oldBar: OHLCV,
  wrbBar: OHLCV,
  prev2Bar: OHLCV | null,
  gapType: "buy" | "sell"
): boolean {
  const oldBody = Math.abs(oldBar.close - oldBar.open);
  const wrbBody = Math.abs(wrbBar.close - wrbBar.open);

  // Condition 1: WRB engulfs oldBar (opposite direction + WRB body > oldBar body * 0.9)
  const wrbDirection = wrbBar.close > wrbBar.open ? "bull" : "bear";
  const oldDirection = oldBar.close > oldBar.open ? "bull" : "bear";
  const oppositeDirection = wrbDirection !== oldDirection;
  const engulfsOld = oppositeDirection && wrbBody > oldBody * 0.9;

  if (engulfsOld) {
    return true;
  }

  // Condition 2: oldBar has significant shadow
  if (gapType === "buy") {
    // Hammer: lower shadow >= body * 2 (and shadow must be meaningful)
    const lowerShadow = Math.min(oldBar.open, oldBar.close) - oldBar.low;
    if (oldBody === 0) {
      // Doji: check if lower shadow is at least 2% of the full range
      const fullRange = oldBar.high - oldBar.low;
      if (fullRange > 0 && lowerShadow >= fullRange * 0.67) {
        return true;
      }
    } else if (lowerShadow >= oldBody * 2) {
      return true;
    }
  } else {
    // Shooting star: upper shadow >= body * 2 (and shadow must be meaningful)
    const upperShadow = oldBar.high - Math.max(oldBar.open, oldBar.close);
    if (oldBody === 0) {
      // Doji: check if upper shadow is at least 2/3 of the full range
      const fullRange = oldBar.high - oldBar.low;
      if (fullRange > 0 && upperShadow >= fullRange * 0.67) {
        return true;
      }
    } else if (upperShadow >= oldBody * 2) {
      return true;
    }
  }

  // Condition 3: oldBar engulfs prev2Bar (if prev2Bar exists)
  if (prev2Bar) {
    const prev2Body = Math.abs(prev2Bar.close - prev2Bar.open);
    const prev2Direction = prev2Bar.close > prev2Bar.open ? "bull" : "bear";
    const oppositeDirection2 = oldDirection !== prev2Direction;
    const engulfsPrev2 = oppositeDirection2 && oldBody > prev2Body * 0.9;

    if (engulfsPrev2) {
      return true;
    }
  }

  return false;
}

/**
 * Detect Hidden Gaps at WRB locations.
 * Only checks at indices where wrbFlags[i] is true.
 * @param data Array of OHLCV candles
 * @param wrbFlags Array of WRB flags from detectWRB()
 * @param config Partial WRB configuration
 * @returns Array of HiddenGap objects (null if no gap at index)
 */
export function detectHiddenGaps(
  data: OHLCV[],
  wrbFlags: boolean[],
  config: Partial<WRBConfig> = {}
): (HiddenGap | null)[] {
  const gapExtension = config.gapExtension ?? "stopLoss";
  const maxScope = config.maxScope ?? 999;

  const result: (HiddenGap | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    // No gap if not WRB or not enough data
    if (!wrbFlags[i] || i === 0 || i >= data.length - 1) {
      result.push(null);
      continue;
    }

    const oldBar = data[i - 1];
    const wrbBar = data[i];
    const newBar = data[i + 1];
    const prev2Bar = i >= 2 ? data[i - 2] : null;

    let gapType: "buy" | "sell" | null = null;
    let gapTop = 0;
    let gapBottom = 0;

    // Bullish gap: newBar.low > oldBar.high
    if (newBar.low > oldBar.high) {
      gapType = "buy";

      if (gapExtension === "none") {
        gapTop = newBar.low;
        gapBottom = oldBar.high;
      } else if (gapExtension === "stopLoss") {
        gapTop = Math.min(wrbBar.high, newBar.low);
        gapBottom = wrbBar.low;
      } else {
        // both
        gapTop = wrbBar.high;
        gapBottom = wrbBar.low;
      }
    }
    // Bearish gap: newBar.high < oldBar.low
    else if (newBar.high < oldBar.low) {
      gapType = "sell";

      if (gapExtension === "none") {
        gapTop = oldBar.low;
        gapBottom = newBar.high;
      } else if (gapExtension === "stopLoss") {
        gapTop = wrbBar.high;
        gapBottom = Math.max(wrbBar.low, newBar.high);
      } else {
        // both
        gapTop = wrbBar.high;
        gapBottom = wrbBar.low;
      }
    }

    // No gap detected
    if (!gapType || gapTop <= gapBottom) {
      result.push(null);
      continue;
    }

    // Check if Pro
    const pro = isProGap(oldBar, wrbBar, prev2Bar, gapType);

    const gap: HiddenGap = {
      type: gapType,
      top: gapTop,
      bottom: gapBottom,
      startIndex: i,
      endIndex: Math.min(i + maxScope, data.length - 1),
      filled: false,
      filledIndex: null,
      pro,
      diff: gapTop - gapBottom,
    };

    result.push(gap);
  }

  return result;
}

/**
 * Track gap fills in-place.
 * Mutates gaps array: sets filled=true, filledIndex, and updates endIndex when filled.
 * @param data Array of OHLCV candles
 * @param gaps Array of HiddenGap objects (will be mutated)
 */
export function trackGapFills(
  data: OHLCV[],
  gaps: (HiddenGap | null)[]
): void {
  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    if (!gap || gap.filled) {
      continue;
    }

    // Check subsequent bars within scope
    for (let j = gap.startIndex + 1; j <= gap.endIndex && j < data.length; j++) {
      const bar = data[j];
      let filled = false;

      if (gap.type === "buy") {
        // Buy gap filled when price touches or goes below bottom
        if (bar.low <= gap.bottom) {
          filled = true;
        }
      } else {
        // Sell gap filled when price touches or goes above top
        if (bar.high >= gap.top) {
          filled = true;
        }
      }

      if (filled) {
        gap.filled = true;
        gap.filledIndex = j;
        gap.endIndex = j;
        break;
      }
    }
  }
}

/**
 * Analyze WRB and Hidden Gaps for complete dataset.
 * Main entry point that orchestrates all detection and tracking.
 * @param data Array of OHLCV candles
 * @param config Optional WRB configuration
 * @returns Complete WRB analysis result
 */
export function analyzeWRB(
  data: OHLCV[],
  config?: Partial<WRBConfig>
): WRBResult {
  // Detect WRB
  const wrbFlags = detectWRB(data, config);

  // Detect Hidden Gaps
  const gaps = detectHiddenGaps(data, wrbFlags, config);

  // Track gap fills
  trackGapFills(data, gaps);

  // Separate active and filled gaps
  const activeGaps: HiddenGap[] = [];
  const filledGaps: HiddenGap[] = [];
  let proCount = 0;

  for (const gap of gaps) {
    if (gap) {
      if (gap.filled) {
        filledGaps.push(gap);
      } else {
        activeGaps.push(gap);
      }
      if (gap.pro) {
        proCount++;
      }
    }
  }

  // Find last signal (last gap)
  let lastSignal: { index: number; type: "buy" | "sell"; pro: boolean } | null = null;
  for (let i = gaps.length - 1; i >= 0; i--) {
    if (gaps[i]) {
      lastSignal = {
        index: i,
        type: gaps[i]!.type,
        pro: gaps[i]!.pro,
      };
      break;
    }
  }

  // Summary
  const totalWRB = wrbFlags.filter((v) => v).length;
  const totalGaps = gaps.filter((g) => g !== null).length;

  return {
    wrbFlags,
    gaps,
    activeGaps,
    filledGaps,
    summary: {
      totalWRB,
      totalGaps,
      activeGaps: activeGaps.length,
      filledGaps: filledGaps.length,
      proGaps: proCount,
      lastSignal,
    },
  };
}
