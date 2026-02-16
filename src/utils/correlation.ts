/**
 * Pearson correlation coefficient calculation for financial data.
 */

import { getKlines, type OHLCV, type Market } from "../data/index.js";

/**
 * Calculate Pearson correlation coefficient between two arrays.
 * Returns NaN if arrays have fewer than 2 elements or zero variance.
 */
export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i];
    sumY2 += y[i] * y[i];
  }

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  if (denominator === 0) return NaN;
  return numerator / denominator;
}

/**
 * Compute daily log returns from close prices.
 * Returns array of length (prices.length - 1).
 */
export function computeReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] === 0) {
      returns.push(0);
    } else {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return returns;
}

export interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];  // matrix[i][j] = correlation between symbol i and j
}

/**
 * Build an N×N correlation matrix for multiple assets.
 *
 * Steps:
 * 1. Fetch daily klines for each asset
 * 2. Extract closing prices keyed by date string (YYYY-MM-DD)
 * 3. Find common dates across all assets
 * 4. Compute daily returns on common dates
 * 5. Calculate pairwise Pearson correlation
 */
export async function buildCorrelationMatrix(
  assets: { symbol: string; market: Market }[],
  days: number = 90
): Promise<CorrelationMatrix> {
  if (assets.length < 2) {
    throw new Error("Need at least 2 assets for correlation matrix");
  }
  if (assets.length > 20) {
    throw new Error("Maximum 20 assets for correlation matrix");
  }

  // Fetch klines for all assets in parallel
  // Request extra days to account for weekends/holidays
  const fetchLimit = Math.ceil(days * 1.5);
  const allKlines = await Promise.all(
    assets.map(a => getKlines(a.symbol, a.market, "1d", fetchLimit))
  );

  // Build price map per asset: { "2026-01-15": closePrice }
  const priceMaps: Map<string, number>[] = allKlines.map(klines => {
    const m = new Map<string, number>();
    for (const k of klines) {
      const dateStr = new Date(k.timestamp).toISOString().split("T")[0];
      m.set(dateStr, k.close);
    }
    return m;
  });

  // Find common dates across all assets
  const allDates = new Set<string>();
  priceMaps[0].forEach((_, date) => allDates.add(date));

  const commonDates: string[] = [];
  for (const date of allDates) {
    if (priceMaps.every(m => m.has(date))) {
      commonDates.push(date);
    }
  }
  commonDates.sort(); // ascending

  // Limit to most recent `days` common dates
  const recentDates = commonDates.slice(-days);

  if (recentDates.length < 10) {
    throw new Error(
      `Only ${recentDates.length} common trading dates found (need at least 10). ` +
      `This may happen with cross-market assets that have different trading calendars.`
    );
  }

  // Extract aligned close prices and compute returns
  const returnsPerAsset: number[][] = assets.map((_, idx) => {
    const prices = recentDates.map(d => priceMaps[idx].get(d)!);
    return computeReturns(prices);
  });

  // Build N×N correlation matrix
  const n = assets.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0; // self-correlation
    for (let j = i + 1; j < n; j++) {
      const corr = pearsonCorrelation(returnsPerAsset[i], returnsPerAsset[j]);
      const rounded = Math.round(corr * 1000) / 1000; // 3 decimal places
      matrix[i][j] = rounded;
      matrix[j][i] = rounded; // symmetric
    }
  }

  return {
    symbols: assets.map(a => a.symbol),
    matrix,
  };
}
