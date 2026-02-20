import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getUSStockScreener, getCryptoScreener } from "../../src/data/screener.js";
import { buildCorrelationMatrix } from "../../src/utils/correlation.js";
import { buildSectorTreemapOption } from "../../src/render/charts/sector-treemap.js";
import { buildCorrelationMatrixOption } from "../../src/render/charts/correlation-matrix.js";
import { renderToPNG, renderToHTML } from "../../src/render/engine.js";
import { apiTest } from "../helpers/api-guard.js";

describe("sector treemap — US stocks", () => {
  it("generates treemap option for US stocks", async () => {
    const items = await getUSStockScreener({ limit: 20 });
    assert.ok(items.length > 0, "should have items");

    const option = buildSectorTreemapOption({
      items,
      market: "us_stock",
      changePeriod: "1d",
    });

    assert.ok(option.series, "should have series");
    assert.ok(option.title, "should have title");
  });

  it("generates treemap for specific sector", async () => {
    const items = await getUSStockScreener({ sector: "Technology", limit: 15 });
    assert.ok(items.length > 0);

    const option = buildSectorTreemapOption({
      items,
      market: "us_stock",
      changePeriod: "1d",
    });

    assert.ok(option.series, "should have series");
  });

  it("renders US stock treemap to PNG", async () => {
    const items = await getUSStockScreener({ limit: 15 });
    const option = buildSectorTreemapOption({
      items,
      market: "us_stock",
      changePeriod: "1d",
    });

    const png = await renderToPNG(option, 800, 500);
    assert.ok(Buffer.isBuffer(png), "should return Buffer");
    assert.ok(png.length > 1000, "PNG should have content");
  });

  it("renders US stock treemap to HTML", async () => {
    const items = await getUSStockScreener({ limit: 15 });
    const option = buildSectorTreemapOption({
      items,
      market: "us_stock",
      changePeriod: "1d",
    });

    const html = renderToHTML(option, 800, 500);
    assert.ok(html.includes("echarts"), "HTML should include echarts");
    assert.ok(html.includes("treemap"), "HTML should include treemap config");
  });

  it("supports 5d change period", async () => {
    const items = await getUSStockScreener({ limit: 10 });
    const option = buildSectorTreemapOption({
      items,
      market: "us_stock",
      changePeriod: "5d",
    });

    assert.ok(option.title, "should have title");
  });
});

describe("sector treemap — crypto", () => {
  it("generates treemap option for crypto", async () => {
    const items = await getCryptoScreener({ limit: 30 });
    assert.ok(items.length > 0, "should have items");

    const option = buildSectorTreemapOption({
      items,
      market: "crypto",
      changePeriod: "1d",
    });

    assert.ok(option.series, "should have series");
  });

  it("renders crypto treemap to PNG", async () => {
    const items = await getCryptoScreener({ limit: 20 });
    const option = buildSectorTreemapOption({
      items,
      market: "crypto",
      changePeriod: "1d",
    });

    const png = await renderToPNG(option, 800, 500);
    assert.ok(Buffer.isBuffer(png), "should return Buffer");
    assert.ok(png.length > 1000, "PNG should have content");
  });
});

describe("correlation matrix", () => {
  it("builds 3×3 correlation matrix for crypto", async () => {
    const matrix = await buildCorrelationMatrix([
      { symbol: "BTCUSDT", market: "crypto" },
      { symbol: "ETHUSDT", market: "crypto" },
      { symbol: "SOLUSDT", market: "crypto" },
    ], 60);

    assert.equal(matrix.symbols.length, 3);
    assert.equal(matrix.matrix.length, 3);
    assert.equal(matrix.matrix[0].length, 3);

    // Diagonal should be 1.0
    for (let i = 0; i < 3; i++) {
      assert.equal(matrix.matrix[i][i], 1.0, `Diagonal [${i}][${i}] should be 1.0`);
    }

    // Symmetric
    assert.equal(matrix.matrix[0][1], matrix.matrix[1][0], "should be symmetric");
    assert.equal(matrix.matrix[0][2], matrix.matrix[2][0], "should be symmetric");

    // BTC and ETH should be positively correlated
    assert.ok(matrix.matrix[0][1] > 0.3, `BTC-ETH correlation should be positive, got ${matrix.matrix[0][1]}`);
  });

  apiTest("builds cross-market correlation matrix", async () => {
    const matrix = await buildCorrelationMatrix([
      { symbol: "BTCUSDT", market: "crypto" },
      { symbol: "AAPL", market: "us_stock" },
    ], 60);

    assert.equal(matrix.symbols.length, 2);
    assert.equal(matrix.matrix[0][0], 1.0);
    assert.equal(matrix.matrix[1][1], 1.0);
    // Cross-market correlation can be anything
    const corr = matrix.matrix[0][1];
    assert.ok(corr >= -1 && corr <= 1, `Correlation should be [-1,1], got ${corr}`);
  });

  it("renders correlation matrix to PNG", async () => {
    const matrix = await buildCorrelationMatrix([
      { symbol: "BTCUSDT", market: "crypto" },
      { symbol: "ETHUSDT", market: "crypto" },
      { symbol: "SOLUSDT", market: "crypto" },
    ], 60);

    const option = buildCorrelationMatrixOption({ matrix });
    const png = await renderToPNG(option, 500, 500);
    assert.ok(Buffer.isBuffer(png), "should return Buffer");
    assert.ok(png.length > 1000, "PNG should have content");
  });

  it("renders correlation matrix to HTML", async () => {
    const matrix = await buildCorrelationMatrix([
      { symbol: "BTCUSDT", market: "crypto" },
      { symbol: "ETHUSDT", market: "crypto" },
    ], 60);

    const option = buildCorrelationMatrixOption({ matrix });
    const html = renderToHTML(option, 500, 500);
    assert.ok(html.includes("echarts"), "should include echarts");
    assert.ok(html.includes("heatmap"), "should include heatmap config");
  });

  it("rejects fewer than 2 assets", async () => {
    await assert.rejects(
      () => buildCorrelationMatrix([{ symbol: "BTCUSDT", market: "crypto" }], 60),
      (err: any) => {
        assert.ok(err.message.includes("at least 2"), err.message);
        return true;
      }
    );
  });

  it("rejects more than 20 assets", async () => {
    const assets = Array.from({ length: 21 }, (_, i) => ({
      symbol: `TOKEN${i}USDT`,
      market: "crypto" as const,
    }));
    await assert.rejects(
      () => buildCorrelationMatrix(assets, 60),
      (err: any) => {
        assert.ok(err.message.includes("20"), err.message);
        return true;
      }
    );
  });
});

describe("empty data handling", () => {
  it("handles empty screener results gracefully", () => {
    const option = buildSectorTreemapOption({
      items: [],
      market: "us_stock",
      changePeriod: "1d",
    });
    // Should not throw, series data will be empty
    assert.ok(option.series, "should still have series");
  });
});
