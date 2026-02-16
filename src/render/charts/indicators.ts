import type { EChartsOption } from "echarts";
import { OHLCV } from "../../data/types.js";
import { UP_COLOR, DOWN_COLOR, BG_COLOR, GRID_COLOR, TEXT_COLOR, SUB_TEXT_COLOR, GAINLAB_THEME } from "../themes.js";
import {
  calculateMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateBOLL,
  calculateKDJ,
} from "../../utils/ta.js";

type IndicatorType = "MA" | "EMA" | "RSI" | "MACD" | "BOLL" | "KDJ" | "VOL";

interface IndicatorsParams {
  data: OHLCV[];
  symbol: string;
  timeframe: string;
  indicators: IndicatorType[];
  maPeriods?: number[];
}

export function buildIndicatorsOption(params: IndicatorsParams): EChartsOption {
  const { data, symbol, timeframe, indicators, maPeriods = [7, 25, 99] } = params;

  // Format dates for x-axis
  const dates = data.map(d => {
    const date = new Date(d.timestamp);
    return timeframe.includes("m") || timeframe === "1h" || timeframe === "4h"
      ? date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
      : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  });

  // Extract price data
  const ohlc = data.map(d => [d.open, d.close, d.low, d.high]);
  const closes = data.map(d => d.close);
  const highs = data.map(d => d.high);
  const lows = data.map(d => d.low);
  const volumes = data.map(d => d.volume);
  const volumeColors = data.map(d => d.close >= d.open ? UP_COLOR : DOWN_COLOR);

  // Determine which indicators need separate panels
  const overlayIndicators = indicators.filter(i => ["MA", "EMA", "BOLL"].includes(i));
  const subIndicators = indicators.filter(i => ["RSI", "MACD", "KDJ"].includes(i));
  
  // Calculate grid layout
  // Main panel (K-line): 45%
  // Volume panel: 12%
  // Sub-indicator panels: 15% each
  const mainHeight = 45;
  const volumeHeight = 12;
  const subPanelHeight = 15;
  const gap = 1; // Gap between panels
  
  let currentTop = 12; // Start below title
  
  // Grid configurations
  const grids: any[] = [];
  const xAxes: any[] = [];
  const yAxes: any[] = [];
  const series: any[] = [];
  
  // Grid 0: Main K-line panel
  grids.push({
    left: "8%",
    right: "4%",
    top: `${currentTop}%`,
    height: `${mainHeight}%`,
  });
  currentTop += mainHeight + gap;
  
  // Grid 1: Volume panel (always present)
  grids.push({
    left: "8%",
    right: "4%",
    top: `${currentTop}%`,
    height: `${volumeHeight}%`,
  });
  currentTop += volumeHeight + gap;
  
  // Add sub-indicator grids
  subIndicators.forEach((indicator, index) => {
    grids.push({
      left: "8%",
      right: "4%",
      top: `${currentTop}%`,
      height: `${subPanelHeight}%`,
    });
    currentTop += subPanelHeight + gap;
  });
  
  // Create xAxis for each grid
  grids.forEach((grid, index) => {
    xAxes.push({
      type: "category",
      data: dates,
      gridIndex: index,
      axisLine: { lineStyle: { color: GRID_COLOR } },
      axisLabel: index === grids.length - 1 
        ? { color: SUB_TEXT_COLOR, fontSize: 10 }
        : { show: false },
      splitLine: { show: false },
    });
  });
  
  // Create yAxis for each grid
  grids.forEach((grid, index) => {
    if (index === 0) {
      // Main panel y-axis
      yAxes.push({
        type: "value",
        gridIndex: index,
        splitLine: { lineStyle: { color: GRID_COLOR } },
        axisLabel: { color: SUB_TEXT_COLOR },
        axisLine: { lineStyle: { color: GRID_COLOR } },
        scale: true,
      });
    } else if (index === 1) {
      // Volume panel y-axis
      yAxes.push({
        type: "value",
        gridIndex: index,
        splitLine: { show: false },
        axisLabel: { show: false },
        axisLine: { show: false },
      });
    } else {
      // Sub-indicator y-axis
      yAxes.push({
        type: "value",
        gridIndex: index,
        splitLine: { lineStyle: { color: GRID_COLOR, opacity: 0.3 } },
        axisLabel: { color: SUB_TEXT_COLOR, fontSize: 10 },
        axisLine: { lineStyle: { color: GRID_COLOR } },
        scale: true,
      });
    }
  });
  
  // Series: K-line candlestick
  series.push({
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
  });
  
  // Series: Volume bars
  series.push({
    name: "Volume",
    type: "bar",
    data: volumes.map((v, i) => ({
      value: v,
      itemStyle: { color: volumeColors[i] + "80" },
    })),
    xAxisIndex: 1,
    yAxisIndex: 1,
  });
  
  // Add overlay indicators (MA/EMA/BOLL)
  const colors = GAINLAB_THEME.colorPalette;
  let colorIndex = 0;
  
  if (overlayIndicators.includes("MA")) {
    maPeriods.forEach((period, idx) => {
      const ma = calculateMA(closes, period);
      series.push({
        name: `MA${period}`,
        type: "line",
        data: ma,
        xAxisIndex: 0,
        yAxisIndex: 0,
        smooth: true,
        lineStyle: { width: 1.5, color: colors[colorIndex % colors.length] },
        showSymbol: false,
      });
      colorIndex++;
    });
  }
  
  if (overlayIndicators.includes("EMA")) {
    maPeriods.forEach((period, idx) => {
      const ema = calculateEMA(closes, period);
      series.push({
        name: `EMA${period}`,
        type: "line",
        data: ema,
        xAxisIndex: 0,
        yAxisIndex: 0,
        smooth: true,
        lineStyle: { width: 1.5, color: colors[colorIndex % colors.length] },
        showSymbol: false,
      });
      colorIndex++;
    });
  }
  
  if (overlayIndicators.includes("BOLL")) {
    const boll = calculateBOLL(closes, 20, 2);
    series.push(
      {
        name: "BOLL Upper",
        type: "line",
        data: boll.upper,
        xAxisIndex: 0,
        yAxisIndex: 0,
        lineStyle: { width: 1, color: colors[1], opacity: 0.5 },
        showSymbol: false,
      },
      {
        name: "BOLL Middle",
        type: "line",
        data: boll.middle,
        xAxisIndex: 0,
        yAxisIndex: 0,
        lineStyle: { width: 1.5, color: colors[1] },
        showSymbol: false,
      },
      {
        name: "BOLL Lower",
        type: "line",
        data: boll.lower,
        xAxisIndex: 0,
        yAxisIndex: 0,
        lineStyle: { width: 1, color: colors[1], opacity: 0.5 },
        showSymbol: false,
      }
    );
  }
  
  // Add sub-indicator series
  let subPanelIndex = 2; // Start after main and volume panels
  
  if (subIndicators.includes("RSI")) {
    const rsi = calculateRSI(closes, 14);
    const rsiXAxisIndex = subPanelIndex;
    const rsiYAxisIndex = subPanelIndex;
    
    series.push({
      name: "RSI(14)",
      type: "line",
      data: rsi,
      xAxisIndex: rsiXAxisIndex,
      yAxisIndex: rsiYAxisIndex,
      smooth: true,
      lineStyle: { width: 1.5, color: colors[2] },
      showSymbol: false,
    });
    
    // Add reference lines at 30 and 70
    series.push(
      {
        name: "RSI 70",
        type: "line",
        data: new Array(data.length).fill(70),
        xAxisIndex: rsiXAxisIndex,
        yAxisIndex: rsiYAxisIndex,
        lineStyle: { width: 1, color: "#ff4757", type: "dashed", opacity: 0.5 },
        showSymbol: false,
        silent: true,
      },
      {
        name: "RSI 30",
        type: "line",
        data: new Array(data.length).fill(30),
        xAxisIndex: rsiXAxisIndex,
        yAxisIndex: rsiYAxisIndex,
        lineStyle: { width: 1, color: "#00d4aa", type: "dashed", opacity: 0.5 },
        showSymbol: false,
        silent: true,
      }
    );
    
    subPanelIndex++;
  }
  
  if (subIndicators.includes("MACD")) {
    const macd = calculateMACD(closes, 12, 26, 9);
    const macdXAxisIndex = subPanelIndex;
    const macdYAxisIndex = subPanelIndex;
    
    // MACD histogram
    series.push({
      name: "MACD Histogram",
      type: "bar",
      data: macd.histogram.map(h => ({
        value: h,
        itemStyle: { color: h && h >= 0 ? UP_COLOR + "80" : DOWN_COLOR + "80" },
      })),
      xAxisIndex: macdXAxisIndex,
      yAxisIndex: macdYAxisIndex,
    });
    
    // MACD line
    series.push({
      name: "MACD",
      type: "line",
      data: macd.macd,
      xAxisIndex: macdXAxisIndex,
      yAxisIndex: macdYAxisIndex,
      lineStyle: { width: 1.5, color: colors[3] },
      showSymbol: false,
    });
    
    // Signal line
    series.push({
      name: "Signal",
      type: "line",
      data: macd.signal,
      xAxisIndex: macdXAxisIndex,
      yAxisIndex: macdYAxisIndex,
      lineStyle: { width: 1.5, color: colors[4] },
      showSymbol: false,
    });
    
    subPanelIndex++;
  }
  
  if (subIndicators.includes("KDJ")) {
    const kdj = calculateKDJ(highs, lows, closes, 9);
    const kdjXAxisIndex = subPanelIndex;
    const kdjYAxisIndex = subPanelIndex;
    
    series.push(
      {
        name: "K",
        type: "line",
        data: kdj.k,
        xAxisIndex: kdjXAxisIndex,
        yAxisIndex: kdjYAxisIndex,
        smooth: true,
        lineStyle: { width: 1.5, color: colors[0] },
        showSymbol: false,
      },
      {
        name: "D",
        type: "line",
        data: kdj.d,
        xAxisIndex: kdjXAxisIndex,
        yAxisIndex: kdjYAxisIndex,
        smooth: true,
        lineStyle: { width: 1.5, color: colors[1] },
        showSymbol: false,
      },
      {
        name: "J",
        type: "line",
        data: kdj.j,
        xAxisIndex: kdjXAxisIndex,
        yAxisIndex: kdjYAxisIndex,
        smooth: true,
        lineStyle: { width: 1.5, color: colors[5] },
        showSymbol: false,
      }
    );
    
    // Add reference lines at 20 and 80
    series.push(
      {
        name: "KDJ 80",
        type: "line",
        data: new Array(data.length).fill(80),
        xAxisIndex: kdjXAxisIndex,
        yAxisIndex: kdjYAxisIndex,
        lineStyle: { width: 1, color: "#ff4757", type: "dashed", opacity: 0.5 },
        showSymbol: false,
        silent: true,
      },
      {
        name: "KDJ 20",
        type: "line",
        data: new Array(data.length).fill(20),
        xAxisIndex: kdjXAxisIndex,
        yAxisIndex: kdjYAxisIndex,
        lineStyle: { width: 1, color: "#00d4aa", type: "dashed", opacity: 0.5 },
        showSymbol: false,
        silent: true,
      }
    );
    
    subPanelIndex++;
  }
  
  // Build indicator list for title
  const indicatorNames = [
    ...overlayIndicators,
    ...subIndicators,
  ].join(" + ");
  
  return {
    backgroundColor: BG_COLOR,
    animation: false,
    title: {
      text: `${symbol} — ${timeframe}`,
      subtext: `Indicators: ${indicatorNames}`,
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
    grid: grids,
    xAxis: xAxes,
    yAxis: yAxes,
    series: series,
    dataZoom: [
      { type: "inside", xAxisIndex: Array.from({ length: grids.length }, (_, i) => i), start: 0, end: 100 },
    ],
    legend: {
      show: true,
      top: "3%",
      left: "8%",
      textStyle: { color: TEXT_COLOR, fontSize: 10 },
      itemWidth: 20,
      itemHeight: 10,
    },
  };
}
