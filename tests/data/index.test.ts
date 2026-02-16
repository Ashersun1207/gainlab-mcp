import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getKlines, getFundamentals } from "../../src/data/index.js";

describe("getKlines router", () => {
  it("routes crypto market to Binance", async () => {
    const data = await getKlines("BTCUSDT", "crypto", "1d", 5);
    assert.ok(data.length === 5, "should return data from Binance");
  });

  it("routes us_stock market to FMP", async () => {
    const data = await getKlines("AAPL", "us_stock", "1d", 5);
    assert.ok(data.length > 0, "should return data from FMP");
    assert.ok(data[0].close > 0, "should have valid price");
  });

  it("routes commodity market to EODHD", async () => {
    const data = await getKlines("XAUUSD", "commodity", "1d", 5);
    assert.ok(data.length > 0, "should return data from EODHD");
    assert.ok(data[0].close > 1000, "should be gold price");
  });

  it("rejects non-daily timeframes for us_stock", async () => {
    await assert.rejects(
      () => getKlines("AAPL", "us_stock", "1h", 10),
      (err: any) => {
        assert.ok(err.message.includes("daily"), "should mention daily limitation");
        return true;
      }
    );
  });

  it("routes a_stock market to EODHD", async () => {
    const data = await getKlines("600519", "a_stock", "1d", 5);
    assert.ok(data.length > 0, "should return data from EODHD");
    assert.ok(data[0].close > 0, "should have valid price");
  });

  it("rejects non-daily timeframes for a_stock", async () => {
    await assert.rejects(
      () => getKlines("600519", "a_stock", "1h", 10),
      (err: any) => {
        assert.ok(err.message.includes("daily"), "should mention daily limitation");
        return true;
      }
    );
  });
});

describe("getFundamentals router", () => {
  it("routes us_stock to FMP fundamentals", async () => {
    const data = await getFundamentals("AAPL", "us_stock", "annual", 2);
    assert.ok(data.length > 0, "should return fundamental data");
    assert.ok(data[0].metrics.revenue !== undefined, "should have revenue");
  });

  it("routes a_stock to EODHD fundamentals", async () => {
    const data = await getFundamentals("600519", "a_stock", "annual", 2);
    assert.ok(data.length > 0, "should return fundamental data");
    assert.ok(data[0].metrics.totalRevenue !== undefined || data[0].metrics.totalRevenue === null, "should have totalRevenue");
  });

  it("throws for unsupported markets", async () => {
    await assert.rejects(
      () => getFundamentals("BTCUSDT", "crypto"),
      (err: any) => {
        assert.ok(err.message.includes("not supported"), "should mention not supported");
        return true;
      }
    );
  });
});
