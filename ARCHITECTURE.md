# GainLab MCP Server — 代码架构

_改代码前必读。每次架构变更后同步更新。_

---

## 目录结构

```
gainlab-mcp/
├── src/
│   ├── index.ts              — MCP Server 入口（注册工具 + 启动 stdio）
│   ├── data/                 — 数据获取层
│   │   ├── index.ts          — 统一导出 + fetchKlines() 路由
│   │   ├── types.ts          — Kline/Fundamentals 类型定义
│   │   ├── crypto.ts         — Binance REST API（K线 + 24hr ticker）
│   │   ├── us-stock.ts       — FMP stable API（K线 + 基本面 + DCF + estimates）
│   │   ├── a-stock.ts        — EODHD API（沪深 K线 + 基本面）
│   │   ├── commodity.ts      — EODHD FOREX（贵金属 XAUUSD/XAGUSD）
│   │   └── screener.ts       — EODHD screener + Binance 24hr（热力图数据源）
│   ├── tools/                — MCP 工具定义（输入 schema + 执行逻辑）
│   │   ├── kline.ts          — gainlab_kline
│   │   ├── indicators.ts     — gainlab_indicators（MA/EMA/RSI/MACD/BOLL/KDJ/VWAP/AVWAP/ATR）
│   │   ├── overlay.ts        — gainlab_overlay（2-6 资产标准化叠加）
│   │   ├── fundamentals.ts   — gainlab_fundamentals（标准 + DCF + estimates）
│   │   ├── volume-profile.ts — gainlab_volume_profile（POC/VAH/VAL）
│   │   ├── heatmap.ts        — gainlab_heatmap（treemap + 相关性矩阵）
│   │   └── wrb-scoring.ts    — gainlab_wrb_scoring（WRB/HG + Pro 信号）
│   ├── render/               — ECharts 渲染引擎
│   │   ├── engine.ts         — 双模式渲染（HTML interactive + PNG server-side）
│   │   └── themes.ts         — 暗色主题定义
│   └── utils/                — 纯函数工具库
│       ├── ta.ts             — 技术指标计算（MA/EMA/RSI/MACD/BOLL/KDJ/VWAP/ATR）
│       ├── volume-profile.ts — VP 计算（POC/VAH/VAL/价格区间分配）
│       ├── wrb.ts            — WRB/HG 检测算法（Wide Range Bar + Hidden Gap + Pro）
│       ├── correlation.ts    — Pearson 相关系数 + 矩阵
│       ├── crypto-sectors.ts — 120+ 加密 token → 11 板块映射
│       └── fetch.ts          — proxy-aware fetch 封装
├── tests/                    — 测试（与 src/ 结构镜像）
│   ├── data/                 — 数据层测试
│   ├── tools/                — 工具集成测试
│   ├── utils/                — 纯函数单元测试
│   └── render/               — 渲染测试
├── docs/                     — GitHub Pages 展示页
│   ├── index.html            — 单文件展示页（~750行，8 tab）
│   └── sample-data.js        — 非加密市场预拉取数据（EODHD）
├── dist/                     — TypeScript 编译输出
├── scripts/
│   └── check-docs.sh         — README ↔ 代码漂移检查（pre-commit hook）
└── .githooks/
    └── pre-commit            — 自动跑 check-docs.sh
```

## 数据流

```
用户请求 (MCP tool call)
  │
  ▼
tools/*.ts — 解析参数 + Zod 校验
  │
  ▼
data/*.ts — 根据 market 路由到对应数据源
  │         crypto → Binance   (公开 API，无 key)
  │         us_stock → FMP     (STABLE API, $8/mo)
  │         a_stock → EODHD    (付费，73 交易所)
  │         commodity → EODHD  (FOREX 交易所)
  │
  ▼
utils/*.ts — TA 计算 / VP 分析 / WRB 检测 / 相关性
  │
  ▼
render/engine.ts — ECharts 生成
  │         HTML 模式 → 返回交互式 HTML 字符串
  │         PNG 模式  → node-canvas 渲染 → base64 图片
  │
  ▼
MCP 响应（text content + image content）
```

## 7 个 MCP 工具

| 工具 | 输入核心参数 | 输出 | 数据源 |
|---|---|---|---|
| `gainlab_kline` | symbol, market, timeframe, limit | K线图 | data/*.ts |
| `gainlab_indicators` | symbol, indicators[], market | 多面板指标图 | data + utils/ta |
| `gainlab_overlay` | symbols[2-6], market | 标准化%叠加曲线 | data |
| `gainlab_fundamentals` | symbol, mode(standard/dcf/estimates) | 基本面图表 | FMP/EODHD |
| `gainlab_volume_profile` | symbol, rows, vaPercent | VP + K线 + POC/VAH/VAL | data + utils/vp |
| `gainlab_heatmap` | mode(sector/correlation), assets[] | treemap 或 N×N 热力图 | screener/data |
| `gainlab_wrb_scoring` | symbol, sensitivity, lookback | WRB/HG K线标注图 | data + utils/wrb |

## 关键类型

```typescript
// data/types.ts
interface Kline {
  timestamp: number;
  open: number; high: number; low: number; close: number;
  volume: number;
}

// 各 tool 的输入 schema 用 Zod 定义在各自文件顶部
```

## 市场路由

```typescript
// data/index.ts — fetchKlines()
switch(market) {
  case 'crypto':    → crypto.ts (Binance)
  case 'us_stock':  → us-stock.ts (FMP)
  case 'a_stock':   → a-stock.ts (EODHD, 沪/深自动识别)
  case 'commodity': → commodity.ts (EODHD FOREX)
}
```

## 测试 ↔ 源码对应

| 源码 | 测试 |
|---|---|
| src/tools/kline.ts | tests/tools/kline.test.ts (via render/) |
| src/tools/indicators.ts | tests/tools/indicators.test.ts + indicators-vwap-atr.test.ts |
| src/tools/overlay.ts | tests/tools/overlay.test.ts |
| src/tools/fundamentals.ts | tests/tools/fundamentals.test.ts + fundamentals-dcf.test.ts + fundamentals-extended.test.ts |
| src/tools/volume-profile.ts | tests/tools/volume-profile.test.ts |
| src/tools/heatmap.ts | tests/tools/heatmap.test.ts |
| src/tools/wrb-scoring.ts | tests/tools/wrb-scoring.test.ts |
| src/utils/ta.ts | tests/utils/ta.test.ts + ta-vwap-atr.test.ts |
| src/utils/volume-profile.ts | tests/utils/volume-profile.test.ts |
| src/utils/wrb.ts | tests/utils/wrb.test.ts |
| src/utils/correlation.ts | tests/utils/correlation.test.ts |
| src/utils/crypto-sectors.ts | tests/utils/crypto-sectors.test.ts |
| src/data/*.ts | tests/data/*.test.ts |
| src/render/engine.ts | tests/render/engine.test.ts + kline.test.ts + wrb-scoring.test.ts |

## 已知陷阱

1. **FMP stable API**：旧 `/api/v3/` 已废弃，用 `/stable/`。Starter 不支持 screener/batch-quote。
2. **EODHD 贵金属**：在 FOREX 交易所（XAUUSD.FOREX），不是 COMM。
3. **EODHD A股**：沪市 `.SHG`、深市 `.SHE`，data/a-stock.ts 自动识别。
4. **node-canvas**：macOS 需要 `brew install pkg-config cairo pango libpng jpeg giflib librsvg`。
5. **check-docs.sh**：pre-commit hook 自动跑，README 工具数/测试数/文件结构不一致会阻止提交。

---

_创建于 2026-02-17 | 更新时机：新工具/新数据源/架构重构后_
