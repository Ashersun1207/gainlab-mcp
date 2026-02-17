// GainLab API Proxy Worker
// Proxies chat requests to MiniMax M2 with rate limiting + CORS

interface Env {
  MINIMAX_API_KEY: string;
  ALLOWED_ORIGIN: string;
}

// In-memory rate limiting (resets on worker restart, fine for demo)
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
function corsHeaders(origin: string, allowedOrigin: string): Record<string, string> {
  // Allow both the GitHub Pages origin and localhost for dev
  const allowed = origin === allowedOrigin || origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env.ALLOWED_ORIGIN);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Only POST /api/chat
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
      const body = await request.json() as { messages: Array<{ role: string; content: string }> };
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
            ...messages.slice(-10), // Last 10 messages for context
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
    } catch (e: any) {
      return new Response(JSON.stringify({ error: 'Internal error', detail: e.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
