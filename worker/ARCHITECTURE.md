# Worker Architecture

_GainLab API Proxy — Cloudflare Worker_

---

## 职责

1. **REST API 代理** — 5 个 GET 端点，将前端请求路由到上游数据源（Bybit / EODHD + FMP fallback）
2. **AI Chat SSE 中间件** — 1 个 POST 端点，将 MiniMax M2.5 的 SSE 流转换为 GainLab 格式，拦截 tool_call 执行后注入 widgetState

## 端点清单

| 方法 | 路径 | 功能 | 数据源路由 |
|---|---|---|---|
| GET | `/api/kline` | K线数据 | crypto→Bybit, us/cn/metal→EODHD |
| GET | `/api/quote` | 实时报价 | crypto→Bybit, us/cn/metal→EODHD |
| GET | `/api/search` | 股票/加密搜索 | crypto→Bybit instruments, us/cn/metal→EODHD |
| GET | `/api/fundamentals` | 基本面数据 | us/cn→EODHD |
| GET | `/api/screener` | 热力图数据 | crypto→Bybit |
| POST | `/api/chat` | AI 对话（SSE） | MiniMax M2.5 → SSE 中间件 |

## 核心架构

```
前端 (gainlab-app)
  │
  ├── GET /api/* ──→ handleKline/handleQuote/... ──→ 上游 API
  │                        ↓ 共享函数
  │                  fetchKlineData / fetchHeatmapData / fetchFundamentals
  │
  └── POST /api/chat ──→ MiniMax M2.5
                              ↓ SSE stream
                        createSSEMiddleware
                              ↓ 逐 chunk 解析
                        ┌─ text_delta → 直接透传
                        ├─ tool_call → executeTool() → tool_result + widgetState
                        └─ done/error → 透传
```

## TOOL_REGISTRY（单一真相源）

`TOOL_REGISTRY` 是一个 `Record<string, ToolEntry>`，每个 tool 定义：

| 字段 | 用途 |
|---|---|
| `description` | 写进 system prompt |
| `whenToUse` | 写进 system prompt 的使用指南 |
| `parameters` | 转换为 MiniMax function_call schema |
| `toWidgetState` | 从 tool 参数生成前端 widget 指令 |
| `execute` | 实际执行（调用共享 fetch 函数） |

`buildSystemPrompt()` 和 `buildToolDefs()` 从 TOOL_REGISTRY 自动生成，**不手写 prompt/schema**。

当前 tools: `get_kline`, `get_quote`, `search_symbol`, `get_fundamentals`, `get_screener`, `compare_assets`, `get_market_overview`

## 数据源路由

| market | 上游 | 备注 |
|---|---|---|
| `crypto` | Bybit V5 API | Binance 封锁 CF Worker IP |
| `us` | EODHD 主 + FMP fallback | `AAPL.US`，EODHD 失败自动切 FMP |
| `cn` | EODHD | `.SHG`/`.SHE` 后缀 |
| `metal` | EODHD | `XAU.COMM` / `XAG.COMM` |

## SSE 中间件流程

`createSSEMiddleware(upstreamBody, env)`:

1. 读 MiniMax SSE chunk → 解析 `data: {...}` 行
2. `choices[0].delta.content` → 发送 `text_delta` 事件
3. `choices[0].delta.tool_calls` → 累积参数，`finish_reason=tool_calls` 时：
   - `executeTool()` 调用对应 fetch 函数
   - `toWidgetState()` 生成 widget 指令
   - 发送 `tool_call` + `tool_result`（含 widgetState）
   - 将结果回传 MiniMax 获取总结
4. `finish_reason=stop` → 发送 `done`
5. 异常 → 发送 `error`

## 前后端契约

Wire format 定义在 `worker/src/types.ts`。前端 `mcpClient.ts` 负责映射：

| Worker 发送 | 前端映射为 | 说明 |
|---|---|---|
| `tool.arguments` | `toolCall.args` | 字段重命名 |
| `SSEError.message` | `error` | 字段重命名 |
| `WorkerMarketType` (4种) | `MarketType` (10种) | Worker 是前端子集 |

修改 SSE 事件格式时，必须同步检查 `gainlab-app/src/services/mcpClient.ts`。

## 基础设施

- **Rate Limiting**: 内存 Map，10 req/min/IP，Worker 重启重置
- **CORS**: 白名单 `ALLOWED_ORIGIN` + `localhost`
- **部署**: Cloudflare REST API（不用 wrangler，代理环境不稳定）
- **类型检查**: `npx tsc --noEmit`（零错误）
- **质量验证**: `bash worker/verify.sh`（V1 tsc + V2 契约 + V3 重复 + V4 冒烟）

## 文件结构

```
worker/
├── src/
│   ├── index.ts      # 主文件（891 行，19 函数）
│   └── types.ts      # Wire Format 契约类型
├── verify.sh          # 质量验证脚本
├── tsconfig.json      # TypeScript 配置
├── package.json       # @cloudflare/workers-types + wrangler
├── wrangler.toml      # Worker 部署配置
└── ARCHITECTURE.md    # 本文件
```

---

_Last updated: 2026-02-20 (T7 + EODHD主+FMP fallback双数据源)_
