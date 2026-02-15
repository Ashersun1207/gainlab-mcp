import * as echarts from "echarts";
import { BG_COLOR } from "./themes.js";

// ECharts server-side rendering with node-canvas
let canvasModule: any = null;

async function getCanvas() {
  if (!canvasModule) {
    try {
      // Dynamic import to keep canvas as optional dependency
      const moduleName = "canvas";
      canvasModule = await import(moduleName);
    } catch {
      throw new Error(
        "canvas module not found. Install it with: pnpm add canvas"
      );
    }
  }
  return canvasModule;
}

export async function renderToPNG(
  option: echarts.EChartsOption,
  width: number = 800,
  height: number = 500
): Promise<Buffer> {
  const { createCanvas } = await getCanvas();
  const canvas = createCanvas(width, height);

  // echarts SSR init
  const chart = echarts.init(canvas as any, null, {
    width,
    height,
    renderer: "canvas",
  });

  chart.setOption({
    backgroundColor: BG_COLOR,
    animation: false,
    ...option,
  });

  const buffer = canvas.toBuffer("image/png");
  chart.dispose();
  return buffer;
}

export function renderToHTML(
  option: echarts.EChartsOption,
  width: number = 800,
  height: number = 500
): string {
  const optionJSON = JSON.stringify({
    backgroundColor: BG_COLOR,
    ...option,
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GainLab Chart</title>
  <script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${BG_COLOR}; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    #chart { width: ${width}px; height: ${height}px; }
  </style>
</head>
<body>
  <div id="chart"></div>
  <script>
    var chart = echarts.init(document.getElementById('chart'));
    chart.setOption(${optionJSON});
    window.addEventListener('resize', function() { chart.resize(); });
  </script>
</body>
</html>`;
}
