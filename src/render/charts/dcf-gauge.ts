import type { EChartsOption } from "echarts";
import { BG_COLOR, TEXT_COLOR, SUB_TEXT_COLOR, GRID_COLOR } from "../themes.js";

interface DCFGaugeConfig {
  symbol: string;
  dcfValue: number;
  stockPrice: number;
  analystTarget?: number;  // optional wall street target
}

export function buildDCFGaugeOption(config: DCFGaugeConfig): EChartsOption {
  const { symbol, dcfValue, stockPrice, analystTarget } = config;
  
  // Calculate margin of safety
  const marginOfSafety = ((dcfValue - stockPrice) / dcfValue) * 100;
  const isUndervalued = marginOfSafety > 0;
  
  // Determine gauge range
  const minVal = Math.min(dcfValue, stockPrice, analystTarget ?? dcfValue) * 0.5;
  const maxVal = Math.max(dcfValue, stockPrice, analystTarget ?? dcfValue) * 1.5;
  
  return {
    backgroundColor: BG_COLOR,
    animation: false,
    title: {
      text: `${symbol} — DCF Valuation`,
      subtext: `Intrinsic: $${dcfValue.toFixed(2)} | Price: $${stockPrice.toFixed(2)} | ${isUndervalued ? "Discount" : "Premium"}: ${Math.abs(marginOfSafety).toFixed(1)}%`,
      left: "center",
      top: "3%",
      textStyle: { color: TEXT_COLOR, fontSize: 16, fontWeight: "bold" },
      subtextStyle: { color: isUndervalued ? "#00d4aa" : "#ff4d4d", fontSize: 13 },
    },
    series: [
      {
        type: "gauge",
        center: ["50%", "60%"],
        radius: "70%",
        min: minVal,
        max: maxVal,
        startAngle: 200,
        endAngle: -20,
        splitNumber: 10,
        axisLine: {
          lineStyle: {
            width: 30,
            color: [
              [dcfValue / maxVal * 0.5, "#00d4aa"],  // undervalued zone (green)
              [dcfValue / maxVal, "#ffcc00"],          // fair value zone (yellow)
              [1, "#ff4d4d"],                          // overvalued zone (red)
            ],
          },
        },
        pointer: {
          itemStyle: { color: "#ffffff" },
          length: "60%",
          width: 6,
        },
        axisTick: {
          distance: -30,
          length: 8,
          lineStyle: { color: "#999", width: 1 },
        },
        splitLine: {
          distance: -30,
          length: 15,
          lineStyle: { color: "#999", width: 2 },
        },
        axisLabel: {
          color: SUB_TEXT_COLOR,
          distance: 40,
          fontSize: 11,
          formatter: (value: number) => {
            if (value >= 1000) return "$" + (value / 1000).toFixed(0) + "K";
            return "$" + value.toFixed(0);
          },
        },
        detail: {
          valueAnimation: false,
          formatter: `$${stockPrice.toFixed(2)}`,
          color: TEXT_COLOR,
          fontSize: 24,
          offsetCenter: [0, "70%"],
        },
        data: [{ value: stockPrice }],
      },
    ],
    // Add text annotations for DCF value and analyst target
    graphic: [
      {
        type: "text",
        left: "15%",
        bottom: "10%",
        style: {
          text: `DCF Intrinsic: $${dcfValue.toFixed(2)}`,
          fill: "#00d4aa",
          fontSize: 14,
        },
      },
      ...(analystTarget ? [{
        type: "text" as const,
        right: "15%",
        bottom: "10%",
        style: {
          text: `Analyst Target: $${analystTarget.toFixed(2)}`,
          fill: "#5b8ff9",
          fontSize: 14,
        },
      }] : []),
      {
        type: "text",
        left: "center",
        bottom: "3%",
        style: {
          text: isUndervalued 
            ? `✅ Trading at ${Math.abs(marginOfSafety).toFixed(1)}% discount to intrinsic value`
            : `⚠️ Trading at ${Math.abs(marginOfSafety).toFixed(1)}% premium to intrinsic value`,
          fill: isUndervalued ? "#00d4aa" : "#ff4d4d",
          fontSize: 12,
        },
      },
    ],
  };
}
