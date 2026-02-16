import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCryptoKlines, getCryptoFundingRate } from "../../src/data/crypto.js";

describe("getCryptoKlines", () => {
  it("returns OHLCV array with correct structure", async () => {
    const data = await getCryptoKlines("BTCUSDT", "1d", 10);
    assert.ok(Array.isArray(data), "should return an array");
    assert.equal(data.length, 10, "should return requested number of candles");

    const candle = data[0];
    assert.ok(typeof candle.timestamp === "number", "timestamp should be number");
    assert.ok(typeof candle.open === "number", "open should be number");
    assert.ok(typeof candle.high === "number", "high should be number");
    assert.ok(typeof candle.low === "number", "low should be number");
    assert.ok(typeof candle.close === "number", "close should be number");
    assert.ok(typeof candle.volume === "number", "volume should be number");
  });

  it("high >= low for every candle", async () => {
    const data = await getCryptoKlines("ETHUSDT", "1d", 20);
    for (const candle of data) {
      assert.ok(candle.high >= candle.low, `high ${candle.high} should >= low ${candle.low}`);
    }
  });

  it("timestamps are in ascending order", async () => {
    const data = await getCryptoKlines("BTCUSDT", "1h", 30);
    for (let i = 1; i < data.length; i++) {
      assert.ok(data[i].timestamp > data[i - 1].timestamp, "timestamps should be ascending");
    }
  });

  it("throws on invalid symbol", async () => {
    await assert.rejects(
      () => getCryptoKlines("INVALIDXYZ123", "1d", 10),
      (err: any) => {
        assert.ok(err.message.includes("Binance"), "error should mention Binance");
        return true;
      }
    );
  });
});

describe("getCryptoFundingRate", () => {
  it("returns funding rate array with correct structure", async () => {
    const data = await getCryptoFundingRate("BTCUSDT", 10);
    assert.ok(Array.isArray(data), "should return an array");
    assert.ok(data.length > 0, "should return some data");

    const item = data[0];
    assert.ok(typeof item.timestamp === "number", "timestamp should be number");
    assert.ok(typeof item.fundingRate === "number", "fundingRate should be number");
  });

  it("funding rates are within reasonable range (-1% to 1%)", async () => {
    const data = await getCryptoFundingRate("BTCUSDT", 50);
    for (const item of data) {
      assert.ok(
        Math.abs(item.fundingRate) < 0.01,
        `fundingRate ${item.fundingRate} should be within ±1%`
      );
    }
  });
});
