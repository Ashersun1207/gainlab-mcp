/**
 * Sector treemap chart — Finviz-style heatmap.
 * Block area = market cap (or volume for crypto).
 * Block color = change percentage (green=up, red=down).
 */

import type { EChartsOption } from "echarts";
import type { ScreenerItem } from "../../data/screener.js";
import { UP_COLOR, DOWN_COLOR, BG_COLOR, TEXT_COLOR, SUB_TEXT_COLOR } from "../themes.js";

interface SectorTreemapParams {
  items: ScreenerItem[];
  market: string;
  changePeriod: "1d" | "5d";
  title?: string;
}

/**
 * Map a change percentage to a color.
 * ≥+5% → deep green, +2~5% → light green, -2~+2% → gray, -2~-5% → light red, ≤-5% → deep red
 */
function changeToColor(change: number): string {
  if (change >= 5)   return "#00d4aa";  // deep green
  if (change >= 2)   return "#33b88a";  // medium green
  if (change >= 0.5) return "#4a8a6a";  // light green
  if (change > -0.5) return "#4a4a6a";  // neutral gray
  if (change > -2)   return "#8a4a5a";  // light red
  if (change > -5)   return "#b83353";  // medium red
  return "#ff4757";                      // deep red
}

/**
 * Group items by sector, then build treemap data.
 */
function buildTreemapData(items: ScreenerItem[], changePeriod: "1d" | "5d") {
  // Group by sector
  const sectorMap = new Map<string, ScreenerItem[]>();
  for (const item of items) {
    const key = item.sector || "Other";
    if (!sectorMap.has(key)) sectorMap.set(key, []);
    sectorMap.get(key)!.push(item);
  }

  // Build tree: sector → stocks
  const children = [];
  for (const [sector, stocks] of sectorMap) {
    const sectorChildren = stocks.map(s => {
      const change = changePeriod === "5d" ? s.change5d : s.change1d;
      return {
        name: s.code,
        value: s.marketCap,
        itemStyle: { color: changeToColor(change), borderColor: BG_COLOR, borderWidth: 1 },
        // Store extra data for tooltip
        _data: {
          fullName: s.name,
          price: s.price,
          change,
          marketCap: s.marketCap,
          sector: s.sector,
          industry: s.industry,
        },
      };
    });

    children.push({
      name: sector,
      children: sectorChildren,
    });
  }

  return children;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toFixed(0)}`;
}

export function buildSectorTreemapOption(params: SectorTreemapParams): EChartsOption {
  const { items, market, changePeriod, title } = params;
  const treeData = buildTreemapData(items, changePeriod);

  const marketLabel = market === "crypto" ? "Crypto" : "US Stocks";
  const periodLabel = changePeriod === "5d" ? "5D" : "1D";
  const chartTitle = title || `${marketLabel} Sector Heatmap (${periodLabel} Change)`;

  return {
    title: {
      text: chartTitle,
      left: "center",
      top: 10,
      textStyle: { color: TEXT_COLOR, fontSize: 16, fontWeight: "bold" },
    },
    tooltip: {
      formatter: (info: any) => {
        const data = info.data?._data;
        if (!data) {
          // Sector level
          return `<b>${info.name}</b>`;
        }
        const sign = data.change >= 0 ? "+" : "";
        const capLabel = market === "crypto" ? "24h Vol" : "Mkt Cap";
        return `
          <b>${info.name}</b> — ${data.fullName}<br/>
          Price: $${data.price.toLocaleString()}<br/>
          Change: <span style="color:${data.change >= 0 ? UP_COLOR : DOWN_COLOR}">${sign}${data.change.toFixed(2)}%</span><br/>
          ${capLabel}: ${formatMarketCap(data.marketCap)}<br/>
          ${data.industry}
        `.trim();
      },
    },
    series: [
      {
        type: "treemap",
        data: treeData,
        width: "92%",
        height: "82%",
        top: 50,
        left: "center",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        // Sector level style
        levels: [
          {
            // L0: root (invisible)
            itemStyle: {
              borderColor: "#333",
              borderWidth: 0,
              gapWidth: 2,
            },
          },
          {
            // L1: sector groups
            itemStyle: {
              borderColor: "#555",
              borderWidth: 2,
              gapWidth: 2,
            },
            upperLabel: {
              show: true,
              height: 20,
              color: SUB_TEXT_COLOR,
              fontSize: 11,
              fontWeight: "bold",
              backgroundColor: "transparent",
            },
          },
          {
            // L2: individual stocks
            itemStyle: {
              borderColor: BG_COLOR,
              borderWidth: 1,
              gapWidth: 1,
            },
            label: {
              show: true,
              formatter: (p: any) => {
                const d = p.data?._data;
                if (!d) return p.name;
                const sign = d.change >= 0 ? "+" : "";
                return `{name|${p.name}}\n{change|${sign}${d.change.toFixed(1)}%}`;
              },
              rich: {
                name: { fontSize: 12, color: "#fff", fontWeight: "bold", lineHeight: 16 },
                change: { fontSize: 10, color: "#ddd", lineHeight: 14 },
              },
              align: "center",
              verticalAlign: "middle",
            },
          },
        ],
      },
    ],
  };
}
