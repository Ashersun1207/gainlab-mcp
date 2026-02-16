import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getKlines } from "../../src/data/index.js";

describe("getKlines router", () => {
  it("routes crypto market to Binance", async () => {
    const data = await getKlines("BTCUSDT", "crypto", "1d", 5);
    assert.ok(data.length === 5, "should return data from Binance");
  });

  it("throws for unimplemented markets with helpful message", async () => {
    await assert.rejects(
      () => getKlines("AAPL", "us_stock", "1d", 10),
      (err: any) => {
        assert.ok(err.message.includes("Phase 2"), "should mention Phase 2");
        return true;
      }
    );

    await assert.rejects(
      () => getKlines("600519.SHG", "a_stock", "1d", 10),
      (err: any) => {
        assert.ok(err.message.includes("Phase 2"), "should mention Phase 2");
        return true;
      }
    );

    await assert.rejects(
      () => getKlines("XAUUSD", "commodity", "1d", 10),
      (err: any) => {
        assert.ok(err.message.includes("Phase 2"), "should mention Phase 2");
        return true;
      }
    );
  });
});
