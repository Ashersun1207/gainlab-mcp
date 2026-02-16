import type { EChartsOption } from "echarts";
import {
  BG_COLOR,
  GRID_COLOR,
  TEXT_COLOR,
  SUB_TEXT_COLOR,
  GAINLAB_THEME,
} from "../themes.js";

export interface OverlaySeriesData {
  symbol: string;
  market: string;
  dates: number[];
  values: number[];
}

export function buildOverlayOption(
  seriesData: OverlaySeriesData[],
  normalize: boolean,
  timeframe: string
): EChartsOption {
  // Get all unique dates and sort them
  const allDates = new Set<number>();
  seriesData.forEach((s) => s.dates.forEach((d) => allDates.add(d)));
  const sortedDates = Array.from(allDates).sort((a, b) => a - b);

  // Align data to common timeline with forward fill
  const alignedSeries = seriesData.map((series) => {
    const dateToValue = new Map<number, number>();
    series.dates.forEach((date, i) => {
      dateToValue.set(date, series.values[i]);
    });

    let lastValue: number | null = null;
    const alignedValues = sortedDates.map((date) => {
      if (dateToValue.has(date)) {
        lastValue = dateToValue.get(date)!;
        return lastValue;
      }
      return lastValue; // forward fill or null
    });

    return {
      symbol: series.symbol,
      market: series.market,
      values: alignedValues,
    };
  });

  // Normalize if needed
  const processedSeries = normalize
    ? alignedSeries.map((series) => {
        const firstValue = series.values.find((v) => v !== null);
        if (!firstValue) return series;

        const normalized = series.values.map((v) => {
          if (v === null) return null;
          return ((v - firstValue) / firstValue) * 100;
        });

        return { ...series, values: normalized };
      })
    : alignedSeries;

  // Build ECharts series
  const echartsSeries = processedSeries.map((series, index) => ({
    name: `${series.symbol} (${series.market})`,
    type: "line" as const,
    data: series.values,
    smooth: true,
    showSymbol: false,
    lineStyle: {
      width: 2,
      color: GAINLAB_THEME.colorPalette[index % GAINLAB_THEME.colorPalette.length],
    },
    itemStyle: {
      color: GAINLAB_THEME.colorPalette[index % GAINLAB_THEME.colorPalette.length],
    },
  }));

  const option: EChartsOption = {
    backgroundColor: BG_COLOR,
    title: {
      text: normalize ? "Multi-Asset Overlay (Normalized)" : "Multi-Asset Overlay",
      left: "center",
      textStyle: {
        color: TEXT_COLOR,
        fontSize: 16,
      },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "cross",
      },
      backgroundColor: "rgba(26, 26, 46, 0.9)",
      borderColor: GRID_COLOR,
      textStyle: {
        color: TEXT_COLOR,
      },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const date = new Date(sortedDates[params[0].dataIndex]);
        let tooltip = `<div style="font-size: 12px; margin-bottom: 4px;">${date.toISOString().split("T")[0]}</div>`;
        params.forEach((param: any) => {
          const value = param.value;
          if (value !== null) {
            const displayValue = normalize
              ? `${value.toFixed(2)}%`
              : value.toFixed(2);
            tooltip += `<div>${param.marker} ${param.seriesName}: ${displayValue}</div>`;
          }
        });
        return tooltip;
      },
    },
    legend: {
      data: echartsSeries.map((s) => s.name),
      top: 30,
      textStyle: {
        color: TEXT_COLOR,
      },
    },
    grid: {
      left: "10%",
      right: "10%",
      top: 80,
      bottom: 100,
      borderColor: GRID_COLOR,
    },
    xAxis: {
      type: "category",
      data: sortedDates,
      axisLabel: {
        formatter: (value: any) => {
          const date = new Date(value);
          return date.toISOString().split("T")[0];
        },
        color: SUB_TEXT_COLOR,
      },
      axisLine: {
        lineStyle: {
          color: GRID_COLOR,
        },
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      type: "value",
      name: normalize ? "Change (%)" : "Value",
      nameTextStyle: {
        color: TEXT_COLOR,
      },
      axisLabel: {
        formatter: normalize ? "{value}%" : "{value}",
        color: SUB_TEXT_COLOR,
      },
      axisLine: {
        lineStyle: {
          color: GRID_COLOR,
        },
      },
      splitLine: {
        lineStyle: {
          color: GRID_COLOR,
          type: "dashed",
        },
      },
    },
    dataZoom: [
      {
        type: "inside",
        start: 0,
        end: 100,
      },
      {
        type: "slider",
        start: 0,
        end: 100,
        height: 30,
        bottom: 10,
        textStyle: {
          color: TEXT_COLOR,
        },
        borderColor: GRID_COLOR,
        fillerColor: "rgba(0, 212, 170, 0.2)",
        handleStyle: {
          color: GAINLAB_THEME.colorPalette[0],
        },
      },
    ],
    series: echartsSeries,
  };

  return option;
}
