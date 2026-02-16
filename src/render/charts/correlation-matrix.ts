/**
 * Correlation matrix heatmap chart.
 * N×N grid, color-coded by Pearson correlation coefficient.
 * Red = negative, Gray = zero, Green = positive.
 */

import type { EChartsOption } from "echarts";
import type { CorrelationMatrix } from "../../utils/correlation.js";
import { UP_COLOR, DOWN_COLOR, BG_COLOR, TEXT_COLOR, SUB_TEXT_COLOR } from "../themes.js";

interface CorrelationMatrixParams {
  matrix: CorrelationMatrix;
  title?: string;
}

export function buildCorrelationMatrixOption(params: CorrelationMatrixParams): EChartsOption {
  const { matrix, title } = params;
  const { symbols, matrix: data } = matrix;
  const n = symbols.length;

  // Build heatmap data: [x, y, value]
  const heatmapData: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      heatmapData.push([j, i, data[i][j]]);
    }
  }

  const chartTitle = title || `Asset Correlation Matrix (${n} assets)`;

  // Dynamic sizing: labels need space
  const labelMaxLen = Math.max(...symbols.map(s => s.length));
  const leftMargin = Math.max(80, labelMaxLen * 8 + 20);

  return {
    title: {
      text: chartTitle,
      left: "center",
      top: 10,
      textStyle: { color: TEXT_COLOR, fontSize: 16, fontWeight: "bold" },
    },
    tooltip: {
      position: "top",
      formatter: (p: any) => {
        const [x, y, val] = p.data;
        if (x === y) return `<b>${symbols[x]}</b> (self)`;
        const sign = val >= 0 ? "+" : "";
        const color = val >= 0 ? UP_COLOR : DOWN_COLOR;
        return `<b>${symbols[y]}</b> vs <b>${symbols[x]}</b><br/>Correlation: <span style="color:${color}">${sign}${val.toFixed(3)}</span>`;
      },
    },
    grid: {
      left: leftMargin,
      right: 80,
      top: 60,
      bottom: leftMargin,
      containLabel: false,
    },
    xAxis: {
      type: "category",
      data: symbols,
      position: "bottom",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: SUB_TEXT_COLOR,
        fontSize: 11,
        rotate: symbols.length > 8 ? 45 : 0,
      },
      splitArea: { show: false },
    },
    yAxis: {
      type: "category",
      data: [...symbols].reverse(), // top-to-bottom: first symbol at top
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: SUB_TEXT_COLOR,
        fontSize: 11,
      },
      splitArea: { show: false },
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: false,
      orient: "vertical",
      right: 10,
      top: "center",
      inRange: {
        color: [DOWN_COLOR, "#6a3040", "#4a4a6a", "#3a6a50", UP_COLOR],
      },
      textStyle: { color: SUB_TEXT_COLOR },
      text: ["+1", "-1"],
    },
    series: [
      {
        type: "heatmap",
        data: heatmapData.map(([x, y, val]) => [x, n - 1 - y, val]), // flip y for reversed axis
        label: {
          show: true,
          formatter: (p: any) => {
            const val = p.data[2];
            if (val === 1) return "1.00";
            return val.toFixed(2);
          },
          color: TEXT_COLOR,
          fontSize: n > 10 ? 9 : 11,
        },
        emphasis: {
          itemStyle: {
            borderColor: "#fff",
            borderWidth: 2,
          },
        },
        itemStyle: {
          borderColor: BG_COLOR,
          borderWidth: 1,
        },
      },
    ],
  };
}
