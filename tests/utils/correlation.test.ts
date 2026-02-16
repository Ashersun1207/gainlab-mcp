import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pearsonCorrelation, computeReturns } from "../../src/utils/correlation.js";

describe("pearsonCorrelation", () => {
  it("returns 1.0 for perfectly positive correlation", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 6, 8, 10];
    const r = pearsonCorrelation(x, y);
    assert.ok(Math.abs(r - 1.0) < 1e-10, `Expected ~1.0, got ${r}`);
  });

  it("returns -1.0 for perfectly negative correlation", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [10, 8, 6, 4, 2];
    const r = pearsonCorrelation(x, y);
    assert.ok(Math.abs(r - (-1.0)) < 1e-10, `Expected ~-1.0, got ${r}`);
  });

  it("returns ~0 for uncorrelated data", () => {
    // Orthogonal-ish sequences
    const x = [1, -1, 1, -1, 1, -1, 1, -1];
    const y = [1, 1, -1, -1, 1, 1, -1, -1];
    const r = pearsonCorrelation(x, y);
    assert.ok(Math.abs(r) < 0.3, `Expected ~0, got ${r}`);
  });

  it("returns NaN for empty arrays", () => {
    const r = pearsonCorrelation([], []);
    assert.ok(Number.isNaN(r), `Expected NaN, got ${r}`);
  });

  it("returns NaN for single-element arrays", () => {
    const r = pearsonCorrelation([1], [2]);
    assert.ok(Number.isNaN(r), `Expected NaN, got ${r}`);
  });

  it("returns NaN for zero-variance arrays", () => {
    const x = [5, 5, 5, 5];
    const y = [1, 2, 3, 4];
    const r = pearsonCorrelation(x, y);
    assert.ok(Number.isNaN(r), `Expected NaN, got ${r}`);
  });

  it("handles different-length arrays (uses min length)", () => {
    const x = [1, 2, 3, 4, 5, 6, 7];
    const y = [2, 4, 6];
    const r = pearsonCorrelation(x, y);
    // Only first 3 elements: [1,2,3] vs [2,4,6] → perfect correlation
    assert.ok(Math.abs(r - 1.0) < 1e-10, `Expected ~1.0, got ${r}`);
  });

  it("returns value between -1 and 1 for realistic data", () => {
    const x = [100, 102, 99, 103, 101, 105, 98, 107];
    const y = [50, 51, 49, 52, 50, 53, 48, 54];
    const r = pearsonCorrelation(x, y);
    assert.ok(r >= -1 && r <= 1, `Expected [-1, 1], got ${r}`);
    // These are roughly correlated, expect positive
    assert.ok(r > 0.5, `Expected positive correlation, got ${r}`);
  });
});

describe("computeReturns", () => {
  it("computes log returns correctly", () => {
    const prices = [100, 110, 105];
    const returns = computeReturns(prices);
    assert.equal(returns.length, 2);
    // log(110/100) ≈ 0.0953
    assert.ok(Math.abs(returns[0] - Math.log(1.1)) < 1e-10);
    // log(105/110) ≈ -0.0465
    assert.ok(Math.abs(returns[1] - Math.log(105 / 110)) < 1e-10);
  });

  it("returns empty array for single price", () => {
    assert.equal(computeReturns([100]).length, 0);
  });

  it("returns empty array for empty input", () => {
    assert.equal(computeReturns([]).length, 0);
  });

  it("handles zero price gracefully", () => {
    const returns = computeReturns([0, 100, 200]);
    assert.equal(returns.length, 2);
    assert.equal(returns[0], 0); // 0 price → return 0
  });
});
