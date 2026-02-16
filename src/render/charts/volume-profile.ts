// Volume Profile ECharts chart builder
// Left: K-line chart, Right: horizontal volume distribution bars

import type { EChartsOption } from "echarts";
import type { OHLCV } from "../../data/types.js";
import type { VolumeProfileResult } from "../../utils/volume-profile.js";
import { UP_COLOR, DOWN_COLOR, BG_COLOR, GRID_COLOR, TEXT_COLOR, SUB_TEXT_COLOR } from "../themes.js";

interface VolumeProfileChartParams {
  data: OHLCV[];
  symbol: string;
  timeframe: string;
  vpResult: VolumeProfileResult;
}

export function buildVolumeProfileOption(params: VolumeProfileChartParams): EChartsOption {
  const { data, symbol, timeframe, vpResult } = params;
  const { rows, poc, vah, val } = vpResult;

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

  // Build VP bar category labels (price levels)
  const vpCategories = rows.map(r => r.priceMid.toFixed(2));

  // Find POC row index for highlighting
  const pocRowIndex = rows.findIndex(r => Math.abs(r.priceMid - poc) < 1e-10);

  // Determine value area row indices
  const vaRowIndices = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].priceMin >= val - 1e-10 && rows[i].priceMax <= vah + 1e-10) {
      vaRowIndices.add(i);
    }
  }

  // Build buy/sell volume bar data with styling
  const buyVolumeData = rows.map((r, i) => ({
    value: r.buyVolume,
    itemStyle: {
      color: UP_COLOR,
      opacity: vaRowIndices.has(i) ? 0.9 : 0.5,
      ...(i === pocRowIndex ? { borderColor: "#ffffff", borderWidth: 2 } : {}),
    },
  }));

  const sellVolumeData = rows.map((r, i) => ({
    value: r.sellVolume,
    itemStyle: {
      color: DOWN_COLOR,
      opacity: vaRowIndices.has(i) ? 0.9 : 0.5,
      ...(i === pocRowIndex ? { borderColor: "#ffffff", borderWidth: 2 } : {}),
    },
  }));

  // Get price range for aligned yAxis
  let priceMin = Infinity;
  let priceMax = -Infinity;
  for (const d of data) {
    if (d.low < priceMin) priceMin = d.low;
    if (d.high > priceMax) priceMax = d.high;
  }

  // markLine data for POC, VAH, VAL on the K-line chart
  const markLineData: any[] = [
    {
      yAxis: poc,
      label: { show: true, formatter: `POC ${poc.toFixed(2)}`, position: "insideStartTop", color: "#ffffff", fontSize: 10 },
      lineStyle: { color: "#ffffff", type: "solid", width: 1.5 },
    },
    {
      yAxis: vah,
      label: { show: true, formatter: `VAH ${vah.toFixed(2)}`, position: "insideStartTop", color: "#ffc233", fontSize: 10 },
      lineStyle: { color: "#ffc233", type: "dashed", width: 1 },
    },
    {
      yAxis: val,
      label: { show: true, formatter: `VAL ${val.toFixed(2)}`, position: "insideStartTop", color: "#ffc233", fontSize: 10 },
      lineStyle: { color: "#ffc233", type: "dashed", width: 1 },
    },
  ];

  return {
    backgroundColor: BG_COLOR,
    animation: false,
    title: {
      text: `${symbol} — ${timeframe} Volume Profile`,
      subtext: `POC: ${poc.toFixed(2)} | VAH: ${vah.toFixed(2)} | VAL: ${val.toFixed(2)}`,
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
    // Two grids side-by-side: left=K-line, right=VP bars
    // Plus a volume grid below the K-line
    grid: [
      // Grid 0: K-line (left)
      { left: "6%", right: "32%", top: "12%", height: "50%" },
      // Grid 1: Volume bars below K-line
      { left: "6%", right: "32%", top: "66%", height: "14%" },
      // Grid 2: VP horizontal bars (right)
      { left: "72%", right: "3%", top: "12%", height: "50%" },
    ],
    xAxis: [
      // xAxis 0: K-line dates
      {
        type: "category",
        data: dates,
        gridIndex: 0,
        axisLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { color: SUB_TEXT_COLOR, fontSize: 9 },
        splitLine: { show: false },
      },
      // xAxis 1: Volume bar dates
      {
        type: "category",
        data: dates,
        gridIndex: 1,
        axisLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
      // xAxis 2: VP volume values (horizontal)
      {
        type: "value",
        gridIndex: 2,
        axisLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { color: SUB_TEXT_COLOR, fontSize: 9 },
        splitLine: { lineStyle: { color: GRID_COLOR, opacity: 0.3 } },
        position: "top",
      },
    ],
    yAxis: [
      // yAxis 0: K-line prices
      {
        type: "value",
        gridIndex: 0,
        splitLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { color: SUB_TEXT_COLOR },
        axisLine: { lineStyle: { color: GRID_COLOR } },
        scale: true,
        min: priceMin,
        max: priceMax,
      },
      // yAxis 1: Volume
      {
        type: "value",
        gridIndex: 1,
        splitLine: { show: false },
        axisLabel: { show: false },
        axisLine: { show: false },
      },
      // yAxis 2: VP price categories (aligned with K-line yAxis)
      {
        type: "category",
        data: vpCategories,
        gridIndex: 2,
        axisLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { color: SUB_TEXT_COLOR, fontSize: 9 },
        axisTick: { show: false },
      },
    ],
    series: [
      // K-line candlestick
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
        markLine: {
          symbol: "none",
          data: markLineData,
          silent: true,
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
      // VP Buy Volume (horizontal bar)
      {
        name: "Buy Volume",
        type: "bar",
        data: buyVolumeData,
        xAxisIndex: 2,
        yAxisIndex: 2,
        barWidth: "40%",
        stack: "vp",
      },
      // VP Sell Volume (horizontal bar, stacked)
      {
        name: "Sell Volume",
        type: "bar",
        data: sellVolumeData,
        xAxisIndex: 2,
        yAxisIndex: 2,
        barWidth: "40%",
        stack: "vp",
      },
    ],
    dataZoom: [
      { type: "inside", xAxisIndex: [0, 1], start: 0, end: 100 },
    ],
    legend: {
      show: true,
      top: "3%",
      left: "6%",
      textStyle: { color: TEXT_COLOR, fontSize: 10 },
      itemWidth: 20,
      itemHeight: 10,
    },
  };
}
