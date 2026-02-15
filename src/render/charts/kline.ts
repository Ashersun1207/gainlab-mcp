import type { EChartsOption } from "echarts";
import { OHLCV } from "../../data/types.js";
import { UP_COLOR, DOWN_COLOR, BG_COLOR, GRID_COLOR, TEXT_COLOR, SUB_TEXT_COLOR } from "../themes.js";

export function buildKlineOption(data: OHLCV[], symbol: string, timeframe: string): EChartsOption {
  const dates = data.map(d => {
    const date = new Date(d.timestamp);
    return timeframe.includes("m") || timeframe === "1h" || timeframe === "4h"
      ? date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  });

  const ohlc = data.map(d => [d.open, d.close, d.low, d.high]);
  const volumes = data.map(d => d.volume);
  const volumeColors = data.map(d => d.close >= d.open ? UP_COLOR : DOWN_COLOR);

  return {
    backgroundColor: BG_COLOR,
    animation: false,
    title: {
      text: `${symbol} — ${timeframe}`,
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
      { left: "8%", right: "4%", top: "12%", height: "55%" },
      { left: "8%", right: "4%", top: "72%", height: "18%" },
    ],
    xAxis: [
      {
        type: "category",
        data: dates,
        gridIndex: 0,
        axisLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { color: SUB_TEXT_COLOR, fontSize: 10 },
        splitLine: { show: false },
      },
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
      {
        type: "value",
        gridIndex: 0,
        splitLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { color: SUB_TEXT_COLOR },
        axisLine: { lineStyle: { color: GRID_COLOR } },
        scale: true,
      },
      {
        type: "value",
        gridIndex: 1,
        splitLine: { show: false },
        axisLabel: { show: false },
        axisLine: { show: false },
      },
    ],
    series: [
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
      },
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
