/**
 * Mock helper for EODHD API calls.
 * Intercepts global.fetch to return mock data for eodhd.com URLs,
 * while passing through all other requests to the real fetch.
 *
 * Usage:
 *   import { installEodhdMock, removeEodhdMock } from "../helpers/eodhd-mock.js";
 *   before(() => installEodhdMock());
 *   after(() => removeEodhdMock());
 */

// ── Mock data factories ──

function makeEodData(symbol: string, count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getTime() - (count - i) * 86400000);
    const dateStr = d.toISOString().split("T")[0];
    // Use different price ranges for different symbols
    let basePrice = 100;
    if (symbol.includes("XAUUSD") || symbol.includes("XAUUSD.FOREX")) basePrice = 2650;
    else if (symbol.includes("XAGUSD")) basePrice = 32;
    else if (symbol.startsWith("6")) basePrice = 1800; // 茅台
    else if (symbol.startsWith("0")) basePrice = 12;   // 平安银行
    const close = basePrice + (Math.random() - 0.5) * basePrice * 0.02;
    const open = close + (Math.random() - 0.5) * basePrice * 0.01;
    const high = Math.max(open, close) + Math.random() * basePrice * 0.005;
    const low = Math.min(open, close) - Math.random() * basePrice * 0.005;
    return {
      date: dateStr,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      adjusted_close: +close.toFixed(2),
      volume: Math.floor(1000000 + Math.random() * 5000000),
    };
  });
}

function makeScreenerData(params: { sector?: string; minMarketCap?: number; limit?: number }) {
  const { sector, minMarketCap = 1_000_000_000, limit = 50 } = params;

  const stocks = [
    { code: "AAPL", name: "Apple Inc", sector: "Technology", industry: "Consumer Electronics", mcap: 3_500_000_000_000 },
    { code: "MSFT", name: "Microsoft Corp", sector: "Technology", industry: "Software", mcap: 3_200_000_000_000 },
    { code: "GOOGL", name: "Alphabet Inc", sector: "Technology", industry: "Internet Content", mcap: 2_100_000_000_000 },
    { code: "AMZN", name: "Amazon.com Inc", sector: "Consumer Cyclical", industry: "Internet Retail", mcap: 2_000_000_000_000 },
    { code: "NVDA", name: "NVIDIA Corp", sector: "Technology", industry: "Semiconductors", mcap: 2_800_000_000_000 },
    { code: "META", name: "Meta Platforms Inc", sector: "Technology", industry: "Internet Content", mcap: 1_500_000_000_000 },
    { code: "BRK-B", name: "Berkshire Hathaway", sector: "Financial Services", industry: "Insurance", mcap: 1_100_000_000_000 },
    { code: "LLY", name: "Eli Lilly", sector: "Healthcare", industry: "Drug Manufacturers", mcap: 800_000_000_000 },
    { code: "TSM", name: "Taiwan Semi", sector: "Technology", industry: "Semiconductors", mcap: 750_000_000_000 },
    { code: "V", name: "Visa Inc", sector: "Financial Services", industry: "Credit Services", mcap: 600_000_000_000 },
    { code: "JPM", name: "JPMorgan Chase", sector: "Financial Services", industry: "Banks", mcap: 650_000_000_000 },
    { code: "UNH", name: "UnitedHealth", sector: "Healthcare", industry: "Healthcare Plans", mcap: 500_000_000_000 },
    { code: "XOM", name: "Exxon Mobil", sector: "Energy", industry: "Oil & Gas", mcap: 480_000_000_000 },
    { code: "WMT", name: "Walmart Inc", sector: "Consumer Defensive", industry: "Discount Stores", mcap: 600_000_000_000 },
    { code: "MA", name: "Mastercard", sector: "Financial Services", industry: "Credit Services", mcap: 420_000_000_000 },
    { code: "PG", name: "Procter & Gamble", sector: "Consumer Defensive", industry: "Household Products", mcap: 380_000_000_000 },
    { code: "AVGO", name: "Broadcom Inc", sector: "Technology", industry: "Semiconductors", mcap: 700_000_000_000 },
    { code: "HD", name: "Home Depot", sector: "Consumer Cyclical", industry: "Home Improvement", mcap: 350_000_000_000 },
    { code: "COST", name: "Costco", sector: "Consumer Defensive", industry: "Discount Stores", mcap: 340_000_000_000 },
    { code: "ABBV", name: "AbbVie Inc", sector: "Healthcare", industry: "Drug Manufacturers", mcap: 310_000_000_000 },
  ];

  let filtered = stocks.filter(s => s.mcap >= minMarketCap);
  if (sector) {
    filtered = filtered.filter(s => s.sector === sector);
  }

  return filtered.slice(0, limit).map(s => ({
    code: s.code,
    name: s.name,
    adjusted_close: +(100 + Math.random() * 500).toFixed(2),
    refund_1d_p: +((Math.random() - 0.5) * 4).toFixed(2),
    refund_5d_p: +((Math.random() - 0.5) * 8).toFixed(2),
    market_capitalization: s.mcap,
    avgvol_1d: Math.floor(5_000_000 + Math.random() * 50_000_000),
    sector: s.sector,
    industry: s.industry,
  }));
}

function makeFundamentalsData(symbol: string) {
  // Simulate EODHD fundamentals response structure
  const annualIncome: Record<string, any> = {};
  const quarterlyIncome: Record<string, any> = {};
  const annualCashFlow: Record<string, any> = {};
  const quarterlyCashFlow: Record<string, any> = {};

  for (let y = 2025; y >= 2020; y--) {
    const dateKey = `${y}-12-31`;
    annualIncome[dateKey] = {
      totalRevenue: 60000000000 + Math.random() * 10000000000,
      grossProfit: 40000000000 + Math.random() * 5000000000,
      operatingIncome: 25000000000 + Math.random() * 3000000000,
      netIncome: 20000000000 + Math.random() * 2000000000,
      ebitda: 30000000000 + Math.random() * 4000000000,
      eps: 10 + Math.random() * 5,
    };
    annualCashFlow[dateKey] = {
      totalCashFromOperatingActivities: "25000000000",
      freeCashFlow: "18000000000",
      capitalExpenditures: "-7000000000",
      dividendsPaid: "-5000000000",
      netIncome: "20000000000",
    };
  }

  for (let y = 2025; y >= 2024; y--) {
    for (let q = 4; q >= 1; q--) {
      const month = q * 3;
      const day = [0, 31, 30, 31, 30][q] || 31;
      const dateKey = `${y}-${String(month).padStart(2, "0")}-${day}`;
      quarterlyIncome[dateKey] = {
        totalRevenue: 15000000000 + Math.random() * 3000000000,
        grossProfit: 10000000000 + Math.random() * 1000000000,
        operatingIncome: 6000000000 + Math.random() * 1000000000,
        netIncome: 5000000000 + Math.random() * 500000000,
        ebitda: 8000000000 + Math.random() * 1000000000,
        eps: 2.5 + Math.random(),
      };
      quarterlyCashFlow[dateKey] = {
        totalCashFromOperatingActivities: "6000000000",
        freeCashFlow: "4500000000",
        capitalExpenditures: "-1500000000",
        dividendsPaid: "-1200000000",
        netIncome: "5000000000",
      };
    }
  }

  return {
    Highlights: {
      PERatio: "35.20",
      PEGRatio: "1.80",
      ReturnOnEquityTTM: "0.35",
      ReturnOnAssetsTTM: "0.15",
      ProfitMargin: "0.32",
      OperatingMarginTTM: "0.42",
      DividendYield: "0.006",
      EPSEstimateCurrentYear: "12.50",
      EPSEstimateNextYear: "14.00",
      WallStreetTargetPrice: "2100.00",
      MarketCapitalization: "2200000000000",
    },
    Valuation: {
      TrailingPE: "34.50",
      ForwardPE: "28.00",
      PriceBookMRQ: "10.50",
      PriceSalesTTM: "11.20",
      EnterpriseValueEbitda: "25.30",
    },
    Financials: {
      Income_Statement: {
        yearly: annualIncome,
        quarterly: quarterlyIncome,
      },
      Cash_Flow: {
        yearly: annualCashFlow,
        quarterly: quarterlyCashFlow,
      },
    },
  };
}

// ── Fetch interceptor ──

let _originalFetch: typeof global.fetch | null = null;

function parseScreenerParams(url: string): { sector?: string; minMarketCap?: number; limit?: number } {
  const urlObj = new URL(url);
  const filtersRaw = urlObj.searchParams.get("filters");
  const limitStr = urlObj.searchParams.get("limit");
  
  let sector: string | undefined;
  let minMarketCap: number | undefined;
  const limit = limitStr ? parseInt(limitStr) : undefined;

  if (filtersRaw) {
    try {
      const filters = JSON.parse(filtersRaw);
      for (const f of filters) {
        if (f[0] === "sector") sector = f[2];
        if (f[0] === "market_capitalization") minMarketCap = f[2];
      }
    } catch { /* ignore parse errors */ }
  }

  return { sector, minMarketCap, limit };
}

function extractSymbolFromPath(pathname: string): string {
  // /api/eod/600519.SHG or /api/fundamentals/600519.SHG
  const parts = pathname.split("/");
  return parts[parts.length - 1] || "";
}

function makeMockResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function installEodhdMock(): void {
  if (_originalFetch) return; // already installed
  _originalFetch = global.fetch;

  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    // Only intercept eodhd.com requests
    if (!url.includes("eodhd.com")) {
      return _originalFetch!(input, init);
    }

    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Screener endpoint: /api/screener
    if (pathname.includes("/screener")) {
      const params = parseScreenerParams(url);
      const data = makeScreenerData(params);
      return makeMockResponse({ data });
    }

    // EOD endpoint: /api/eod/SYMBOL
    if (pathname.includes("/eod/")) {
      const symbol = extractSymbolFromPath(pathname);
      // Return error for obviously invalid symbols (to preserve error-handling tests)
      if (symbol.includes("INVALID")) {
        return new Response("Unauthorized", { status: 401 });
      }
      const data = makeEodData(symbol, 20);
      return makeMockResponse(data);
    }

    // Fundamentals endpoint: /api/fundamentals/SYMBOL
    if (pathname.includes("/fundamentals/")) {
      const symbol = extractSymbolFromPath(pathname);
      // Return error for obviously invalid symbols (to preserve error-handling tests)
      if (symbol.includes("INVALID")) {
        return new Response("Unauthorized", { status: 401 });
      }
      const data = makeFundamentalsData(symbol);
      return makeMockResponse(data);
    }

    // Fallback: return 404 for unknown EODHD endpoints
    return makeMockResponse({ error: "Unknown mock endpoint" }, 404);
  }) as typeof global.fetch;
}

export function removeEodhdMock(): void {
  if (_originalFetch) {
    global.fetch = _originalFetch;
    _originalFetch = null;
  }
}
