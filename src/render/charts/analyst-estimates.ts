import type { EChartsOption } from "echarts";
import { BG_COLOR, TEXT_COLOR, SUB_TEXT_COLOR, GRID_COLOR, GAINLAB_THEME } from "../themes.js";
import type { FundamentalData } from "../../data/types.js";

interface EstimatesChartConfig {
  symbol: string;
  actuals: FundamentalData[];    // Historical data
  estimates: FundamentalData[];  // Forward estimates
  metric: "revenue" | "eps";     // Which metric to show
}

export function buildEstimatesOption(config: EstimatesChartConfig): EChartsOption {
  const { symbol, actuals, estimates, metric } = config;
  
  // Combine and sort all periods
  const actualPeriods = actuals.map(a => a.period).reverse(); // chronological
  const estimatePeriods = estimates.map(e => e.period).reverse();
  const allPeriods = [...actualPeriods, ...estimatePeriods];
  
  const metricKey = metric === "revenue" ? "revenue" : "eps";
  const avgKey = metric === "revenue" ? "revenueAvg" : "epsAvg";
  const lowKey = metric === "revenue" ? "revenueLow" : "epsLow";
  const highKey = metric === "revenue" ? "revenueHigh" : "epsHigh";
  const label = metric === "revenue" ? "Revenue" : "EPS";
  
  // Actual values
  const actualValues = allPeriods.map(p => {
    const d = actuals.find(a => a.period === p);
    return d?.metrics[metricKey] ?? null;
  });
  
  // Estimate avg values
  const estimateValues = allPeriods.map(p => {
    const d = estimates.find(e => e.period === p);
    return d?.metrics[avgKey] ?? null;
  });
  
  // Error bars (low/high)
  const errorData = allPeriods.map(p => {
    const d = estimates.find(e => e.period === p);
    if (!d) return null;
    return [d.metrics[lowKey], d.metrics[highKey]];
  });

  const formatValue = (v: number) => {
    if (metric === "eps") return "$" + v.toFixed(2);
    if (Math.abs(v) >= 1e9) return "$" + (v / 1e9).toFixed(1) + "B";
    if (Math.abs(v) >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    return "$" + v.toFixed(0);
  };

  return {
    backgroundColor: BG_COLOR,
    animation: false,
    title: {
      text: `${symbol} — ${label} Actual vs Estimates`,
      left: "center",
      textStyle: { color: TEXT_COLOR, fontSize: 16, fontWeight: "bold" },
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "#2d2d44",
      borderColor: "#3d3d5c",
      textStyle: { color: TEXT_COLOR },
    },
    legend: {
      top: "8%",
      textStyle: { color: TEXT_COLOR },
    },
    grid: {
      left: "10%",
      right: "5%",
      top: "18%",
      bottom: "10%",
    },
    xAxis: {
      type: "category",
      data: allPeriods,
      axisLine: { lineStyle: { color: GRID_COLOR } },
      axisLabel: { color: SUB_TEXT_COLOR },
    },
    yAxis: {
      type: "value",
      axisLabel: { 
        color: SUB_TEXT_COLOR,
        formatter: (v: number) => formatValue(v),
      },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    series: [
      {
        name: `Actual ${label}`,
        type: "bar",
        data: actualValues,
        itemStyle: { color: GAINLAB_THEME.colorPalette[0] },
        label: {
          show: true,
          position: "top",
          color: TEXT_COLOR,
          fontSize: 10,
          formatter: (p: any) => p.value ? formatValue(p.value) : "",
        },
      },
      {
        name: `Estimated ${label}`,
        type: "bar",
        data: estimateValues,
        itemStyle: { 
          color: "rgba(91, 143, 249, 0.5)",
          borderColor: "#5b8ff9",
          borderWidth: 2,
          borderType: "dashed",
        },
        label: {
          show: true,
          position: "top",
          color: "#5b8ff9",
          fontSize: 10,
          formatter: (p: any) => p.value ? formatValue(p.value) : "",
        },
      },
      // Error bars for estimate ranges
      {
        name: "Estimate Range",
        type: "custom",
        data: errorData.map((d, i) => d ? [i, d[0], d[1]] : null).filter(Boolean),
        renderItem: (params: any, api: any) => {
          const xValue = api.value(0);
          const low = api.coord([xValue, api.value(1)]);
          const high = api.coord([xValue, api.value(2)]);
          const halfWidth = 10;
          return {
            type: "group",
            children: [
              { type: "line", shape: { x1: low[0], y1: low[1], x2: low[0], y2: high[1] }, style: { stroke: "#5b8ff9", lineWidth: 2 } },
              { type: "line", shape: { x1: low[0] - halfWidth, y1: low[1], x2: low[0] + halfWidth, y2: low[1] }, style: { stroke: "#5b8ff9", lineWidth: 2 } },
              { type: "line", shape: { x1: high[0] - halfWidth, y1: high[1], x2: high[0] + halfWidth, y2: high[1] }, style: { stroke: "#5b8ff9", lineWidth: 2 } },
            ],
          };
        },
      },
    ],
  };
}
