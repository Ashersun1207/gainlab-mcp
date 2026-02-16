// Volume Profile calculation — distributes volume across price levels
// Computes POC (Point of Control), VAH/VAL (Value Area High/Low)

import type { OHLCV } from "../data/types.js";

export interface VolumeProfileRow {
  priceMin: number;
  priceMax: number;
  priceMid: number;
  volume: number;
  buyVolume: number;   // close > open candle volume
  sellVolume: number;  // close <= open candle volume
}

export interface VolumeProfileResult {
  rows: VolumeProfileRow[];
  poc: number;          // Point of Control (price mid of highest volume row)
  vah: number;          // Value Area High
  val: number;          // Value Area Low
  totalVolume: number;
  valueAreaPercent: number;
}

/**
 * Calculate Volume Profile from OHLCV data.
 * Distributes each candle's volume proportionally across price rows
 * based on the candle's high-low range.
 */
export function calculateVolumeProfile(
  data: OHLCV[],
  rowCount: number = 24,
  valueAreaPercent: number = 0.7
): VolumeProfileResult {
  if (data.length === 0) {
    return {
      rows: [],
      poc: 0,
      vah: 0,
      val: 0,
      totalVolume: 0,
      valueAreaPercent,
    };
  }

  // Find price range across all data
  let globalHigh = -Infinity;
  let globalLow = Infinity;
  for (const candle of data) {
    if (candle.high > globalHigh) globalHigh = candle.high;
    if (candle.low < globalLow) globalLow = candle.low;
  }

  // Handle edge case: all prices identical
  if (globalHigh === globalLow) {
    const row: VolumeProfileRow = {
      priceMin: globalLow,
      priceMax: globalHigh,
      priceMid: globalLow,
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
    };
    for (const candle of data) {
      if (candle.close > candle.open) {
        row.buyVolume += candle.volume;
      } else {
        row.sellVolume += candle.volume;
      }
      row.volume += candle.volume;
    }
    return {
      rows: [row],
      poc: globalLow,
      vah: globalHigh,
      val: globalLow,
      totalVolume: row.volume,
      valueAreaPercent,
    };
  }

  // Initialize rows
  const rowHeight = (globalHigh - globalLow) / rowCount;
  const rows: VolumeProfileRow[] = [];
  for (let i = 0; i < rowCount; i++) {
    const priceMin = globalLow + i * rowHeight;
    const priceMax = globalLow + (i + 1) * rowHeight;
    rows.push({
      priceMin,
      priceMax,
      priceMid: (priceMin + priceMax) / 2,
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
    });
  }

  // Distribute each candle's volume across overlapping rows
  let totalVolume = 0;
  for (const candle of data) {
    const candleHigh = candle.high;
    const candleLow = candle.low;
    const candleRange = candleHigh - candleLow;
    const isBuy = candle.close > candle.open;

    if (candleRange === 0) {
      // Doji: all volume goes to the single row containing this price
      const rowIdx = Math.min(
        Math.floor((candle.close - globalLow) / rowHeight),
        rowCount - 1
      );
      const idx = Math.max(0, rowIdx);
      if (isBuy) {
        rows[idx].buyVolume += candle.volume;
      } else {
        rows[idx].sellVolume += candle.volume;
      }
      rows[idx].volume += candle.volume;
    } else {
      // Distribute volume proportionally across overlapping rows
      const startRow = Math.max(0, Math.floor((candleLow - globalLow) / rowHeight));
      const endRow = Math.min(rowCount - 1, Math.floor((candleHigh - globalLow) / rowHeight));

      for (let r = startRow; r <= endRow; r++) {
        // Calculate overlap between candle range and row range
        const overlapLow = Math.max(candleLow, rows[r].priceMin);
        const overlapHigh = Math.min(candleHigh, rows[r].priceMax);
        const overlap = Math.max(0, overlapHigh - overlapLow);
        const proportion = overlap / candleRange;
        const vol = candle.volume * proportion;

        if (isBuy) {
          rows[r].buyVolume += vol;
        } else {
          rows[r].sellVolume += vol;
        }
        rows[r].volume += vol;
      }
    }

    totalVolume += candle.volume;
  }

  // Find POC (row with highest volume)
  let pocIndex = 0;
  let maxVol = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].volume > maxVol) {
      maxVol = rows[i].volume;
      pocIndex = i;
    }
  }
  const poc = rows[pocIndex].priceMid;

  // Calculate Value Area: expand from POC until cumulative >= totalVolume * valueAreaPercent
  const targetVolume = totalVolume * valueAreaPercent;
  let cumulativeVolume = rows[pocIndex].volume;
  let vaLowIdx = pocIndex;
  let vaHighIdx = pocIndex;

  while (cumulativeVolume < targetVolume && (vaLowIdx > 0 || vaHighIdx < rows.length - 1)) {
    const belowVol = vaLowIdx > 0 ? rows[vaLowIdx - 1].volume : -1;
    const aboveVol = vaHighIdx < rows.length - 1 ? rows[vaHighIdx + 1].volume : -1;

    if (belowVol >= aboveVol && belowVol >= 0) {
      vaLowIdx--;
      cumulativeVolume += rows[vaLowIdx].volume;
    } else if (aboveVol >= 0) {
      vaHighIdx++;
      cumulativeVolume += rows[vaHighIdx].volume;
    } else {
      break;
    }
  }

  const vah = rows[vaHighIdx].priceMax;
  const val = rows[vaLowIdx].priceMin;

  return {
    rows,
    poc,
    vah,
    val,
    totalVolume,
    valueAreaPercent,
  };
}
