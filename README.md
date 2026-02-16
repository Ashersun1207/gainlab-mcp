<p align="center">
  <img src="https://img.shields.io/badge/🦞-GainLab-00d4aa?style=for-the-badge" alt="GainLab" />
</p>

<h1 align="center">GainLab MCP Server</h1>
<h3 align="center">Agent's Eyes for Financial Charts 📊</h3>

<p align="center">
  <em>Agents can analyze, but they can't draw charts. GainLab gives agents eyes.</em>
</p>

<p align="center">
  <a href="https://ashersun1207.github.io/gainlab-mcp/">Live Demo</a> •
  <a href="#tools">4 Tools</a> •
  <a href="#markets">4 Markets</a> •
  <a href="#quick-start">Quick Start</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tools-4%20available-00d4aa" alt="Tools" />
  <img src="https://img.shields.io/badge/tests-112%20passing-00d4aa" alt="Tests" />
  <img src="https://img.shields.io/badge/markets-crypto%20%7C%20US%20%7C%20A--shares%20%7C%20gold-5b8ff9" alt="Markets" />
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License" />
</p>

---

## What is GainLab?

Every AI Agent (Claude, ChatGPT, OpenClaw, custom agents) needs to **show** financial data, not just describe it. GainLab is an MCP Server that provides professional financial chart visualization.

```
You: "Compare BTC vs Gold performance this year"
  ↓ MCP Protocol
GainLab: fetches data → normalizes → renders overlay chart → returns interactive HTML
```

## Tools

| Tool | Description | Status |
|------|-------------|--------|
| `gainlab_kline` | Candlestick charts with volume | ✅ Live |
| `gainlab_indicators` | Technical indicators (MA/EMA/RSI/MACD/BOLL/KDJ) | ✅ Live |
| `gainlab_overlay` | Multi-asset comparison (2-6 assets, normalized) | ✅ Live |
| `gainlab_fundamentals` | Revenue, margins, EPS — peer comparison | ✅ Live |
| `gainlab_calendar` | Financial calendar (earnings, FOMC, CPI) | 🔜 Phase 3 |
| `gainlab_volume_profile` | Volume-at-price distribution | 🔜 Phase 3 |
| `gainlab_funding` | Crypto perpetual funding rates | 🔜 Phase 3 |

## Markets

| Market | Data Source | Klines | Fundamentals |
|--------|-----------|--------|-------------|
| 🪙 Crypto | Binance (free) | ✅ | — |
| 🇺🇸 US Stocks | FMP ($8/mo) | ✅ daily | ✅ |
| 🇨🇳 A-Shares | EODHD | ✅ daily | ✅ |
| 🥇 Precious Metals | EODHD | ✅ daily | — |

## Quick Start

### Option 1: With Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gainlab": {
      "command": "npx",
      "args": ["tsx", "/path/to/gainlab-mcp/src/index.ts"],
      "env": {
        "FMP_API_KEY": "your-key",
        "EODHD_API_KEY": "your-key"
      }
    }
  }
}
```

Then ask Claude: *"Draw a BTC daily K-line chart with RSI and MACD"*

### Option 2: Run directly

```bash
git clone https://github.com/Ashersun1207/gainlab-mcp.git
cd gainlab-mcp
pnpm install
pnpm dev  # starts MCP server on stdio
```

### API Keys (optional)

Crypto works without any key. For other markets:

```bash
export FMP_API_KEY=xxx     # US stocks ($8/mo starter plan)
export EODHD_API_KEY=xxx   # A-shares + precious metals
```

## Tool Reference

### `gainlab_kline`

```json
{
  "symbol": "BTCUSDT",
  "market": "crypto",
  "timeframe": "1d",
  "limit": 100,
  "format": "interactive"
}
```

### `gainlab_indicators`

```json
{
  "symbol": "AAPL",
  "market": "us_stock",
  "timeframe": "1d",
  "indicators": ["MA", "RSI", "MACD"],
  "ma_periods": [7, 25, 99],
  "limit": 100
}
```

### `gainlab_overlay`

```json
{
  "assets": [
    { "symbol": "BTCUSDT", "market": "crypto" },
    { "symbol": "XAUUSD", "market": "commodity" }
  ],
  "timeframe": "1d",
  "period": "1Y",
  "normalize": true
}
```

### `gainlab_fundamentals`

```json
{
  "symbols": ["AAPL", "MSFT", "GOOGL"],
  "market": "us_stock",
  "metrics": ["revenue", "net_income", "eps"],
  "period": "annual",
  "years": 5
}
```

## Project Structure

```
src/
├── index.ts                  # MCP Server entry point
├── data/                     # Data layer (one file per market)
│   ├── types.ts              #   Shared interfaces (OHLCV, FundamentalData)
│   ├── index.ts              #   Router (dispatches by market type)
│   ├── crypto.ts             #   Binance API
│   ├── us-stock.ts           #   FMP stable API
│   ├── a-stock.ts            #   EODHD (Shanghai/Shenzhen auto-detect)
│   └── commodity.ts          #   EODHD FOREX (gold, silver)
├── render/                   # Rendering layer
│   ├── engine.ts             #   ECharts → HTML or PNG
│   ├── themes.ts             #   GainLab dark theme
│   └── charts/               #   Chart configs (one per tool)
│       ├── kline.ts
│       ├── indicators.ts     #     Dynamic multi-panel layout
│       ├── overlay.ts        #     Date alignment + normalization
│       └── fundamentals.ts   #     Grouped bar + peer comparison
├── tools/                    # MCP tool definitions (one per tool)
│   ├── kline.ts
│   ├── indicators.ts
│   ├── overlay.ts
│   └── fundamentals.ts
└── utils/
    ├── fetch.ts              # Proxy-aware HTTP client
    └── ta.ts                 # Technical indicators (pure math, zero deps)
```

**Design principles:**
- Each market = one data file. Each tool = one tool file + one chart file.
- `ta.ts` is pure math — no API calls, no imports, fully testable.
- Rendering engine supports both interactive HTML and server-side PNG.
- All data sources degrade gracefully when API keys are missing.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  AI Agent                        │
│  (Claude, ChatGPT, OpenClaw, custom)             │
└──────────────────────┬──────────────────────────┘
                       │ MCP Protocol
┌──────────────────────▼──────────────────────────┐
│            @gainlab/mcp-server                   │
│                                                  │
│  Tools ──→ Data Layer ──→ Render Layer ──→ Output│
│  (4 tools)  (4 markets)   (ECharts)    (HTML/PNG)│
└──────────────────────────────────────────────────┘
```

Three-layer design (no framework lock-in):
1. **MCP Server** — Direct to Claude/ChatGPT ← current
2. **REST API** — Any agent can call (planned)
3. **@gainlab/react** — Embeddable components (planned)

## Tech Stack

| Component | Choice |
|-----------|--------|
| Runtime | Node.js + TypeScript |
| MCP SDK | @modelcontextprotocol/sdk |
| Charts | Apache ECharts |
| Server-side rendering | node-canvas |
| Validation | Zod |
| Package manager | pnpm |

## Testing

```bash
pnpm test  # 112 tests across 21 suites
```

Tests cover: data fetching (all 4 markets), chart generation, technical indicator math, tool registration.

## Roadmap

- [x] **Phase 1** — Skeleton + K-line chart (Binance)
- [x] **Phase 2** — 4 markets + Indicators + Overlay + Fundamentals
- [ ] **Phase 3** — Calendar + Volume Profile + Funding Rate
- [ ] **Phase 4** — Alerts + npm publish + Smithery marketplace

## License

Apache 2.0 — See [LICENSE](LICENSE)

---

<p align="center">
  <em>Built by <a href="https://github.com/Ashersun1207">Asher</a> & 智慧卷卷 🦞</em>
</p>
