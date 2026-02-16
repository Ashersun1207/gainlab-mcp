// WRB Scoring Chart - K-line with WRB/HG annotations
// Visualizes Wide Range Bars and Hidden Gaps for technical analysis

import type { EChartsOption } from "echarts";
import type { OHLCV } from "../../data/types.js";
import type { WRBResult } from "../../utils/wrb.js";
import { UP_COLOR, DOWN_COLOR, BG_COLOR, GRID_COLOR, TEXT_COLOR, SUB_TEXT_COLOR } from "../themes.js";

export interface WRBScoringChartConfig {
  data: OHLCV[];
  symbol: string;
  timeframe: string;
  wrbResult: WRBResult;
}

export function buildWRBScoringOption(config: WRBScoringChartConfig): EChartsOption {
  const { data, symbol, timeframe, wrbResult } = config;
  const { wrbFlags, gaps, summary } = wrbResult;

  // Format dates for x-axis
  const dates = data.map(d => {
    const date = new Date(d.timestamp);
    return timeframe.includes("m") || timeframe === "1h" || timeframe === "4h"
      ? date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  });

  const ohlc = data.map(d => [d.open, d.close, d.low, d.high]);
  const volumes = data.map(d => d.volume);
  const volumeColors = data.map(d => d.close >= d.open ? UP_COLOR : DOWN_COLOR);

  // Build WRB markPoint data (diamond markers at WRB candle midpoint)
  const wrbMarkPoints: any[] = [];
  for (let i = 0; i < wrbFlags.length; i++) {
    if (wrbFlags[i]) {
      const bar = data[i];
      const bodyMid = (bar.open + bar.close) / 2;
      wrbMarkPoints.push({
        coord: [i, bodyMid],
        symbol: "diamond",
        symbolSize: 12,
        itemStyle: { color: "#FF00FF" },
      });
    }
  }

  // Build Hidden Gap markArea data (rectangles)
  const gapMarkAreas: any[] = [];
  const gapLabels: any[] = []; // For gap width labels

  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    if (!gap) continue;

    // Determine color based on type and filled status
    let areaColor: string;
    if (gap.type === "buy") {
      areaColor = gap.filled ? "rgba(0, 150, 255, 0.12)" : "rgba(0, 195, 255, 0.35)";
    } else {
      areaColor = gap.filled ? "rgba(255, 50, 50, 0.12)" : "rgba(255, 26, 26, 0.35)";
    }

    // markArea spans from startIndex to endIndex
    gapMarkAreas.push([
      { xAxis: gap.startIndex, yAxis: gap.bottom },
      { xAxis: gap.endIndex, yAxis: gap.top, itemStyle: { color: areaColor } },
    ]);

    // Gap width label (positioned in the middle of the gap)
    const midIndex = Math.floor((gap.startIndex + gap.endIndex) / 2);
    const midPrice = (gap.top + gap.bottom) / 2;
    gapLabels.push({
      coord: [midIndex, midPrice],
      value: gap.diff.toFixed(2),
      label: {
        show: true,
        formatter: gap.diff.toFixed(2),
        color: "#ffffff",
        fontSize: 10,
        fontWeight: "bold",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        padding: [2, 4],
        borderRadius: 3,
      },
    });

    // Pro label (if gap is Pro)
    if (gap.pro) {
      const proText = gap.type === "buy" ? "PRO ▲" : "PRO ▼";
      const proColor = gap.type === "buy" ? "#00d4aa" : "#ff4757";
      const labelY = gap.top - (gap.top - gap.bottom) * 0.1; // Near top

      gapLabels.push({
        coord: [gap.startIndex, labelY],
        value: proText,
        label: {
          show: true,
          formatter: proText,
          color: proColor,
          fontSize: 11,
          fontWeight: "bold",
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          padding: [2, 6],
          borderRadius: 3,
        },
      });
    }
  }

  // Build title subtitle with summary
  const subtitle = `WRB: ${summary.totalWRB} | Gaps: ${summary.totalGaps} (Active: ${summary.activeGaps}, Filled: ${summary.filledGaps}) | Pro: ${summary.proGaps}`;

  return {
    backgroundColor: BG_COLOR,
    animation: false,
    title: {
      text: `${symbol} — ${timeframe} WRB/HG Analysis`,
      subtext: subtitle,
      left: "center",
      textStyle: { color: TEXT_COLOR, fontSize: 16, fontWeight: "bold" },
      subtextStyle: { color: SUB_TEXT_COLOR },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      backgroundColor: "#2d2d44",
      borderColor: "#3d3d5c",
      textStyle: { color: TEXT_COLOR },
    },
    grid: [
      // Main chart (candlestick)
      { left: "8%", right: "4%", top: "15%", height: "55%" },
      // Volume chart
      { left: "8%", right: "4%", top: "75%", height: "18%" },
    ],
    xAxis: [
      // xAxis 0: candlestick
      {
        type: "category",
        data: dates,
        gridIndex: 0,
        axisLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { color: SUB_TEXT_COLOR, fontSize: 10 },
        splitLine: { show: false },
      },
      // xAxis 1: volume
      {
        type: "category",
        data: dates,
        gridIndex: 1,
        axisLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      // yAxis 0: candlestick prices
      {
        type: "value",
        gridIndex: 0,
        splitLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { color: SUB_TEXT_COLOR },
        axisLine: { lineStyle: { color: GRID_COLOR } },
        scale: true,
      },
      // yAxis 1: volume
      {
        type: "value",
        gridIndex: 1,
        splitLine: { show: false },
        axisLabel: { show: false },
        axisLine: { show: false },
      },
    ],
    series: [
      // Candlestick series with WRB marks and gap areas
      {
        name: "K Line",
        type: "candlestick",
        data: ohlc,
        xAxisIndex: 0,
        yAxisIndex: 0,
        itemStyle: {
          color: UP_COLOR,
          color0: DOWN_COLOR,
          borderColor: UP_COLOR,
          borderColor0: DOWN_COLOR,
        },
        markPoint: {
          data: [...wrbMarkPoints, ...gapLabels],
          symbol: "circle", // Default for labels
          symbolSize: 0, // Hide the marker itself for labels
        },
        markArea: {
          data: gapMarkAreas,
          silent: false,
        },
      },
      // Volume bars
      {
        name: "Volume",
        type: "bar",
        data: volumes.map((v, i) => ({
          value: v,
          itemStyle: { color: volumeColors[i] + "80" },
        })),
        xAxisIndex: 1,
        yAxisIndex: 1,
      },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], start: 0, end: 100 },
    ],
  };
}
