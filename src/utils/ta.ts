// Technical Analysis Indicators
// Pure math functions - no external dependencies, no API calls
// Includes: MA, EMA, RSI, MACD, BOLL, KDJ, VWAP, Anchored VWAP, ATR

/**
 * Calculate Simple Moving Average (SMA/MA)
 * @param closes Array of closing prices
 * @param period Moving average period
 * @returns Array with MA values (null for initial periods)
 */
export function calculateMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += closes[i - j];
      }
      result.push(sum / period);
    }
  }
  
  return result;
}

/**
 * Calculate Exponential Moving Average (EMA)
 * @param closes Array of closing prices
 * @param period EMA period
 * @returns Array with EMA values (null for initial periods)
 */
export function calculateEMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  
  // First EMA = SMA of first n values
  let ema: number | null = null;
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      // Initialize with SMA
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += closes[i - j];
      }
      ema = sum / period;
      result.push(ema);
    } else {
      // EMA = close * multiplier + EMA(yesterday) * (1 - multiplier)
      ema = closes[i] * multiplier + ema! * (1 - multiplier);
      result.push(ema);
    }
  }
  
  return result;
}

/**
 * Calculate Relative Strength Index (RSI)
 * @param closes Array of closing prices
 * @param period RSI period (typically 14)
 * @returns Array with RSI values (null for initial periods)
 */
export function calculateRSI(closes: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [];
  
  if (closes.length < period + 1) {
    return closes.map(() => null);
  }
  
  // Calculate price changes
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }
  
  let avgGain = 0;
  let avgLoss = 0;
  
  // First period: simple average
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      avgGain += changes[i];
    } else {
      avgLoss += Math.abs(changes[i]);
    }
  }
  avgGain /= period;
  avgLoss /= period;
  
  // Initial null values
  for (let i = 0; i < period; i++) {
    result.push(null);
  }
  
  // Calculate RSI for each subsequent period
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    
    // Smoothed average
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    result.push(rsi);
  }
  
  return result;
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param closes Array of closing prices
 * @param fastPeriod Fast EMA period (default 12)
 * @param slowPeriod Slow EMA period (default 26)
 * @param signalPeriod Signal line period (default 9)
 * @returns Object with macd, signal, and histogram arrays
 */
export function calculateMACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
} {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);
  
  // MACD line = Fast EMA - Slow EMA
  const macd: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (fastEMA[i] === null || slowEMA[i] === null) {
      macd.push(null);
    } else {
      macd.push(fastEMA[i]! - slowEMA[i]!);
    }
  }
  
  // Signal line = 9-period EMA of MACD
  const macdValues = macd.map(v => v ?? 0);
  const signalEMA = calculateEMA(macdValues, signalPeriod);
  
  // Adjust signal to have nulls where MACD is null
  const signal: (number | null)[] = [];
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null) {
      signal.push(null);
    } else {
      signal.push(signalEMA[i]);
    }
  }
  
  // Histogram = MACD - Signal
  const histogram: (number | null)[] = [];
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] === null || signal[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(macd[i]! - signal[i]!);
    }
  }
  
  return { macd, signal, histogram };
}

/**
 * Calculate Bollinger Bands
 * @param closes Array of closing prices
 * @param period Period for middle band (default 20)
 * @param stdDevMultiplier Standard deviation multiplier (default 2)
 * @returns Object with upper, middle, and lower band arrays
 */
export function calculateBOLL(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
} {
  const middle = calculateMA(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
    } else {
      // Calculate standard deviation
      let sumSquares = 0;
      for (let j = 0; j < period; j++) {
        const diff = closes[i - j] - middle[i]!;
        sumSquares += diff * diff;
      }
      const stdDev = Math.sqrt(sumSquares / period);
      
      upper.push(middle[i]! + stdDevMultiplier * stdDev);
      lower.push(middle[i]! - stdDevMultiplier * stdDev);
    }
  }
  
  return { upper, middle, lower };
}

/**
 * Calculate KDJ indicator
 * @param highs Array of high prices
 * @param lows Array of low prices
 * @param closes Array of closing prices
 * @param period Period for RSV calculation (default 9)
 * @returns Object with K, D, and J arrays
 */
export function calculateKDJ(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 9
): {
  k: (number | null)[];
  d: (number | null)[];
  j: (number | null)[];
} {
  const k: (number | null)[] = [];
  const d: (number | null)[] = [];
  const j: (number | null)[] = [];
  
  let prevK = 50;
  let prevD = 50;
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      k.push(null);
      d.push(null);
      j.push(null);
    } else {
      // Find highest high and lowest low in period
      let highestHigh = highs[i];
      let lowestLow = lows[i];
      for (let j = 0; j < period; j++) {
        highestHigh = Math.max(highestHigh, highs[i - j]);
        lowestLow = Math.min(lowestLow, lows[i - j]);
      }
      
      // RSV = (Close - Low_n) / (High_n - Low_n) * 100
      const rsv = highestHigh === lowestLow 
        ? 50 
        : ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
      
      // K = 2/3 * prev_K + 1/3 * RSV
      const currentK = (2 / 3) * prevK + (1 / 3) * rsv;
      
      // D = 2/3 * prev_D + 1/3 * K
      const currentD = (2 / 3) * prevD + (1 / 3) * currentK;
      
      // J = 3*K - 2*D
      const currentJ = 3 * currentK - 2 * currentD;
      
      k.push(currentK);
      d.push(currentD);
      j.push(currentJ);
      
      prevK = currentK;
      prevD = currentD;
    }
  }
  
  return { k, d, j };
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 * VWAP = Cumulative(TypicalPrice * Volume) / Cumulative(Volume)
 * TypicalPrice = (High + Low + Close) / 3
 * @param highs Array of high prices
 * @param lows Array of low prices
 * @param closes Array of closing prices
 * @param volumes Array of volumes
 * @returns Array with VWAP values (null only if volume is zero cumulatively)
 */
export function calculateVWAP(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): (number | null)[] {
  const result: (number | null)[] = [];
  let cumulativeTPV = 0; // cumulative (TP * Volume)
  let cumulativeVol = 0; // cumulative Volume

  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativeTPV += tp * volumes[i];
    cumulativeVol += volumes[i];

    if (cumulativeVol === 0) {
      result.push(null);
    } else {
      result.push(cumulativeTPV / cumulativeVol);
    }
  }

  return result;
}

/**
 * Calculate Anchored VWAP — VWAP starting from a specific index
 * @param highs Array of high prices
 * @param lows Array of low prices
 * @param closes Array of closing prices
 * @param volumes Array of volumes
 * @param anchorIndex Index to start VWAP calculation from
 * @returns Array with Anchored VWAP values (null before anchorIndex)
 */
export function calculateAnchoredVWAP(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  anchorIndex: number
): (number | null)[] {
  const result: (number | null)[] = [];
  let cumulativeTPV = 0;
  let cumulativeVol = 0;

  for (let i = 0; i < closes.length; i++) {
    if (i < anchorIndex) {
      result.push(null);
      continue;
    }
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativeTPV += tp * volumes[i];
    cumulativeVol += volumes[i];

    if (cumulativeVol === 0) {
      result.push(null);
    } else {
      result.push(cumulativeTPV / cumulativeVol);
    }
  }

  return result;
}

/**
 * Calculate ATR (Average True Range)
 * True Range = max(H-L, |H-prevC|, |L-prevC|)
 * ATR = SMA of True Range over period (first value), then Wilder smoothing
 * @param highs Array of high prices
 * @param lows Array of low prices
 * @param closes Array of closing prices
 * @param period ATR period (default 14)
 * @returns Array with ATR values (null for initial periods)
 */
export function calculateATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): (number | null)[] {
  const result: (number | null)[] = [];

  if (closes.length === 0) {
    return result;
  }

  // Calculate True Range
  const trueRanges: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      // First bar: TR = High - Low
      trueRanges.push(highs[i] - lows[i]);
    } else {
      const hl = highs[i] - lows[i];
      const hpc = Math.abs(highs[i] - closes[i - 1]);
      const lpc = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(hl, hpc, lpc));
    }
  }

  // Calculate ATR using Wilder smoothing
  let atr: number | null = null;
  for (let i = 0; i < trueRanges.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      // First ATR = simple average of first `period` true ranges
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += trueRanges[i - j];
      }
      atr = sum / period;
      result.push(atr);
    } else {
      // Wilder smoothing: ATR = (prevATR * (period-1) + TR) / period
      atr = (atr! * (period - 1) + trueRanges[i]) / period;
      result.push(atr);
    }
  }

  return result;
}
