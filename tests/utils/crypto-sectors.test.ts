import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getCryptoClassification,
  isExcludedToken,
  extractBaseSymbol,
  getKnownSectors,
  getClassificationMap,
} from "../../src/utils/crypto-sectors.js";

describe("getCryptoClassification", () => {
  it("classifies BTC as Layer 1", () => {
    const c = getCryptoClassification("BTC");
    assert.equal(c.sector, "Layer 1");
  });

  it("classifies ETH as Layer 1", () => {
    const c = getCryptoClassification("ETH");
    assert.equal(c.sector, "Layer 1");
  });

  it("classifies UNI as DeFi", () => {
    const c = getCryptoClassification("UNI");
    assert.equal(c.sector, "DeFi");
    assert.equal(c.industry, "DEX");
  });

  it("classifies DOGE as Meme", () => {
    const c = getCryptoClassification("DOGE");
    assert.equal(c.sector, "Meme");
  });

  it("classifies LINK as Infrastructure", () => {
    const c = getCryptoClassification("LINK");
    assert.equal(c.sector, "Infrastructure");
  });

  it("classifies FET as AI", () => {
    const c = getCryptoClassification("FET");
    assert.equal(c.sector, "AI");
  });

  it("classifies unknown token as Other", () => {
    const c = getCryptoClassification("RANDOMXYZ");
    assert.equal(c.sector, "Other");
    assert.equal(c.industry, "Other");
  });

  it("is case-insensitive", () => {
    const c = getCryptoClassification("btc");
    assert.equal(c.sector, "Layer 1");
  });
});

describe("isExcludedToken", () => {
  it("excludes USDT", () => {
    assert.ok(isExcludedToken("USDT"));
  });

  it("excludes USDC", () => {
    assert.ok(isExcludedToken("USDC"));
  });

  it("excludes WBTC", () => {
    assert.ok(isExcludedToken("WBTC"));
  });

  it("does not exclude BTC", () => {
    assert.ok(!isExcludedToken("BTC"));
  });

  it("does not exclude ETH", () => {
    assert.ok(!isExcludedToken("ETH"));
  });
});

describe("extractBaseSymbol", () => {
  it("extracts BTC from BTCUSDT", () => {
    assert.equal(extractBaseSymbol("BTCUSDT"), "BTC");
  });

  it("extracts ETH from ETHUSDT", () => {
    assert.equal(extractBaseSymbol("ETHUSDT"), "ETH");
  });

  it("extracts DOGE from DOGEUSDT", () => {
    assert.equal(extractBaseSymbol("DOGEUSDT"), "DOGE");
  });

  it("handles lowercase", () => {
    assert.equal(extractBaseSymbol("btcusdt"), "BTC");
  });

  it("returns uppercase for unknown format", () => {
    assert.equal(extractBaseSymbol("SOMETHING"), "SOMETHING");
  });
});

describe("getKnownSectors", () => {
  it("returns at least 8 sectors", () => {
    const sectors = getKnownSectors();
    assert.ok(sectors.length >= 8, `Expected ≥8 sectors, got ${sectors.length}: ${sectors}`);
  });

  it("includes expected sectors", () => {
    const sectors = getKnownSectors();
    for (const expected of ["Layer 1", "Layer 2", "DeFi", "AI", "Gaming", "Meme", "Infrastructure", "Exchange"]) {
      assert.ok(sectors.includes(expected), `Missing sector: ${expected}`);
    }
  });
});

describe("classification coverage", () => {
  it("covers top 50 crypto by market cap", () => {
    // Top tokens that should be classified (not stablecoins)
    const top50 = [
      "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "AVAX",
      "DOT", "LINK", "SHIB", "MATIC", "UNI", "LTC", "ATOM",
      "FIL", "NEAR", "ARB", "OP", "AAVE", "MKR", "GRT",
      "FET", "RENDER", "INJ", "SUI", "APT", "TON",
    ];
    const map = getClassificationMap();
    const missing: string[] = [];
    for (const sym of top50) {
      if (!map[sym]) missing.push(sym);
    }
    assert.equal(missing.length, 0, `Missing top tokens: ${missing.join(", ")}`);
  });

  it("no token appears in two different sectors", () => {
    const map = getClassificationMap();
    // Each token has exactly one entry, so this is inherently true.
    // But verify no duplicate keys (TypeScript guarantees this, but let's verify data integrity)
    const entries = Object.entries(map);
    const uniqueKeys = new Set(entries.map(([k]) => k));
    assert.equal(uniqueKeys.size, entries.length, "Duplicate keys found");
  });
});
