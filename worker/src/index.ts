// GainLab API Proxy Worker
// Proxies chat requests to MiniMax M2 with rate limiting + CORS
// + REST GET endpoints for kline, quote, search, fundamentals, screener
//
// Crypto: Bybit API (Binance blocks CF Worker IPs)
// US: FMP /stable/ endpoints
// CN/Metal: EODHD

// In-memory rate limiting (resets on worker restart, fine for demo)
const ipCounts = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

function checkRateLimit(ip) {
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
function corsHeaders(origin, allowedOrigin) {
  const allowed = origin === allowedOrigin || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// ─── JSON helper ────────────────────────────────────────────
function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// ─── Bybit interval mapping ────────────────────────────────
// Bybit uses: 1,3,5,15,30,60,120,240,360,720,D,W,M
function toBybitInterval(interval) {
  const map = {
    '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
    '1h': '60', '2h': '120', '4h': '240', '6h': '360', '12h': '720',
    '1d': 'D', '1w': 'W', '1M': 'M',
  };
  return map[interval] || 'D';
}

// ─── GET /api/kline ─────────────────────────────────────────
async function handleKline(url, env, cors) {
  const symbol = url.searchParams.get('symbol') || '';
  const market = url.searchParams.get('market') || '';
  const interval = url.searchParams.get('interval') || '1d';

  if (!symbol || !market) {
    return jsonResponse({ error: 'symbol and market required', code: 'MISSING_PARAMS' }, 400, cors);
  }

  try {
    let data;
    if (market === 'crypto') {
      // Bybit V5 API — Binance blocks CF Worker IPs, Bybit doesn't
      // Response: { result: { list: [[ts, open, high, low, close, volume, turnover], ...] } }
      // Bybit returns newest first, need to reverse
      const bybitInterval = toBybitInterval(interval);
      const res = await fetch(
        `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${bybitInterval}&limit=200`,
      );
      if (!res.ok) throw new Error(`Bybit ${res.status}`);
      const json = await res.json();
      if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
      const list = json.result.list || [];
      // Reverse to chronological order (Bybit returns newest first)
      data = list.reverse().map((item) => ({
        timestamp: parseInt(item[0]),
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5]),
      }));
    } else if (market === 'us') {
      // FMP /stable/historical-price-eod/full — returns flat array, newest first
      const res = await fetch(
        `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${symbol}&apikey=${env.FMP_API_KEY}`,
      );
      if (!res.ok) throw new Error(`FMP ${res.status}`);
      const json = await res.json();
      // FMP returns newest first, reverse to chronological, take 200
      data = json.slice(0, 200).reverse().map((d) => ({
        timestamp: new Date(d.date).getTime(),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
      }));
    } else if (market === 'cn' || market === 'metal') {
      // EODHD /api/eod/ — order=a for ascending
      const res = await fetch(
        `https://eodhd.com/api/eod/${symbol}?api_token=${env.EODHD_API_KEY}&fmt=json&period=d&order=a`,
      );
      if (!res.ok) throw new Error(`EODHD ${res.status}`);
      const json = await res.json();
      data = json.slice(-200).map((d) => ({
        timestamp: new Date(d.date).getTime(),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        volume: d.volume,
      }));
    } else {
      return jsonResponse({ error: `Unsupported market: ${market}`, code: 'UNSUPPORTED_MARKET' }, 400, cors);
    }
    return jsonResponse({ data }, 200, cors);
  } catch (e) {
    return jsonResponse({ error: e.message, code: 'UPSTREAM_ERROR' }, 502, cors);
  }
}

// ─── GET /api/quote ─────────────────────────────────────────
async function handleQuote(url, env, cors) {
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
      const json = await res.json();
      if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
      const t = (json.result.list || [])[0] || {};
      return jsonResponse({
        symbol: t.symbol || symbol,
        price: parseFloat(t.lastPrice) || 0,
        change: parseFloat(t.lastPrice) - parseFloat(t.prevPrice24h) || 0,
        changePercent: parseFloat(t.price24hPcnt) * 100 || 0,
        volume: parseFloat(t.volume24h) || 0,
        quoteVolume: parseFloat(t.turnover24h) || 0,
      }, 200, cors);
    } else if (market === 'us') {
      // FMP /stable/quote — returns array, field: changePercentage
      const res = await fetch(
        `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${env.FMP_API_KEY}`,
      );
      if (!res.ok) throw new Error(`FMP ${res.status}`);
      const json = await res.json();
      const q = json[0] || {};
      return jsonResponse({
        symbol: q.symbol,
        price: q.price || 0,
        change: q.change || 0,
        changePercent: q.changePercentage || 0,
        volume: q.volume || 0,
        marketCap: q.marketCap || 0,
        name: q.name || '',
      }, 200, cors);
    } else if (market === 'cn' || market === 'metal') {
      // EODHD /api/real-time/ — fields: close, change, change_p
      const res = await fetch(
        `https://eodhd.com/api/real-time/${symbol}?api_token=${env.EODHD_API_KEY}&fmt=json`,
      );
      if (!res.ok) throw new Error(`EODHD ${res.status}`);
      const q = await res.json();
      return jsonResponse({
        symbol: symbol,
        price: q.close || 0,
        change: q.change || 0,
        changePercent: q.change_p || 0,
        volume: q.volume || 0,
      }, 200, cors);
    }
    return jsonResponse({ error: `Unsupported market: ${market}`, code: 'UNSUPPORTED_MARKET' }, 400, cors);
  } catch (e) {
    return jsonResponse({ error: e.message, code: 'UPSTREAM_ERROR' }, 502, cors);
  }
}

// ─── GET /api/search ────────────────────────────────────────
async function handleSearch(url, env, cors) {
  const query = url.searchParams.get('q') || '';
  const market = url.searchParams.get('market') || '';

  if (!query) {
    return jsonResponse({ error: 'q (query) required', code: 'MISSING_PARAMS' }, 400, cors);
  }

  try {
    if (market === 'us') {
      // FMP /stable/search-name (实测: /stable/search 返回空)
      const res = await fetch(
        `https://financialmodelingprep.com/stable/search-name?query=${encodeURIComponent(query)}&limit=10&apikey=${env.FMP_API_KEY}`,
      );
      if (!res.ok) return jsonResponse({ results: [] }, 200, cors);
      const json = await res.json();
      return jsonResponse({
        results: json.map((r) => ({
          symbol: r.symbol,
          name: r.name,
          exchange: r.exchange,
          currency: r.currency,
        })),
      }, 200, cors);
    } else if (market === 'cn' || market === 'metal') {
      // EODHD /api/search/ — fields: Code, Exchange, Name
      const res = await fetch(
        `https://eodhd.com/api/search/${encodeURIComponent(query)}?api_token=${env.EODHD_API_KEY}&fmt=json`,
      );
      if (!res.ok) return jsonResponse({ results: [] }, 200, cors);
      const json = await res.json();
      return jsonResponse({
        results: json.slice(0, 10).map((r) => ({
          symbol: `${r.Code}.${r.Exchange}`,
          name: r.Name,
          exchange: r.Exchange,
          type: r.Type,
        })),
      }, 200, cors);
    } else if (market === 'crypto') {
      // No search API for crypto, return empty
      return jsonResponse({ results: [] }, 200, cors);
    }
    return jsonResponse({ results: [] }, 200, cors);
  } catch (e) {
    return jsonResponse({ results: [] }, 200, cors);
  }
}

// ─── GET /api/fundamentals ──────────────────────────────────
async function handleFundamentals(url, env, cors) {
  const symbol = url.searchParams.get('symbol') || '';
  const market = url.searchParams.get('market') || 'us';

  if (!symbol) {
    return jsonResponse({ error: 'symbol required', code: 'MISSING_PARAMS' }, 400, cors);
  }

  try {
    if (market === 'us') {
      // FMP /stable/profile — returns array with companyName, marketCap, etc.
      const res = await fetch(
        `https://financialmodelingprep.com/stable/profile?symbol=${symbol}&apikey=${env.FMP_API_KEY}`,
      );
      if (!res.ok) throw new Error(`FMP ${res.status}`);
      const json = await res.json();
      return jsonResponse(json[0] || {}, 200, cors);
    } else if (market === 'cn') {
      // EODHD /api/fundamentals/
      const res = await fetch(
        `https://eodhd.com/api/fundamentals/${symbol}?api_token=${env.EODHD_API_KEY}&fmt=json`,
      );
      if (!res.ok) throw new Error(`EODHD ${res.status}`);
      const json = await res.json();
      return jsonResponse(json, 200, cors);
    }
    // crypto & metal: no fundamentals
    return jsonResponse({ error: 'Fundamentals not available for this market', code: 'NOT_AVAILABLE' }, 400, cors);
  } catch (e) {
    return jsonResponse({ error: e.message, code: 'UPSTREAM_ERROR' }, 502, cors);
  }
}

// ─── GET /api/screener ──────────────────────────────────────
async function handleScreener(url, env, cors) {
  const market = url.searchParams.get('market') || '';

  try {
    if (market === 'crypto') {
      // Bybit V5 tickers — get all spot tickers, filter USDT pairs, sort by turnover
      const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
      if (!res.ok) throw new Error(`Bybit ${res.status}`);
      const json = await res.json();
      if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
      const list = json.result.list || [];
      const top = list
        .filter((t) => t.symbol.endsWith('USDT'))
        .sort((a, b) => parseFloat(b.turnover24h) - parseFloat(a.turnover24h))
        .slice(0, 50)
        .map((t) => ({
          name: t.symbol.replace('USDT', ''),
          symbol: t.symbol,
          value: parseFloat(t.turnover24h),
          price: parseFloat(t.lastPrice),
          change: parseFloat(t.price24hPcnt) * 100,
        }));
      return jsonResponse({ data: top }, 200, cors);
    }
    // us, cn, metal: return empty (screener only for crypto)
    return jsonResponse({ data: [] }, 200, cors);
  } catch (e) {
    return jsonResponse({ error: e.message, code: 'UPSTREAM_ERROR' }, 502, cors);
  }
}

// System prompt
const SYSTEM_PROMPT = `You are GainLab Demo Agent — a financial chart assistant powered by GainLab MCP tools.

Your capabilities:
- Generate K-line/candlestick charts (gainlab_kline)
- Compare multiple assets (gainlab_overlay)
- Show technical indicators like RSI, MACD, Bollinger Bands (gainlab_indicators)
- Display company fundamentals (gainlab_fundamentals)
- Analyze volume profiles (gainlab_volume_profile)
- Show sector heatmaps (gainlab_heatmap)
- Detect WRB/Hidden Gap patterns (gainlab_wrb_scoring)

Rules:
- ONLY handle financial chart and data analysis requests
- For non-financial requests, politely decline and suggest a financial query
- Always use a tool when the user asks for charts or analysis
- Explain briefly what the chart shows after generating it
- Supported markets: Crypto (real-time), US Stock, A-Share, Commodities (sample data)
- Respond in the same language as the user's message`;

// Tool definitions for MiniMax
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'gainlab_kline',
      description: 'Generate a K-line (candlestick) chart with volume for any supported asset. Shows OHLCV data with customizable timeframe.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Asset symbol, e.g. BTCUSDT, AAPL, 600519, XAUUSD' },
          market: { type: 'string', enum: ['crypto', 'us_stock', 'a_share', 'commodity'], description: 'Market type' },
          timeframe: { type: 'string', enum: ['1h', '4h', '1d', '1w'], description: 'Timeframe, default 1d' },
        },
        required: ['symbol', 'market'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gainlab_overlay',
      description: 'Compare multiple assets on a single normalized chart. Great for showing relative performance.',
      parameters: {
        type: 'object',
        properties: {
          symbols: { type: 'array', items: { type: 'string' }, description: 'List of symbols to compare, e.g. ["BTCUSDT", "ETHUSDT"]' },
          markets: { type: 'array', items: { type: 'string', enum: ['crypto', 'us_stock', 'a_share', 'commodity'] }, description: 'Market for each symbol' },
          timeframe: { type: 'string', enum: ['1h', '4h', '1d', '1w'], description: 'Timeframe, default 1d' },
        },
        required: ['symbols', 'markets'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gainlab_indicators',
      description: 'Show K-line chart with technical indicators like RSI, MACD, Bollinger Bands, KDJ, EMA, MA, etc.',
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
    },
  },
  {
    type: 'function',
    function: {
      name: 'gainlab_fundamentals',
      description: 'Show company fundamentals: income statement, key metrics, DCF valuation, analyst estimates. Available for AAPL, MSFT, 600519 (Moutai).',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Stock symbol: AAPL, MSFT, or 600519' },
          mode: { type: 'string', enum: ['overview', 'income', 'valuation'], description: 'Display mode, default overview' },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gainlab_volume_profile',
      description: 'Show volume profile analysis — horizontal volume distribution at different price levels, identifying support/resistance zones.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Asset symbol' },
          market: { type: 'string', enum: ['crypto', 'us_stock', 'a_share', 'commodity'], description: 'Market type' },
          timeframe: { type: 'string', enum: ['1h', '4h', '1d', '1w'], description: 'Timeframe, default 1d' },
        },
        required: ['symbol', 'market'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gainlab_heatmap',
      description: 'Show sector heatmap (treemap) for crypto or stock markets. Shows market cap weighted sector performance.',
      parameters: {
        type: 'object',
        properties: {
          market: { type: 'string', enum: ['crypto', 'us_stock'], description: 'Market type' },
        },
        required: ['market'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gainlab_wrb_scoring',
      description: 'Analyze Wide Range Bar (WRB) patterns and Hidden Gaps for a given asset. Shows bullish/bearish scoring.',
      parameters: {
        type: 'object',
        properties: {
          symbol: { type: 'string', description: 'Asset symbol' },
          market: { type: 'string', enum: ['crypto', 'us_stock', 'a_share', 'commodity'], description: 'Market type' },
          timeframe: { type: 'string', enum: ['1h', '4h', '1d', '1w'], description: 'Timeframe, default 1d' },
        },
        required: ['symbol', 'market'],
      },
    },
  },
];

export default {
  async fetch(request, env) {
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
      const body = await request.json();
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

      // Stream the response back
      return new Response(miniMaxResponse.body, {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Internal error', detail: e.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
