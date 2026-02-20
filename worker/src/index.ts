// GainLab API Proxy Worker
// Proxies chat requests to MiniMax M2 with rate limiting + CORS
// + REST GET endpoints for kline, quote, search, fundamentals, screener
//
// Crypto: Bybit API (Binance blocks CF Worker IPs)
// US/CN/Metal: EODHD primary, FMP fallback for US (429 prone but has unique data)

import type { KlineBar, WidgetState, WorkerMarketType } from './types';

// ─── Env ────────────────────────────────────────────────────
interface Env {
  MINIMAX_API_KEY: string;
  ALLOWED_ORIGIN: string;
  EODHD_API_KEY: string;
  FMP_API_KEY: string; // fallback for US stocks when EODHD fails
}

// ─── ToolEntry ──────────────────────────────────────────────
interface ToolEntry {
  description: string;
  whenToUse: string;
  parameters: Record<string, unknown>;
  toWidgetState: (args: Record<string, unknown>) => WidgetState | null;
  execute: (args: Record<string, unknown>, env: Env) => Promise<unknown>;
}

// ─── In-memory rate limiting (resets on worker restart, fine for demo) ──
const ipCounts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipCounts.get(ip);
  if (!record || now > record.resetAt) {
    ipCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (record.count >= MAX_REQUESTS) return false;
  record.count++;
  return true;
}

// CORS headers
const DEFAULT_ALLOWED_ORIGIN = 'https://ashersun1207.github.io';
function corsHeaders(origin: string, allowedOrigin: string): Record<string, string> {
  const effectiveAllowed = allowedOrigin || DEFAULT_ALLOWED_ORIGIN;
  const allowed = origin === effectiveAllowed || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : effectiveAllowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ─── JSON helper ────────────────────────────────────────────
function jsonResponse(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// ─── Bybit interval mapping ────────────────────────────────
// Bybit uses: 1,3,5,15,30,60,120,240,360,720,D,W,M
function toBybitInterval(interval: string): string {
  const map: Record<string, string> = {
    '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
    '1h': '60', '2h': '120', '4h': '240', '6h': '360', '12h': '720',
    '1d': 'D', '1w': 'W', '1M': 'M',
  };
  return map[interval] || 'D';
}

// ─── market 归一化（MiniMax tool enum → 前端 MarketType）──
function normalizeMarket(m: string): WorkerMarketType {
  const map: Record<string, WorkerMarketType> = { us_stock: 'us', a_share: 'cn', commodity: 'metal' };
  return map[m] || (m as WorkerMarketType) || 'crypto';
}

// ─── EODHD → FMP fallback（仅 US 市场）──────────────────────
// EODHD 是主数据源，FMP 是 fallback。两个都有就双保险。
async function fetchWithFallback<T>(
  eodhFn: () => Promise<T>,
  fmpFn: (() => Promise<T>) | null,
): Promise<T> {
  try {
    return await eodhFn();
  } catch (eodhErr) {
    if (fmpFn) {
      try {
        return await fmpFn();
      } catch {
        // Both failed — throw the original EODHD error
      }
    }
    throw eodhErr;
  }
}

// ─── 公共数据获取（多个 tool 共享，独立于 TOOL_REGISTRY）──

async function fetchKlineData(symbol: string, market: string, timeframe: string | undefined, env: Env): Promise<KlineBar[]> {
  const interval = timeframe || '1d';
  if (market === 'crypto') {
    const bybitInterval = toBybitInterval(interval);
    const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${bybitInterval}&limit=200`);
    if (!res.ok) throw new Error(`Bybit ${res.status}`);
    const json = await res.json() as { retCode: number; retMsg: string; result: { list: string[][] } };
    if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
    return (json.result.list || []).reverse().map((item) => ({
      timestamp: parseInt(item[0]), open: parseFloat(item[1]), high: parseFloat(item[2]),
      low: parseFloat(item[3]), close: parseFloat(item[4]), volume: parseFloat(item[5]),
    }));
  } else if (market === 'us' || market === 'cn' || market === 'metal') {
    const eodhSymbol = market === 'us' ? `${symbol}.US` : symbol;
    const parseEod = (json: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>): KlineBar[] =>
      json.slice(-200).map((d) => ({
        timestamp: new Date(d.date).getTime(), open: d.open, high: d.high,
        low: d.low, close: d.close, volume: d.volume,
      }));

    return fetchWithFallback(
      // EODHD primary
      async () => {
        const res = await fetch(`https://eodhd.com/api/eod/${eodhSymbol}?api_token=${env.EODHD_API_KEY}&fmt=json&period=d&order=a`);
        if (!res.ok) throw new Error(`EODHD ${res.status}`);
        return parseEod(await res.json() as Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>);
      },
      // FMP fallback (US only)
      market === 'us' && env.FMP_API_KEY ? async () => {
        const res = await fetch(`https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${symbol}&apikey=${env.FMP_API_KEY}`);
        if (!res.ok) throw new Error(`FMP ${res.status}`);
        const json = await res.json() as Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
        return json.slice(0, 200).reverse().map((d) => ({
          timestamp: new Date(d.date).getTime(), open: d.open, high: d.high,
          low: d.low, close: d.close, volume: d.volume,
        }));
      } : null,
    );
  }
  throw new Error(`Unsupported market: ${market}`);
}

interface HeatmapItem {
  name: string;
  symbol: string;
  value: number;
  price: number;
  change: number;
}

async function fetchHeatmapData(market: string): Promise<HeatmapItem[]> {
  if (market === 'crypto') {
    const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
    if (!res.ok) throw new Error(`Bybit ${res.status}`);
    const json = await res.json() as { retCode: number; retMsg: string; result: { list: Array<{ symbol: string; turnover24h: string; lastPrice: string; price24hPcnt: string }> } };
    if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
    const list = json.result.list || [];
    return list.filter((t) => t.symbol.endsWith('USDT'))
      .sort((x, y) => parseFloat(y.turnover24h) - parseFloat(x.turnover24h))
      .slice(0, 50)
      .map((t) => ({
        name: t.symbol.replace('USDT', ''), symbol: t.symbol,
        value: parseFloat(t.turnover24h), price: parseFloat(t.lastPrice),
        change: parseFloat(t.price24hPcnt) * 100,
      }));
  }
  return [];
}

async function fetchFundamentals(symbol: string, env: Env): Promise<Record<string, unknown>> {
  return fetchWithFallback(
    // EODHD primary
    async () => {
      const res = await fetch(`https://eodhd.com/api/fundamentals/${symbol}.US?api_token=${env.EODHD_API_KEY}&fmt=json`);
      if (!res.ok) throw new Error(`EODHD ${res.status}`);
      const json = await res.json() as Record<string, unknown>;
      const general = (json.General || {}) as Record<string, unknown>;
      const highlights = (json.Highlights || {}) as Record<string, unknown>;
      const valuation = (json.Valuation || {}) as Record<string, unknown>;
      return {
        symbol: general.Code, companyName: general.Name,
        sector: general.Sector, industry: general.Industry,
        description: general.Description, country: general.CountryName,
        mktCap: highlights.MarketCapitalization, price: highlights.WallStreetTargetPrice,
        pe: highlights.PERatio, eps: highlights.EarningsShare,
        revenue: highlights.Revenue, grossProfit: highlights.GrossProfitMRQ,
        ebitda: highlights.EBITDA, trailingPE: valuation.TrailingPE,
        forwardPE: valuation.ForwardPE, priceToBook: valuation.PriceBookMRQ,
        priceToSales: valuation.PriceSalesTTM,
      };
    },
    // FMP fallback
    env.FMP_API_KEY ? async () => {
      const res = await fetch(`https://financialmodelingprep.com/stable/profile?symbol=${symbol}&apikey=${env.FMP_API_KEY}`);
      if (!res.ok) throw new Error(`FMP ${res.status}`);
      const json = await res.json() as Record<string, unknown>[];
      return json[0] || {};
    } : null,
  );
}

// ─── GET /api/kline ─────────────────────────────────────────
async function handleKline(url: URL, env: Env, cors: Record<string, string>): Promise<Response> {
  const symbol = url.searchParams.get('symbol') || '';
  const market = url.searchParams.get('market') || '';
  const interval = url.searchParams.get('interval') || '1d';

  if (!symbol || !market) {
    return jsonResponse({ error: 'symbol and market required', code: 'MISSING_PARAMS' }, 400, cors);
  }

  // Validate market
  if (market !== 'crypto' && market !== 'us' && market !== 'cn' && market !== 'metal') {
    return jsonResponse({ error: `Unsupported market: ${market}`, code: 'UNSUPPORTED_MARKET' }, 400, cors);
  }

  try {
    const data = await fetchKlineData(symbol, market, interval, env);
    return jsonResponse({ data }, 200, cors);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e), code: 'UPSTREAM_ERROR' }, 502, cors);
  }
}

// ─── GET /api/quote ─────────────────────────────────────────
async function handleQuote(url: URL, env: Env, cors: Record<string, string>): Promise<Response> {
  const symbol = url.searchParams.get('symbol') || '';
  const market = url.searchParams.get('market') || '';

  if (!symbol || !market) {
    return jsonResponse({ error: 'symbol and market required', code: 'MISSING_PARAMS' }, 400, cors);
  }

  try {
    if (market === 'crypto') {
      // Bybit V5 tickers
      const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
      if (!res.ok) throw new Error(`Bybit ${res.status}`);
      const json = await res.json() as { retCode: number; retMsg: string; result: { list: Array<{ symbol: string; lastPrice: string; prevPrice24h: string; price24hPcnt: string; volume24h: string; turnover24h: string }> } };
      if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
      const t = (json.result.list || [])[0] || {} as Record<string, string>;
      return jsonResponse({
        symbol: t.symbol || symbol,
        price: parseFloat(t.lastPrice) || 0,
        change: parseFloat(t.lastPrice) - parseFloat(t.prevPrice24h) || 0,
        changePercent: parseFloat(t.price24hPcnt) * 100 || 0,
        volume: parseFloat(t.volume24h) || 0,
        quoteVolume: parseFloat(t.turnover24h) || 0,
      }, 200, cors);
    } else if (market === 'us' || market === 'cn' || market === 'metal') {
      const eodhSymbol = market === 'us' ? `${symbol}.US` : symbol;
      // EODHD real-time → EOD fallback → FMP fallback (US only)
      const eodhQuote = async (): Promise<Record<string, unknown>> => {
        const res = await fetch(
          `https://eodhd.com/api/real-time/${eodhSymbol}?api_token=${env.EODHD_API_KEY}&fmt=json`,
        );
        if (!res.ok) throw new Error(`EODHD ${res.status}`);
        const q = await res.json() as { close: number | string | undefined; change: number; change_p: number; volume: number };
        // When real-time returns "NA" (market closed / weekends), use latest EOD data
        if (q.close === 'NA' || q.close === undefined) {
          const eodRes = await fetch(
            `https://eodhd.com/api/eod/${eodhSymbol}?api_token=${env.EODHD_API_KEY}&fmt=json&period=d&order=d&limit=2`,
          );
          if (eodRes.ok) {
            const eodData = await eodRes.json() as Array<{ close: number; adjusted_close: number; volume: number }>;
            if (eodData.length >= 1) {
              const latest = eodData[0];
              const prev = eodData.length >= 2 ? eodData[1] : null;
              const change = prev ? latest.close - prev.close : 0;
              const changePct = prev && prev.close ? (change / prev.close) * 100 : 0;
              return { symbol, price: latest.close || latest.adjusted_close || 0,
                change: parseFloat(change.toFixed(4)), changePercent: parseFloat(changePct.toFixed(2)),
                volume: latest.volume || 0, source: 'eod_fallback' as const };
            }
          }
          throw new Error('EODHD real-time NA and EOD fallback empty');
        }
        return { symbol, price: q.close as number || 0, change: q.change || 0,
          changePercent: q.change_p || 0, volume: q.volume || 0 };
      };
      const fmpQuote = market === 'us' && env.FMP_API_KEY ? async (): Promise<Record<string, unknown>> => {
        const res = await fetch(
          `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${env.FMP_API_KEY}`,
        );
        if (!res.ok) throw new Error(`FMP ${res.status}`);
        const json = await res.json() as Array<{ symbol: string; price: number; change: number; changePercentage: number; volume: number; marketCap: number; name: string }>;
        const q = json[0] || {} as Record<string, unknown>;
        return { symbol: q.symbol || symbol, price: q.price || 0, change: q.change || 0,
          changePercent: q.changePercentage || 0, volume: q.volume || 0,
          marketCap: q.marketCap || 0, name: q.name || '', source: 'fmp_fallback' as const };
      } : null;
      const data = await fetchWithFallback(eodhQuote, fmpQuote);
      return jsonResponse(data, 200, cors);
    }
    return jsonResponse({ error: `Unsupported market: ${market}`, code: 'UNSUPPORTED_MARKET' }, 400, cors);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e), code: 'UPSTREAM_ERROR' }, 502, cors);
  }
}

// ─── GET /api/search ────────────────────────────────────────
async function handleSearch(url: URL, env: Env, cors: Record<string, string>): Promise<Response> {
  const query = url.searchParams.get('q') || '';
  const market = url.searchParams.get('market') || '';

  if (!query) {
    return jsonResponse({ error: 'q (query) required', code: 'MISSING_PARAMS' }, 400, cors);
  }

  try {
    if (market === 'us' || market === 'cn' || market === 'metal') {
      // EODHD /api/search/ — all non-crypto markets
      const res = await fetch(
        `https://eodhd.com/api/search/${encodeURIComponent(query)}?api_token=${env.EODHD_API_KEY}&fmt=json`,
      );
      if (!res.ok) return jsonResponse({ results: [] }, 200, cors);
      const json = await res.json() as Array<{ Code: string; Exchange: string; Name: string; Type: string }>;
      // Filter by exchange: us→US, cn→SHG/SHE, metal→COMM
      const exchangeFilter = market === 'us' ? ['US'] : market === 'cn' ? ['SHG', 'SHE'] : ['COMM'];
      const filtered = json.filter((r) => exchangeFilter.includes(r.Exchange));
      return jsonResponse({
        results: (filtered.length > 0 ? filtered : json).slice(0, 10).map((r) => ({
          symbol: market === 'us' ? r.Code : `${r.Code}.${r.Exchange}`,
          name: r.Name,
          exchange: r.Exchange,
          type: r.Type,
        })),
      }, 200, cors);
    } else if (market === 'crypto') {
      // Bybit V5 instruments — filter by query, USDT pairs only
      const res = await fetch(
        'https://api.bybit.com/v5/market/instruments-info?category=spot',
      );
      if (!res.ok) return jsonResponse({ results: [] }, 200, cors);
      const json = await res.json() as {
        result: { list: Array<{ symbol: string; baseCoin: string; quoteCoin: string; status: string }> };
      };
      const q = query.toUpperCase();
      const matches = (json.result?.list || [])
        .filter((i) => i.quoteCoin === 'USDT' && i.status === 'Trading' && i.baseCoin.includes(q))
        .slice(0, 10)
        .map((i) => ({
          symbol: i.symbol,
          name: `${i.baseCoin}/USDT`,
          exchange: 'Bybit',
        }));
      return jsonResponse({ results: matches }, 200, cors);
    }
    return jsonResponse({ results: [] }, 200, cors);
  } catch {
    return jsonResponse({ results: [] }, 200, cors);
  }
}

// ─── GET /api/fundamentals ──────────────────────────────────
async function handleFundamentals(url: URL, env: Env, cors: Record<string, string>): Promise<Response> {
  const symbol = url.searchParams.get('symbol') || '';
  const market = url.searchParams.get('market') || 'us';

  if (!symbol) {
    return jsonResponse({ error: 'symbol required', code: 'MISSING_PARAMS' }, 400, cors);
  }

  try {
    if (market === 'us') {
      const data = await fetchFundamentals(symbol, env);
      return jsonResponse(data, 200, cors);
    } else if (market === 'cn') {
      // EODHD /api/fundamentals/
      const res = await fetch(
        `https://eodhd.com/api/fundamentals/${symbol}?api_token=${env.EODHD_API_KEY}&fmt=json`,
      );
      if (!res.ok) throw new Error(`EODHD ${res.status}`);
      const json = await res.json() as Record<string, unknown>;
      return jsonResponse(json, 200, cors);
    }
    // crypto & metal: no fundamentals
    return jsonResponse({ error: 'Fundamentals not available for this market', code: 'NOT_AVAILABLE' }, 400, cors);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e), code: 'UPSTREAM_ERROR' }, 502, cors);
  }
}

// ─── GET /api/screener ──────────────────────────────────────
async function handleScreener(url: URL, env: Env, cors: Record<string, string>): Promise<Response> {
  const market = url.searchParams.get('market') || '';

  try {
    if (market === 'crypto') {
      const top = await fetchHeatmapData(market);
      return jsonResponse({ data: top }, 200, cors);
    }
    // us, cn, metal: return empty (screener only for crypto)
    return jsonResponse({ data: [] }, 200, cors);
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : String(e), code: 'UPSTREAM_ERROR' }, 502, cors);
  }
}

// ─── TOOL_REGISTRY — 单一真相源 ─────────────────────────────
// 每个 tool 的定义、路由、执行、widgetState 映射全在一处。
// 加新 tool 只改这里 + 对应的 fetch 函数（如需新数据源）。
//
// ⚠️ whenToUse 是手写路由规则，加新 tool 时必须同步更新
//    buildSystemPrompt() 末尾的优先级列表。

const TOOL_REGISTRY: Record<string, ToolEntry> = {
  gainlab_kline: {
    description: 'Generate a K-line (candlestick) chart for any supported asset',
    whenToUse: 'User wants to see a price chart, candlestick, or OHLCV data. Examples: "看BTC", "show AAPL chart", "ETH走势"',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Asset symbol, e.g. BTCUSDT, AAPL, 600519.SHG' },
        market: { type: 'string', enum: ['crypto', 'us_stock', 'a_share', 'commodity'], description: 'Market type' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d', '1w'], description: 'Timeframe, default 1d' },
      },
      required: ['symbol', 'market'],
    },
    toWidgetState: (a) => ({ type: 'kline', symbol: a.symbol as string, market: normalizeMarket(a.market as string), period: (a.timeframe as string) || '1D' }),
    execute: async (a, env) => {
      const data = await fetchKlineData(a.symbol as string, normalizeMarket(a.market as string), a.timeframe as string | undefined, env);
      return { data };
    },
  },

  gainlab_overlay: {
    description: 'Compare multiple assets on a normalized chart to show relative performance',
    whenToUse: 'User wants to COMPARE 2+ assets. Keywords: "对比", "compare", "vs", "relative". NOT for single asset.',
    parameters: {
      type: 'object',
      properties: {
        symbols: { type: 'array', items: { type: 'string' }, description: 'List of symbols to compare' },
        markets: { type: 'array', items: { type: 'string', enum: ['crypto', 'us_stock', 'a_share', 'commodity'] }, description: 'Market for each symbol' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d', '1w'], description: 'Timeframe, default 1d' },
      },
      required: ['symbols', 'markets'],
    },
    toWidgetState: (a) => ({ type: 'overlay', symbols: (a.symbols as string[]) || [], markets: ((a.markets as string[]) || []).map(normalizeMarket), period: (a.timeframe as string) || '1D' }),
    execute: async (a, env) => {
      const symbols = (a.symbols as string[]) || [];
      const markets = ((a.markets as string[]) || []).map(normalizeMarket);
      const results = await Promise.all(
        symbols.map((sym, i) => fetchKlineData(sym, markets[i] || 'crypto', a.timeframe as string | undefined, env).catch(() => [] as KlineBar[]))
      );
      return { series: symbols.map((sym, i) => ({ symbol: sym, market: markets[i] || 'crypto', data: results[i] || [] })) };
    },
  },

  gainlab_indicators: {
    description: 'Show K-line chart WITH specific technical indicators (RSI, MACD, BOLL, KDJ, EMA, MA, VOL)',
    whenToUse: 'User explicitly asks for technical indicators by name. Keywords: "RSI", "MACD", "布林带", "KDJ", "均线". Do NOT use for simple chart requests.',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Asset symbol' },
        market: { type: 'string', enum: ['crypto', 'us_stock', 'a_share', 'commodity'], description: 'Market type' },
        indicators: { type: 'array', items: { type: 'string', enum: ['RSI', 'MACD', 'BOLL', 'KDJ', 'EMA', 'MA', 'VOL'] }, description: 'Indicators to show' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d', '1w'], description: 'Timeframe, default 1d' },
      },
      required: ['symbol', 'market', 'indicators'],
    },
    toWidgetState: (a) => ({ type: 'kline', symbol: a.symbol as string, market: normalizeMarket(a.market as string), period: (a.timeframe as string) || '1D', indicators: a.indicators }),
    execute: async (a, env) => {
      const data = await fetchKlineData(a.symbol as string, normalizeMarket(a.market as string), a.timeframe as string | undefined, env);
      return { data };
    },
  },

  gainlab_fundamentals: {
    description: 'Show company fundamentals: income, key metrics, DCF valuation, analyst estimates',
    whenToUse: 'User asks about company financials, earnings, PE ratio, revenue, valuation. Keywords: "基本面", "财报", "PE", "revenue", "fundamentals"',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Stock symbol: AAPL, MSFT, etc.' },
        mode: { type: 'string', enum: ['overview', 'income', 'valuation'], description: 'Display mode, default overview' },
      },
      required: ['symbol'],
    },
    toWidgetState: (a) => ({ type: 'fundamentals', symbol: a.symbol as string, market: 'us' }),
    execute: async (a, env) => {
      const market = normalizeMarket(a.market as string);
      if (market === 'us' || !a.market) {
        return await fetchFundamentals(a.symbol as string, env);
      }
      return { error: 'Fundamentals not available for this market' };
    },
  },

  gainlab_volume_profile: {
    description: 'Volume profile — horizontal volume distribution at price levels, identifying support/resistance',
    whenToUse: 'User asks about volume profile, price levels with most trading, support/resistance from volume. Keywords: "量价", "volume profile", "成交量分布"',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Asset symbol' },
        market: { type: 'string', enum: ['crypto', 'us_stock', 'a_share', 'commodity'], description: 'Market type' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d', '1w'], description: 'Timeframe, default 1d' },
      },
      required: ['symbol', 'market'],
    },
    toWidgetState: (a) => ({ type: 'volume_profile', symbol: a.symbol as string, market: normalizeMarket(a.market as string), period: (a.timeframe as string) || '1D' }),
    execute: async (a, env) => {
      const data = await fetchKlineData(a.symbol as string, normalizeMarket(a.market as string), a.timeframe as string | undefined, env);
      return { data };
    },
  },

  gainlab_heatmap: {
    description: 'Market sector heatmap (treemap) showing gains/losses by market cap',
    whenToUse: 'User asks about market overview, sector heat, which sectors are up/down. Keywords: "热力图", "heatmap", "市场热度", "板块"',
    parameters: {
      type: 'object',
      properties: {
        market: { type: 'string', enum: ['crypto', 'us_stock'], description: 'Market type' },
      },
      required: ['market'],
    },
    toWidgetState: (a) => ({ type: 'heatmap', market: normalizeMarket(a.market as string) }),
    execute: async (a) => {
      const data = await fetchHeatmapData(normalizeMarket(a.market as string));
      return { data };
    },
  },

  gainlab_wrb_scoring: {
    description: 'Analyze Wide Range Bar (WRB) patterns and Hidden Gaps for scoring',
    whenToUse: 'User explicitly asks for WRB analysis, wide range bars, hidden gaps. This is an advanced pattern — only use when explicitly requested.',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Asset symbol' },
        market: { type: 'string', enum: ['crypto', 'us_stock', 'a_share', 'commodity'], description: 'Market type' },
        timeframe: { type: 'string', enum: ['1h', '4h', '1d', '1w'], description: 'Timeframe, default 1d' },
      },
      required: ['symbol', 'market'],
    },
    toWidgetState: (a) => ({ type: 'kline', symbol: a.symbol as string, market: normalizeMarket(a.market as string), period: (a.timeframe as string) || '1D', showWRB: true }),
    execute: async (a, env) => {
      const data = await fetchKlineData(a.symbol as string, normalizeMarket(a.market as string), a.timeframe as string | undefined, env);
      return { data };
    },
  },
};

// ─── 从 TOOL_REGISTRY 自动生成 ──────────────────────────────

function buildSystemPrompt(registry: Record<string, ToolEntry>): string {
  const toolDescriptions = Object.entries(registry).map(([name, tool]) => {
    return `- ${name}: ${tool.description}\n  WHEN TO USE: ${tool.whenToUse}`;
  }).join('\n');

  // ⚠️ 优先级列表手写。加新 tool 时必须同步更新此处。
  return `You are GainLab Demo Agent — a financial chart assistant powered by GainLab MCP tools.

Your capabilities:
${toolDescriptions}

Rules:
- ONLY handle financial chart and data analysis requests
- For non-financial requests, politely decline and suggest a financial query
- Use EXACTLY ONE tool per user request — do not call multiple tools for a single query
- Choose the most specific tool that matches the user's intent
- Explain briefly what the chart shows after generating it
- Supported markets: Crypto (real-time), US Stock, A-Share, Commodities (sample data)
- Respond in the same language as the user's message

Tool selection priority (most specific wins):
1. If user mentions specific indicators (RSI, MACD, etc.) → gainlab_indicators
2. If user wants to COMPARE multiple assets → gainlab_overlay
3. If user asks about fundamentals/earnings/PE → gainlab_fundamentals
4. If user asks about volume profile/price levels → gainlab_volume_profile
5. If user asks about market heat/sectors → gainlab_heatmap
6. If user asks about WRB/hidden gaps → gainlab_wrb_scoring
7. For any other chart/price request → gainlab_kline (default)`;
}

interface MiniMaxToolDef {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

function buildToolDefs(registry: Record<string, ToolEntry>): MiniMaxToolDef[] {
  return Object.entries(registry).map(([name, tool]) => ({
    type: 'function',
    function: {
      name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

// ─── 由 TOOL_REGISTRY 驱动 ─────────────────────────────────
const SYSTEM_PROMPT = buildSystemPrompt(TOOL_REGISTRY);
const TOOLS = buildToolDefs(TOOL_REGISTRY);

async function executeTool(toolName: string, toolArgs: Record<string, unknown>, env: Env): Promise<unknown> {
  const entry = TOOL_REGISTRY[toolName];
  if (!entry?.execute) return { error: `Unknown tool: ${toolName}` };
  try {
    return await entry.execute(toolArgs || {}, env);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

function toWidgetState(toolName: string, toolArgs: Record<string, unknown>): WidgetState | null {
  const entry = TOOL_REGISTRY[toolName];
  return entry?.toWidgetState ? entry.toWidgetState(toolArgs || {}) : null;
}

// ─── <think> 标签过滤 ──────────────────────────────────────
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// ─── SSE 中间件：解析 MiniMax OpenAI 格式 → 自定义格式 ────
//
// MiniMax 返回:
//   {"choices":[{"delta":{"content":"...","tool_calls":[...]}, "finish_reason":"..."}]}
//
// 转换为前端期望:
//   {"type":"text_delta","text":"..."}
//   {"type":"tool_call","tool":{"id":"...","name":"...","arguments":{...}}}
//   {"type":"tool_result","result":{...},"widgetState":{...}}
//   [DONE]
//

interface PendingToolCall {
  name: string;
  arguments_str: string;
}

interface MiniMaxDelta {
  content?: string;
  tool_calls?: Array<{
    index?: number;
    id?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

interface MiniMaxChoice {
  delta?: MiniMaxDelta;
  finish_reason?: string | null;
}

interface MiniMaxChunk {
  choices?: MiniMaxChoice[];
}

function createSSEMiddleware(upstreamBody: ReadableStream<Uint8Array>, env: Env): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // 累积 tool_calls（MiniMax 可能分多个 chunk 发送 arguments）
  let pendingToolCalls: Record<string, PendingToolCall> = {};

  // 跨 chunk think 标签过滤状态
  let insideThink = false;     // 当前是否在 <think> 块内
  let thinkBuffer = '';        // 缓冲区（处理 <think> 或 </think> 标签跨 chunk 的情况）

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstreamBody.getReader();
      let buffer = '';

      function send(obj: Record<string, unknown>): void {
        controller.enqueue(encoder.encode('data: ' + JSON.stringify(obj) + '\n\n'));
      }

      // 跨 chunk 的 think 过滤器
      function filterThink(text: string): string {
        let result = '';
        thinkBuffer += text;

        while (thinkBuffer.length > 0) {
          if (insideThink) {
            // 在 think 块内，寻找 </think>
            const closeIdx = thinkBuffer.indexOf('</think>');
            if (closeIdx !== -1) {
              // 找到关闭标签，跳过 think 内容
              thinkBuffer = thinkBuffer.slice(closeIdx + '</think>'.length);
              insideThink = false;
            } else {
              // 没找到，可能还没到，清空缓冲（内容丢弃）
              // 但保留末尾可能是 "</thi" 的部分
              if (thinkBuffer.length > 8) {
                thinkBuffer = thinkBuffer.slice(-8); // 保留最后 8 字符以匹配 </think>
              }
              break;
            }
          } else {
            // 在 think 块外，寻找 <think>
            const openIdx = thinkBuffer.indexOf('<think>');
            if (openIdx !== -1) {
              // 输出 <think> 之前的内容
              result += thinkBuffer.slice(0, openIdx);
              thinkBuffer = thinkBuffer.slice(openIdx + '<think>'.length);
              insideThink = true;
            } else {
              // 没找到 <think>，但末尾可能是 "<thi" 的部分
              // 安全输出除了最后 7 字符以外的内容
              if (thinkBuffer.length > 7) {
                result += thinkBuffer.slice(0, -7);
                thinkBuffer = thinkBuffer.slice(-7);
              }
              break;
            }
          }
        }

        return result;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const payload = trimmed.slice('data: '.length).trim();

            if (payload === '[DONE]') {
              // 流结束，flush thinkBuffer 中剩余的非 think 内容
              if (!insideThink && thinkBuffer.length > 0) {
                const remaining = thinkBuffer.trim();
                thinkBuffer = '';
                if (remaining) {
                  send({ type: 'text_delta', text: remaining });
                }
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              continue;
            }

            let parsed: MiniMaxChunk;
            try {
              parsed = JSON.parse(payload) as MiniMaxChunk;
            } catch {
              continue; // 跳过无法解析的行
            }

            const choice = parsed.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta || {};
            const finishReason = choice.finish_reason;

            // ── 文字内容（跨 chunk think 过滤）──
            if (delta.content) {
              const text = filterThink(delta.content);
              if (text) {
                send({ type: 'text_delta', text });
              }
            }

            // ── tool_calls 累积 ──
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                const id = tc.id || `tool_${idx}`;
                if (!pendingToolCalls[id] && tc.id) {
                  // 新 tool call
                  pendingToolCalls[id] = {
                    name: tc.function?.name || '',
                    arguments_str: tc.function?.arguments || '',
                  };
                } else if (pendingToolCalls[id] || pendingToolCalls[`tool_${idx}`]) {
                  // 追加 arguments（MiniMax 分 chunk 发）
                  const key = pendingToolCalls[id] ? id : `tool_${idx}`;
                  if (tc.function?.name) pendingToolCalls[key].name = tc.function.name;
                  if (tc.function?.arguments) pendingToolCalls[key].arguments_str += tc.function.arguments;
                } else if (!tc.id) {
                  // 没有 id 的追加 chunk，用 index 关联
                  const existing = Object.values(pendingToolCalls)[idx];
                  if (existing && tc.function?.arguments) {
                    existing.arguments_str += tc.function.arguments;
                  }
                }
              }
            }

            // ── finish_reason = tool_calls → 执行所有 pending tools ──
            if (finishReason === 'tool_calls') {
              for (const [id, tc] of Object.entries(pendingToolCalls)) {
                let args: Record<string, unknown> = {};
                try { args = JSON.parse(tc.arguments_str) as Record<string, unknown>; } catch { /* empty */ }

                // 发送 tool_call 事件
                send({ type: 'tool_call', tool: { id, name: tc.name, arguments: args } });

                // 执行 tool
                const result = await executeTool(tc.name, args, env);
                const widgetState = toWidgetState(tc.name, args);

                // 发送 tool_result + widgetState
                const event: Record<string, unknown> = { type: 'tool_result', result };
                if (widgetState) event.widgetState = widgetState;
                send(event);
              }
              pendingToolCalls = {};
            }

            // ── finish_reason = stop → 正常结束 ──
            // 不做额外处理，[DONE] 会紧随其后
          }
        }
      } catch (e) {
        send({ type: 'error', message: e instanceof Error ? e.message : 'SSE middleware error' });
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}

// SYSTEM_PROMPT and TOOLS are now auto-generated from TOOL_REGISTRY above

interface ChatMessage {
  role: string;
  content: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ─── GET endpoints ────────────────────────────────────
    if (request.method === 'GET') {
      if (url.pathname === '/api/kline') return handleKline(url, env, cors);
      if (url.pathname === '/api/quote') return handleQuote(url, env, cors);
      if (url.pathname === '/api/search') return handleSearch(url, env, cors);
      if (url.pathname === '/api/fundamentals') return handleFundamentals(url, env, cors);
      if (url.pathname === '/api/screener') return handleScreener(url, env, cors);
    }

    // ─── POST /api/chat (existing, untouched) ─────────────
    if (url.pathname !== '/api/chat' || request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(ip)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in a minute.' }), {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json() as { messages?: ChatMessage[] };
      const { messages } = body;

      if (!messages || !Array.isArray(messages)) {
        return new Response(JSON.stringify({ error: 'messages array required' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // Call MiniMax M2 API
      const miniMaxResponse = await fetch('https://api.minimax.chat/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.MINIMAX_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'MiniMax-M2',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...messages.slice(-10),
          ],
          tools: TOOLS,
          tool_choice: 'auto',
          stream: true,
        }),
      });

      if (!miniMaxResponse.ok) {
        const err = await miniMaxResponse.text();
        return new Response(JSON.stringify({ error: 'AI API error', detail: err }), {
          status: 502,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      // SSE 中间件：解析 MiniMax 流 → 转换格式 + 执行 tool + 注入 widgetState
      const enrichedStream = createSSEMiddleware(miniMaxResponse.body!, env);
      return new Response(enrichedStream, {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Internal error', detail: e instanceof Error ? e.message : String(e) }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};

// stripThinkTags is defined but used indirectly via SSE middleware's filterThink
void stripThinkTags;