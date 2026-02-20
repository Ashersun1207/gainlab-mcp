/**
 * API test guard — wraps integration tests that depend on external APIs.
 * On rate limit (429) or network errors, the test is skipped instead of failing.
 * This prevents flaky CI failures due to API quotas.
 *
 * Usage:
 *   import { apiTest } from "../helpers/api-guard.js";
 *   apiTest("should fetch AAPL klines", async () => { ... });
 */
import { it } from "node:test";

type TestFn = () => Promise<void>;

/** Error patterns that indicate API unavailability (not code bugs) */
const TRANSIENT_PATTERNS = [
  /429/,
  /rate.?limit/i,
  /limit.?reach/i,
  /too many requests/i,
  /quota/i,
  /503/,
  /502/,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /ENOTFOUND/,
  /fetch failed/i,
];

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return TRANSIENT_PATTERNS.some((p) => p.test(msg));
}

/**
 * Like `it()`, but catches transient API errors and calls `t.skip()`.
 * Real assertion failures still fail the test.
 */
export function apiTest(name: string, fn: TestFn): void {
  it(name, async (t) => {
    try {
      await fn();
    } catch (err) {
      if (isTransientError(err)) {
        const msg = err instanceof Error ? err.message : String(err);
        t.skip(`API unavailable: ${msg.slice(0, 80)}`);
        return;
      }
      throw err; // real failures bubble up
    }
  });
}

/**
 * Wrap a describe-level before() check — if API key missing, skip the suite.
 */
export function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`${name} not set — skipping API tests`);
  }
  return val;
}
