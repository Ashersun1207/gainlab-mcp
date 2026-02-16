import type { EChartsOption } from "echarts";
import type { FundamentalData } from "../../data/types.js";
import { BG_COLOR, GRID_COLOR, TEXT_COLOR, SUB_TEXT_COLOR, GAINLAB_THEME } from "../themes.js";

interface FundamentalsChartConfig {
  data: Map<string, FundamentalData[]>;  // symbol -> data
  symbols: string[];
  metrics: string[];
  period: "annual" | "quarter";
}

// Metric mapping: user-friendly names → data keys
const METRIC_MAP: Record<string, { label: string; dataKeys: string[]; format: "currency" | "ratio" | "number" }> = {
  revenue: { label: "Revenue", dataKeys: ["revenue", "totalRevenue"], format: "currency" },
  net_income: { label: "Net Income", dataKeys: ["netIncome"], format: "currency" },
  gross_margin: { label: "Gross Margin", dataKeys: ["grossProfitRatio"], format: "ratio" },
  operating_margin: { label: "Operating Margin", dataKeys: ["operatingIncomeRatio"], format: "ratio" },
  eps: { label: "EPS", dataKeys: ["eps"], format: "number" },
  ebitda: { label: "EBITDA", dataKeys: ["ebitda"], format: "currency" },
};

function formatLargeNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toFixed(1);
}

function formatValue(value: number, format: "currency" | "ratio" | "number"): string {
  if (format === "currency") {
    return formatLargeNumber(value);
  } else if (format === "ratio") {
    return (value * 100).toFixed(1) + "%";
  } else {
    return value.toFixed(2);
  }
}

function extractMetricValue(data: FundamentalData, dataKeys: string[]): number | null {
  for (const key of dataKeys) {
    if (data.metrics[key] !== null && data.metrics[key] !== undefined) {
      return data.metrics[key];
    }
  }
  return null;
}

export function buildFundamentalsOption(config: FundamentalsChartConfig): EChartsOption {
  const { data, symbols, metrics, period } = config;

  // Collect all unique periods across all symbols
  const allPeriods = new Set<string>();
  data.forEach(symbolData => {
    symbolData.forEach(d => allPeriods.add(d.period));
  });
  const periods = Array.from(allPeriods).sort().reverse(); // Most recent first

  // Single company, multiple metrics
  if (symbols.length === 1) {
    return buildSingleCompanyChart(symbols[0], data.get(symbols[0])!, metrics, periods);
  }
  
  // Multiple companies
  if (metrics.length === 1) {
    // Multiple companies, single metric
    return buildMultiCompanySingleMetricChart(symbols, data, metrics[0], periods);
  } else {
    // Multiple companies, multiple metrics - create sub-panels
    return buildMultiCompanyMultiMetricChart(symbols, data, metrics, periods);
  }
}

function buildSingleCompanyChart(
  symbol: string,
  symbolData: FundamentalData[],
  metrics: string[],
  periods: string[]
): EChartsOption {
  const series: any[] = [];
  
  metrics.forEach((metric, idx) => {
    const metricConfig = METRIC_MAP[metric];
    if (!metricConfig) return;

    const values = periods.map(period => {
      const dataPoint = symbolData.find(d => d.period === period);
      if (!dataPoint) return null;
      return extractMetricValue(dataPoint, metricConfig.dataKeys);
    });

    series.push({
      name: metricConfig.label,
      type: "bar",
      data: values,
      itemStyle: {
        color: GAINLAB_THEME.colorPalette[idx % GAINLAB_THEME.colorPalette.length],
      },
      label: {
        show: true,
        position: "top",
        color: TEXT_COLOR,
        fontSize: 10,
        formatter: (params: any) => {
          if (params.value === null) return "";
          return formatValue(params.value, metricConfig.format);
        },
      },
    });
  });

  return {
    backgroundColor: BG_COLOR,
    animation: false,
    title: {
      text: `${symbol} Fundamentals`,
      subtext: metrics.map(m => METRIC_MAP[m]?.label || m).join(", "),
      left: "center",
      textStyle: { color: TEXT_COLOR, fontSize: 16, fontWeight: "bold" },
      subtextStyle: { color: SUB_TEXT_COLOR, fontSize: 12 },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#2d2d44",
      borderColor: "#3d3d5c",
      textStyle: { color: TEXT_COLOR },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return "";
        let tooltip = `<strong>${params[0].axisValue}</strong><br/>`;
        params.forEach((p: any) => {
          if (p.value === null) return;
          const metric = metrics.find(m => METRIC_MAP[m]?.label === p.seriesName);
          const format = metric ? METRIC_MAP[metric].format : "number";
          tooltip += `${p.marker} ${p.seriesName}: ${formatValue(p.value, format)}<br/>`;
        });
        return tooltip;
      },
    },
    legend: {
      top: "8%",
      textStyle: { color: TEXT_COLOR },
    },
    grid: {
      left: "10%",
      right: "5%",
      top: "20%",
      bottom: "10%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: periods,
      axisLine: { lineStyle: { color: GRID_COLOR } },
      axisLabel: { color: SUB_TEXT_COLOR },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: GRID_COLOR } },
      axisLabel: { 
        color: SUB_TEXT_COLOR,
        formatter: (value: number) => formatLargeNumber(value),
      },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    series,
  };
}

function buildMultiCompanySingleMetricChart(
  symbols: string[],
  data: Map<string, FundamentalData[]>,
  metric: string,
  periods: string[]
): EChartsOption {
  const metricConfig = METRIC_MAP[metric];
  if (!metricConfig) {
    throw new Error(`Unknown metric: ${metric}`);
  }

  const series: any[] = [];
  
  symbols.forEach((symbol, idx) => {
    const symbolData = data.get(symbol) || [];
    const values = periods.map(period => {
      const dataPoint = symbolData.find(d => d.period === period);
      if (!dataPoint) return null;
      return extractMetricValue(dataPoint, metricConfig.dataKeys);
    });

    series.push({
      name: symbol,
      type: "bar",
      data: values,
      itemStyle: {
        color: GAINLAB_THEME.colorPalette[idx % GAINLAB_THEME.colorPalette.length],
      },
      label: {
        show: true,
        position: "top",
        color: TEXT_COLOR,
        fontSize: 9,
        formatter: (params: any) => {
          if (params.value === null) return "";
          return formatValue(params.value, metricConfig.format);
        },
      },
    });
  });

  return {
    backgroundColor: BG_COLOR,
    animation: false,
    title: {
      text: `${metricConfig.label} Comparison`,
      subtext: symbols.join(" vs "),
      left: "center",
      textStyle: { color: TEXT_COLOR, fontSize: 16, fontWeight: "bold" },
      subtextStyle: { color: SUB_TEXT_COLOR, fontSize: 12 },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#2d2d44",
      borderColor: "#3d3d5c",
      textStyle: { color: TEXT_COLOR },
      formatter: (params: any) => {
        if (!Array.isArray(params)) return "";
        let tooltip = `<strong>${params[0].axisValue}</strong><br/>`;
        params.forEach((p: any) => {
          if (p.value === null) return;
          tooltip += `${p.marker} ${p.seriesName}: ${formatValue(p.value, metricConfig.format)}<br/>`;
        });
        return tooltip;
      },
    },
    legend: {
      top: "8%",
      textStyle: { color: TEXT_COLOR },
    },
    grid: {
      left: "10%",
      right: "5%",
      top: "20%",
      bottom: "10%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: periods,
      axisLine: { lineStyle: { color: GRID_COLOR } },
      axisLabel: { color: SUB_TEXT_COLOR },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLine: { lineStyle: { color: GRID_COLOR } },
      axisLabel: { 
        color: SUB_TEXT_COLOR,
        formatter: (value: number) => formatValue(value, metricConfig.format),
      },
      splitLine: { lineStyle: { color: GRID_COLOR } },
    },
    series,
  };
}

function buildMultiCompanyMultiMetricChart(
  symbols: string[],
  data: Map<string, FundamentalData[]>,
  metrics: string[],
  periods: string[]
): EChartsOption {
  const grids: any[] = [];
  const xAxes: any[] = [];
  const yAxes: any[] = [];
  const series: any[] = [];
  const titles: any[] = [];

  const panelCount = metrics.length;
  const panelHeight = 80 / panelCount;  // 80% total height divided by panels
  const gap = 2;

  metrics.forEach((metric, metricIdx) => {
    const metricConfig = METRIC_MAP[metric];
    if (!metricConfig) return;

    const topPos = 15 + metricIdx * (panelHeight + gap);

    // Grid
    grids.push({
      left: "10%",
      right: "5%",
      top: `${topPos}%`,
      height: `${panelHeight - gap}%`,
      containLabel: true,
    });

    // X-axis
    xAxes.push({
      type: "category",
      data: periods,
      gridIndex: metricIdx,
      axisLine: { lineStyle: { color: GRID_COLOR } },
      axisLabel: { 
        color: SUB_TEXT_COLOR,
        show: metricIdx === panelCount - 1,  // Only show labels on bottom panel
      },
      splitLine: { show: false },
    });

    // Y-axis
    yAxes.push({
      type: "value",
      gridIndex: metricIdx,
      axisLine: { lineStyle: { color: GRID_COLOR } },
      axisLabel: { 
        color: SUB_TEXT_COLOR,
        formatter: (value: number) => formatValue(value, metricConfig.format),
      },
      splitLine: { lineStyle: { color: GRID_COLOR } },
      name: metricConfig.label,
      nameTextStyle: { color: TEXT_COLOR, fontSize: 12 },
    });

    // Series for each symbol
    symbols.forEach((symbol, symbolIdx) => {
      const symbolData = data.get(symbol) || [];
      const values = periods.map(period => {
        const dataPoint = symbolData.find(d => d.period === period);
        if (!dataPoint) return null;
        return extractMetricValue(dataPoint, metricConfig.dataKeys);
      });

      series.push({
        name: `${symbol}`,
        type: "bar",
        data: values,
        xAxisIndex: metricIdx,
        yAxisIndex: metricIdx,
        itemStyle: {
          color: GAINLAB_THEME.colorPalette[symbolIdx % GAINLAB_THEME.colorPalette.length],
        },
        label: {
          show: true,
          position: "top",
          color: TEXT_COLOR,
          fontSize: 8,
          formatter: (params: any) => {
            if (params.value === null) return "";
            return formatValue(params.value, metricConfig.format);
          },
        },
      });
    });
  });

  return {
    backgroundColor: BG_COLOR,
    animation: false,
    title: {
      text: `Fundamentals Comparison`,
      subtext: `${symbols.join(" vs ")} — ${metrics.map(m => METRIC_MAP[m]?.label || m).join(", ")}`,
      left: "center",
      textStyle: { color: TEXT_COLOR, fontSize: 16, fontWeight: "bold" },
      subtextStyle: { color: SUB_TEXT_COLOR, fontSize: 11 },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#2d2d44",
      borderColor: "#3d3d5c",
      textStyle: { color: TEXT_COLOR },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const metricIdx = params[0].axisIndex;
        const metric = metrics[metricIdx];
        const metricConfig = METRIC_MAP[metric];
        
        let tooltip = `<strong>${params[0].axisValue}</strong> — ${metricConfig.label}<br/>`;
        params.forEach((p: any) => {
          if (p.value === null) return;
          tooltip += `${p.marker} ${p.seriesName}: ${formatValue(p.value, metricConfig.format)}<br/>`;
        });
        return tooltip;
      },
    },
    legend: {
      top: "6%",
      textStyle: { color: TEXT_COLOR },
    },
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series,
    dataZoom: [
      {
        type: "inside",
        xAxisIndex: Array.from({ length: panelCount }, (_, i) => i),
        start: 0,
        end: 100,
      },
    ],
  };
}
