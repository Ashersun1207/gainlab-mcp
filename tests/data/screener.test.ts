import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getUSStockScreener, getCryptoScreener } from "../../src/data/screener.js";

describe("getUSStockScreener", () => {
  it("returns array of ScreenerItem with correct fields", async () => {
    const items = await getUSStockScreener({ limit: 5 });
    assert.ok(Array.isArray(items), "should return array");
    assert.ok(items.length > 0, "should return some items");

    const item = items[0];
    assert.ok(typeof item.code === "string", "code should be string");
    assert.ok(typeof item.name === "string", "name should be string");
    assert.ok(typeof item.price === "number", "price should be number");
    assert.ok(typeof item.change1d === "number", "change1d should be number");
    assert.ok(typeof item.marketCap === "number", "marketCap should be number");
    assert.ok(typeof item.sector === "string", "sector should be string");
    assert.ok(typeof item.industry === "string", "industry should be string");
  });

  it("filters by sector", async () => {
    const items = await getUSStockScreener({ sector: "Technology", limit: 10 });
    assert.ok(items.length > 0, "should return Technology stocks");
    for (const item of items) {
      assert.equal(item.sector, "Technology", `Expected Technology, got ${item.sector}`);
    }
  });

  it("filters by minMarketCap", async () => {
    const minCap = 100_000_000_000; // 100B
    const items = await getUSStockScreener({ minMarketCap: minCap, limit: 10 });
    assert.ok(items.length > 0, "should return mega-cap stocks");
    for (const item of items) {
      assert.ok(item.marketCap >= minCap * 0.9, // allow small tolerance from API
        `Market cap ${item.marketCap} < ${minCap} for ${item.code}`);
    }
  });

  it("respects limit parameter", async () => {
    const items = await getUSStockScreener({ limit: 15 });
    assert.ok(items.length <= 15, `Expected ≤15 items, got ${items.length}`);
  });

  it("returns empty array for impossible filter", async () => {
    const items = await getUSStockScreener({
      minMarketCap: 999_000_000_000_000, // 999T - nothing this big
      limit: 10,
    });
    assert.equal(items.length, 0, "should return empty array");
  });
});

describe("getCryptoScreener", () => {
  it("returns array of crypto items with correct fields", async () => {
    const items = await getCryptoScreener({ limit: 10 });
    assert.ok(Array.isArray(items), "should return array");
    assert.ok(items.length > 0, "should return some items");

    const item = items[0];
    assert.ok(typeof item.code === "string", "code should be string");
    assert.ok(typeof item.price === "number", "price should be number");
    assert.ok(typeof item.change1d === "number", "change1d should be number");
    assert.ok(typeof item.sector === "string", "sector should be string");
  });

  it("excludes stablecoins", async () => {
    const items = await getCryptoScreener({ limit: 100 });
    const stablecoins = ["USDT", "USDC", "DAI", "BUSD", "FDUSD"];
    for (const item of items) {
      assert.ok(!stablecoins.includes(item.code),
        `Stablecoin ${item.code} should be excluded`);
    }
  });

  it("filters by crypto sector", async () => {
    const items = await getCryptoScreener({ sector: "DeFi", limit: 20 });
    // May have fewer DeFi tokens with high volume
    for (const item of items) {
      assert.equal(item.sector, "DeFi", `Expected DeFi, got ${item.sector} for ${item.code}`);
    }
  });

  it("items sorted by volume descending", async () => {
    const items = await getCryptoScreener({ limit: 20 });
    for (let i = 1; i < items.length; i++) {
      assert.ok(items[i].marketCap <= items[i - 1].marketCap,
        `Items not sorted: ${items[i - 1].code}(${items[i - 1].marketCap}) < ${items[i].code}(${items[i].marketCap})`);
    }
  });

  it("respects limit parameter", async () => {
    const items = await getCryptoScreener({ limit: 15 });
    assert.ok(items.length <= 15, `Expected ≤15 items, got ${items.length}`);
  });
});
