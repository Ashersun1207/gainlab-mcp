<p align="center">
  <img src="https://img.shields.io/badge/🦞-GainLab-00d4aa?style=for-the-badge" alt="GainLab" />
</p>

<h1 align="center">GainLab MCP Server</h1>
<h3 align="center">Agent's Eyes for Financial Charts 📊</h3>

<p align="center">
  <em>Agent 会分析，但不会画图。GainLab 帮 Agent 画图。</em>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#tools">Tools</a> •
  <a href="#demo">Demo</a>
</p>

---

## What is GainLab?

Every AI Agent (Claude, ChatGPT, OpenClaw, custom agents) needs to **show** financial data, not just describe it. But agents can't draw charts. **GainLab gives agents eyes.**

GainLab is an MCP Server that provides professional financial chart visualization. Agents call GainLab tools, and get back interactive charts or PNG images.

```
Agent: "Show me BTC's daily candlestick chart"
  ↓ MCP Protocol
GainLab: fetches data → renders chart → returns interactive HTML or PNG
```

## Features

- 📊 **K-Line Charts** — Professional candlestick + volume charts
- 📈 **Multi-Asset Overlay** — Compare BTC vs Gold vs SPY on one chart *(coming soon)*
- 🔧 **Technical Indicators** — MA, RSI, MACD, Bollinger Bands *(coming soon)*
- 📋 **Fundamentals** — Revenue, P/E, margins — Koyfin-style visualization *(coming soon)*
- 📅 **Financial Calendar** — Earnings, FOMC, CPI, unlock events *(coming soon)*
- 📊 **Volume Profile** — See where the money is *(coming soon)*
- ⚡ **Funding Rate** — Crypto perpetual contract rates *(coming soon)*
- 🔔 **Alerts** — Price, event, and indicator alerts *(coming soon)*

### Markets Covered

| Market | Data Source | Status |
|--------|-----------|--------|
| 🪙 Crypto | Binance, OKX | ✅ Live |
| 🇺🇸 US Stocks | FMP | 🔜 Phase 2 |
| 🇨🇳 A-Shares | EODHD | 🔜 Phase 2 |
| 🥇 Commodities | FMP + EODHD | 🔜 Phase 2 |

## Quick Start

### Use with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gainlab": {
      "command": "npx",
      "args": ["tsx", "/path/to/gainlab-mcp/src/index.ts"],
      "env": {
        "HTTP_PROXY": "http://127.0.0.1:7897"
      }
    }
  }
}
```

Then ask Claude: *"Draw a BTC daily K-line chart"*

### Use with any MCP client

```bash
git clone https://github.com/Ashersun1207/gainlab-mcp.git
cd gainlab-mcp
pnpm install
pnpm dev
```

## Tools

### `gainlab_kline` ✅

Draw a candlestick (K-line) chart with volume.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `symbol` | string | required | `"BTCUSDT"`, `"AAPL"`, `"600519.SHG"` |
| `market` | enum | required | `crypto`, `us_stock`, `a_stock`, `commodity` |
| `timeframe` | enum | `"1d"` | `1m` to `1M` |
| `limit` | number | `100` | Number of candles (10-500) |
| `format` | enum | `"interactive"` | `interactive` (HTML) or `image` (PNG) |

**Output:** Interactive HTML chart or PNG image

## Demo

K-line chart rendered by GainLab (BTC/USDT Daily):

→ [View Live Demo](https://ashersun1207.github.io/gainlab-mcp/)

## Architecture

```
Three-layer design (no framework lock-in):

Layer 1: REST API        — Any agent can use (coming soon)
Layer 2: MCP Server      — Direct to Claude/ChatGPT ← YOU ARE HERE
Layer 3: @gainlab/react   — Tambo / CopilotKit / Vercel AI SDK (coming soon)
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **MCP:** @modelcontextprotocol/sdk
- **Charts:** Apache ECharts (SSR via node-canvas)
- **Validation:** Zod

## Roadmap

- [x] Phase 1: Project skeleton + K-line chart
- [ ] Phase 2: Multi-market data + Overlay + Indicators + Fundamentals
- [ ] Phase 3: Calendar + Volume Profile + Funding Rate
- [ ] Phase 4: Alerts + npm publish + Smithery

## License

Apache 2.0 — See [LICENSE](LICENSE)

---

<p align="center">
  <em>Built by <a href="https://github.com/Ashersun1207">Asher</a> & 智慧卷卷 🦞</em>
</p>
