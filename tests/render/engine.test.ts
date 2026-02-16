import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToPNG, renderToHTML } from "../../src/render/engine.js";
import type { EChartsOption } from "echarts";

const SIMPLE_OPTION: EChartsOption = {
  xAxis: { type: "category", data: ["Mon", "Tue", "Wed"] },
  yAxis: { type: "value" },
  series: [{ type: "bar", data: [120, 200, 150] }],
};

describe("renderToHTML", () => {
  it("returns valid HTML string with echarts script", () => {
    const html = renderToHTML(SIMPLE_OPTION);
    assert.ok(typeof html === "string", "should return string");
    assert.ok(html.includes("<!DOCTYPE html>"), "should be full HTML doc");
    assert.ok(html.includes("echarts.min.js"), "should include ECharts CDN");
    assert.ok(html.includes("echarts.init"), "should init chart");
    assert.ok(html.includes("#1a1a2e"), "should use GainLab bg color");
  });

  it("respects custom dimensions", () => {
    const html = renderToHTML(SIMPLE_OPTION, 1200, 800);
    assert.ok(html.includes("1200px"), "should use custom width");
    assert.ok(html.includes("800px"), "should use custom height");
  });
});

describe("renderToPNG", () => {
  it("returns PNG buffer with valid header", async () => {
    const png = await renderToPNG(SIMPLE_OPTION, 400, 300);
    assert.ok(Buffer.isBuffer(png), "should return Buffer");
    assert.ok(png.length > 1000, "PNG should have reasonable size");
    // PNG magic bytes: 137 80 78 71
    assert.equal(png[0], 137, "PNG header byte 0");
    assert.equal(png[1], 80, "PNG header byte 1 (P)");
    assert.equal(png[2], 78, "PNG header byte 2 (N)");
    assert.equal(png[3], 71, "PNG header byte 3 (G)");
  });

  it("produces different sizes for different dimensions", async () => {
    const small = await renderToPNG(SIMPLE_OPTION, 200, 150);
    const large = await renderToPNG(SIMPLE_OPTION, 800, 600);
    assert.ok(large.length > small.length, "larger chart should produce larger PNG");
  });
});
