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
      // Fallback: when real-time returns "NA" (market closed / weekends), use latest EOD data
      if (q.close === 'NA' || q.close === undefined) {
        const eodRes = await fetch(
          `https://eodhd.com/api/eod/${symbol}?api_token=${env.EODHD_API_KEY}&fmt=json&period=d&order=d&limit=2`,
        );
        if (eodRes.ok) {
          const eodData = await eodRes.json();
          if (eodData.length >= 1) {
            const latest = eodData[0];
            const prev = eodData.length >= 2 ? eodData[1] : null;
            const change = prev ? latest.close - prev.close : 0;
            const changePct = prev && prev.close ? (change / prev.close) * 100 : 0;
            return jsonResponse({
              symbol: symbol,
              price: latest.close || latest.adjusted_close || 0,
              change: parseFloat(change.toFixed(4)),
              changePercent: parseFloat(changePct.toFixed(2)),
              volume: latest.volume || 0,
              source: 'eod_fallback',
            }, 200, cors);
          }
        }
      }
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

// ─── market 归一化（MiniMax tool enum → 前端 MarketType）──
function normalizeMarket(m) {
  return { us_stock: 'us', a_share: 'cn', commodity: 'metal' }[m] || m || 'crypto';
}

// ─── tool name → widgetState 映射 ──────────────────────────
function toWidgetState(toolName, toolArgs) {
  const map = {
    gainlab_kline:         (a) => ({ type: 'kline', symbol: a.symbol, market: normalizeMarket(a.market), period: a.timeframe || '1D' }),
    gainlab_indicators:    (a) => ({ type: 'kline', symbol: a.symbol, market: normalizeMarket(a.market), period: a.timeframe || '1D', indicators: a.indicators }),
    gainlab_wrb_scoring:   (a) => ({ type: 'kline', symbol: a.symbol, market: normalizeMarket(a.market), period: a.timeframe || '1D', showWRB: true }),
    gainlab_heatmap:       (a) => ({ type: 'heatmap', market: normalizeMarket(a.market) }),
    gainlab_overlay:       (a) => ({ type: 'overlay', symbols: a.symbols || [], markets: (a.markets || []).map(normalizeMarket), period: a.timeframe || '1D' }),
    gainlab_fundamentals:  (a) => ({ type: 'fundamentals', symbol: a.symbol, market: 'us' }),
    gainlab_volume_profile:(a) => ({ type: 'volume_profile', symbol: a.symbol, market: normalizeMarket(a.market), period: a.timeframe || '1D' }),
  };
  const fn = map[toolName];
  return fn ? fn(toolArgs || {}) : null;
}

// ─── 内部 tool 执行（复用 GET handler 逻辑，不走 HTTP）────
async function executeTool(toolName, toolArgs, env) {
  const a = toolArgs || {};
  const market = normalizeMarket(a.market);

  try {
    switch (toolName) {
      case 'gainlab_kline':
      case 'gainlab_indicators':
      case 'gainlab_wrb_scoring': {
        // 复用 kline 获取逻辑
        const interval = a.timeframe || '1d';
        let data;
        if (market === 'crypto') {
          const bybitInterval = toBybitInterval(interval);
          const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${a.symbol}&interval=${bybitInterval}&limit=200`);
          if (!res.ok) throw new Error(`Bybit ${res.status}`);
          const json = await res.json();
          if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
          data = (json.result.list || []).reverse().map((item) => ({
            timestamp: parseInt(item[0]), open: parseFloat(item[1]), high: parseFloat(item[2]),
            low: parseFloat(item[3]), close: parseFloat(item[4]), volume: parseFloat(item[5]),
          }));
        } else if (market === 'us') {
          const res = await fetch(`https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${a.symbol}&apikey=${env.FMP_API_KEY}`);
          if (!res.ok) throw new Error(`FMP ${res.status}`);
          const json = await res.json();
          data = json.slice(0, 200).reverse().map((d) => ({
            timestamp: new Date(d.date).getTime(), open: d.open, high: d.high,
            low: d.low, close: d.close, volume: d.volume,
          }));
        } else if (market === 'cn' || market === 'metal') {
          const res = await fetch(`https://eodhd.com/api/eod/${a.symbol}?api_token=${env.EODHD_API_KEY}&fmt=json&period=d&order=a`);
          if (!res.ok) throw new Error(`EODHD ${res.status}`);
          const json = await res.json();
          data = json.slice(-200).map((d) => ({
            timestamp: new Date(d.date).getTime(), open: d.open, high: d.high,
            low: d.low, close: d.close, volume: d.volume,
          }));
        } else {
          return { error: `Unsupported market: ${market}` };
        }
        return { data };
      }

      case 'gainlab_heatmap': {
        if (market === 'crypto') {
          const res = await fetch('https://api.bybit.com/v5/market/tickers?category=spot');
          if (!res.ok) throw new Error(`Bybit ${res.status}`);
          const json = await res.json();
          if (json.retCode !== 0) throw new Error(`Bybit: ${json.retMsg}`);
          const list = json.result.list || [];
          const top = list.filter((t) => t.symbol.endsWith('USDT'))
            .sort((x, y) => parseFloat(y.turnover24h) - parseFloat(x.turnover24h))
            .slice(0, 50)
            .map((t) => ({
              name: t.symbol.replace('USDT', ''), symbol: t.symbol,
              value: parseFloat(t.turnover24h), price: parseFloat(t.lastPrice),
              change: parseFloat(t.price24hPcnt) * 100,
            }));
          return { data: top };
        }
        return { data: [] };
      }

      case 'gainlab_overlay': {
        // 并行获取多个 symbol 的 kline
        const symbols = a.symbols || [];
        const markets = (a.markets || []).map(normalizeMarket);
        const interval = a.timeframe || '1d';
        const results = await Promise.all(
          symbols.map((sym, i) => executeTool('gainlab_kline', { symbol: sym, market: markets[i] || 'crypto', timeframe: interval }, env))
        );
        return { series: symbols.map((sym, i) => ({ symbol: sym, market: markets[i] || 'crypto', data: results[i]?.data || [] })) };
      }

      case 'gainlab_fundamentals': {
        if (market === 'us' || !a.market) {
          const res = await fetch(`https://financialmodelingprep.com/stable/profile?symbol=${a.symbol}&apikey=${env.FMP_API_KEY}`);
          if (!res.ok) throw new Error(`FMP ${res.status}`);
          const json = await res.json();
          return json[0] || {};
        }
        return { error: 'Fundamentals not available for this market' };
      }

      case 'gainlab_volume_profile': {
        // VP 需要 kline 数据，返回原始 kline 让前端计算
        return await executeTool('gainlab_kline', { symbol: a.symbol, market: a.market, timeframe: a.timeframe }, env);
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (e) {
    return { error: e.message };
  }
}

// ─── <think> 标签过滤 ──────────────────────────────────────
function stripThinkTags(text) {
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
function createSSEMiddleware(upstreamBody, env) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // 累积 tool_calls（MiniMax 可能分多个 chunk 发送 arguments）
  let pendingToolCalls = {};  // id → { name, arguments_str }

  // 跨 chunk think 标签过滤状态
  let insideThink = false;     // 当前是否在 <think> 块内
  let thinkBuffer = '';        // 缓冲区（处理 <think> 或 </think> 标签跨 chunk 的情况）

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstreamBody.getReader();
      let buffer = '';

      function send(obj) {
        controller.enqueue(encoder.encode('data: ' + JSON.stringify(obj) + '\n\n'));
      }

      // 跨 chunk 的 think 过滤器
      function filterThink(text) {
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

            let parsed;
            try {
              parsed = JSON.parse(payload);
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
                let args = {};
                try { args = JSON.parse(tc.arguments_str); } catch {}

                // 发送 tool_call 事件
                send({ type: 'tool_call', tool: { id, name: tc.name, arguments: args } });

                // 执行 tool
                const result = await executeTool(tc.name, args, env);
                const widgetState = toWidgetState(tc.name, args);

                // 发送 tool_result + widgetState
                const event = { type: 'tool_result', result };
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
        send({ type: 'error', message: e.message || 'SSE middleware error' });
      } finally {
        controller.close();
      }
    },
  });

  return stream;
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

      // SSE 中间件：解析 MiniMax 流 → 转换格式 + 执行 tool + 注入 widgetState
      const enrichedStream = createSSEMiddleware(miniMaxResponse.body, env);
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
      return new Response(JSON.stringify({ error: 'Internal error', detail: e.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
