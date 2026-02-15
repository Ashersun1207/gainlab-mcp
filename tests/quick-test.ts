// Quick integration test: fetch BTC data + render K-line
import { getCryptoKlines } from "../src/data/crypto.js";
import { buildKlineOption } from "../src/render/charts/kline.js";
import { renderToPNG, renderToHTML } from "../src/render/engine.js";
import { writeFileSync } from "fs";

async function main() {
  console.log("1. Fetching BTC 1d klines from Binance...");
  const data = await getCryptoKlines("BTCUSDT", "1d", 60);
  console.log(`   ✅ Got ${data.length} candles`);
  console.log(`   Last: O=${data[data.length-1].open} H=${data[data.length-1].high} L=${data[data.length-1].low} C=${data[data.length-1].close}`);

  console.log("2. Building ECharts option...");
  const option = buildKlineOption(data, "BTCUSDT", "1d");
  console.log("   ✅ Option built");

  console.log("3. Rendering to HTML...");
  const html = renderToHTML(option);
  writeFileSync("tests/output-kline.html", html);
  console.log("   ✅ HTML saved to tests/output-kline.html");

  console.log("4. Rendering to PNG...");
  try {
    const png = await renderToPNG(option);
    writeFileSync("tests/output-kline.png", png);
    console.log(`   ✅ PNG saved to tests/output-kline.png (${png.length} bytes)`);
  } catch (e: any) {
    console.log(`   ⚠️ PNG render failed: ${e.message}`);
  }

  console.log("\n🎯 Phase 1 test complete!");
}

main().catch(console.error);
