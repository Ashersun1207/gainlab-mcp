# GainLab 展示页架构文档

_修改展示页前必读。每次改完同步更新此文档。_

---

## 文件结构

```
docs/
├── index.html               — 单文件展示页（HTML + CSS + JS，~1586行，106KB）
├── sample-data.js            — 非加密市场预拉取数据（10标的，~55KB）
├── sample-fundamentals.json  — 基本面预拉取数据（AAPL/MSFT/GOOGL/NVDA）
├── DEMO-ARCHITECTURE.md      — 本文件
└── CHANGELOG.md              — 展示页变更日志
```

## 9 个 Tab

| # | Tab ID | 面板 | 控件 | 渲染函数 | 说明 |
|---|---|---|---|---|---|
| 1 | kline | p-kline | kl-m, kl-s, kl-t, kl-l | `lkl()` | K线图 |
| 2 | vp | p-vp | vp-m, vp-s, vp-t, vp-l, vp-r | `lvp()` | Volume Profile |
| 3 | indicators | p-indicators | in-m, in-s, in-i | `lind()` | 技术指标 |
| 4 | overlay | p-overlay | ov-1~ov-6, ov-d | `lov()` | 多资产叠加 |
| 5 | fundamentals | p-fundamentals | fn-s, fn-m | `lfun()` → `lfunStd/DCF/Est()` | 基本面 |
| 6 | wrb | p-wrb | wrb-m, wrb-s, wrb-t, wrb-l | `lwrb()` | WRB 评分 |
| 7 | heatmap | p-heatmap | hm-m, hm-l, hm-v | `lhm()` | 热力图（仅 Crypto） |
| 8 | corr | p-corr | cr-m, cr-a1~a4, cr-d | `lcr()` | 相关性矩阵 |
| 9 | **chat** | **p-chat** | **toolbar + 对话框** | **chatToolbarGo() / chatExecuteTool()** | **AI Chat（侧边栏布局）** |

## 数据流

| 市场 | 数据源 | 方式 | 延迟 |
|---|---|---|---|
| Crypto (USDT对) | Binance REST API | 实时 fetch | ~200ms |
| US Stock / A-Share / Commodity / Index | sample-data.js (SD对象) | 预加载静态 | 0 |
| 基本面 | sample-fundamentals.json | 预加载静态 | 0 |
| AI Chat 对话 | Cloudflare Worker → MiniMax M2 | SSE 流式 | ~3-5s |

**数据路由**：`fdata(sym,tf,lim)` — symbol 以 `USDT` 结尾 → Binance API，否则 → SD[symbol]

## AI Chat Tab 架构

### 布局

```
┌─────────────────────────────────────────────────┐
│ p-chat                                          │
│ ┌─────────────────────────┬────────────────────┐│
│ │ .chat-chart-main (75%)  │ .chat-sidebar      ││
│ │ ┌─────────────────────┐ │   (280px)          ││
│ │ │ .chat-toolbar       │ │ ┌────────────────┐ ││
│ │ │ 市场/标的/周期/指标  │ │ │ 对话消息列表   │ ││
│ │ │ + [Go] 按钮         │ │ │                │ ││
│ │ ├─────────────────────┤ │ │                │ ││
│ │ │ #c-chat-main        │ │ │                │ ││
│ │ │ (ECharts 图表区)    │ │ ├────────────────┤ ││
│ │ │ position:absolute   │ │ │ 预设问题按钮   │ ││
│ │ │ inset:0             │ │ ├────────────────┤ ││
│ │ ├─────────────────────┤ │ │ 输入框+发送    │ ││
│ │ │ .chat-chart-status  │ │ └────────────────┘ ││
│ │ └─────────────────────┘ │                    ││
│ └─────────────────────────┴────────────────────┘│
│ [手机端: .chat-mobile-tabs 切换 图表/对话]      │
└─────────────────────────────────────────────────┘
```

- **桌面**：75% 图表 + 280px 侧边栏
- **手机**：tab 切换（图表 / 对话）

### Worker API

```
CHAT_API = 'https://gainlab-api.asher-sun.workers.dev/api/chat'
```

- Cloudflare Worker 代理 → MiniMax M2
- SSE 流式响应，前端 `filterThink()` 过滤 `<think>` 标签
- IP 限流 10 req/min（内存 Map，demo 级别）
- 非金融问题被拒绝

### 两种图表生成方式

| 方式 | 触发 | 调 AI？ | 函数 |
|---|---|---|---|
| **Toolbar Go** | 点击 [Go] 按钮 | ❌ 本地渲染 | `chatToolbarGo()` |
| **AI 对话** | 发送消息 / 预设按钮 | ✅ Worker → MiniMax | `sendChatMessage()` → `chatExecuteTool()` |

Toolbar Go 不经过 AI，不写入 chatMessages，直接本地渲染。

### 7 个 AI Tool

AI 可调用的工具，在前端 `chatExecuteTool()` 中执行：

| Tool | 函数内处理 | 数据源 |
|---|---|---|
| `gainlab_kline` | fdata → ECharts K线 | Binance / SD |
| `gainlab_indicators` | fdata → TA 计算 → 多面板 | Binance / SD |
| `gainlab_overlay` | fdata×N → 归一化叠加 | Binance / SD |
| `gainlab_fundamentals` | sample-fundamentals.json | 静态 |
| `gainlab_volume_profile` | fdata → calcVP → K线+VP | Binance / SD |
| `gainlab_heatmap` | Binance 24hr ticker → treemap | Binance only |
| `gainlab_wrb_scoring` | fdata → detectWRB → 标注 | Binance / SD |

### chatMessages 管理

- 数组上限 20 条（slice(-20)），防止 payload 膨胀
- 对话历史发给 Worker 保持上下文
- Toolbar Go 不写入 chatMessages

## 全部函数索引（51 个）

### 渲染函数（11）

| 函数 | Tab | 说明 |
|---|---|---|
| `lkl()` | kline | K线+成交量 |
| `lvp()` | vp | K线+VP+POC/VAH/VAL |
| `lind()` | indicators | K线+多指标面板 |
| `lov()` | overlay | 2-6 资产归一化叠加 |
| `lfun()` | fundamentals | 路由到三种模式 |
| `lfunStd()` | fundamentals | 标准基本面柱状图 |
| `lfunDCF()` | fundamentals | DCF 估值仪表盘 |
| `lfunEst()` | fundamentals | 分析师预期 EPS |
| `lwrb()` | wrb | WRB/HG K线标注 |
| `lhm()` | heatmap | Crypto 板块 Treemap |
| `lcr()` | corr | 相关性矩阵热力图 |

### Chat 函数（12）

| 函数 | 说明 |
|---|---|
| `chatScrollBottom()` | 滚动到底部 |
| `chatAddMsg(role, content)` | 添加消息气泡 |
| `chatAddTyping()` | 添加 typing 指示器 |
| `chatSetBusy(bool)` | 设置忙碌状态 |
| `chatMobileTab(which)` | 手机端 tab 切换 |
| `chatSend()` | 处理发送按钮点击 |
| `chatToolbarUpdateSymbols()` | 市场切换时更新标的下拉 |
| `chatTfSelect(el)` | 周期按钮组切换 |
| `chatIndToggle(el)` | 指标 toggle 切换 |
| `chatToolbarGo()` | Toolbar 本地渲染（不经 AI） |
| `chatNormSymbol(sym, market)` | 标准化 symbol 名 |
| `chatExecuteTool(name, args)` | 执行 AI 返回的 tool call |

### 通信函数（2）

| 函数 | 说明 |
|---|---|
| `sendChatMessage(text)` | 发请求到 Worker，解析 SSE，触发 tool call |
| `filterThink(text)` | 过滤 MiniMax `<think>` 标签 |

### TA 计算函数（8）

| 函数 | 说明 |
|---|---|
| `ma(arr, n)` | 简单移动平均 |
| `ema(arr, n)` | 指数移动平均 |
| `rsi(arr, n)` | RSI |
| `macd(arr)` | MACD + Signal + Histogram |
| `boll(arr, n, k)` | 布林带 |
| `vwap(klines)` | VWAP |
| `atr(klines, n)` | ATR |
| `norm(arr)` | 归一化为 % 变化 |

### 数据/分析函数（6）

| 函数 | 说明 |
|---|---|
| `fdata(sym, tf, lim)` | 统一数据获取（Binance / SD） |
| `fb(sym, tf, lim)` | Binance K线 fetch |
| `fd(ts, tf)` | 时间戳格式化 |
| `calcVP(klines, rows, vaP)` | Volume Profile 计算 |
| `detectWRB(klines, lb, sens)` | WRB/HG 检测 |
| `pcorr(a, b)` | Pearson 相关系数 |

### Heatmap 辅助函数（2）

| 函数 | 说明 |
|---|---|
| `cBase(sym)` | 提取 base token（去 USDT） |
| `cChg(t)` | 格式化涨跌百分比 |

### UI 函数（10）

| 函数 | 说明 |
|---|---|
| `ic(id)` | 获取/初始化 ECharts 实例 |
| `sw(name, el)` | Tab 切换 |
| `t(key)` | i18n 取文案 |
| `setLang(lang)` | 中英文切换 |
| `updateMarketSelectors()` | 更新所有 mkt-sel 文案 |
| `umkt(prefix)` | 市场切换 → 更新标的下拉 |
| `umktCorr()` | 相关性市场切换 |
| `initSelects()` | 初始化所有下拉框 |
| `initChatPanel()` | 初始化 Chat 面板 |

## 市场 → 标的映射

```js
MKT_SYMS = {
  crypto:    ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'],
  us_stock:  ['AAPL', 'MSFT', 'NVDA', 'TSLA'],
  a_stock:   ['600519', '000001'],
  commodity: ['XAUUSD', 'XAGUSD'],
  index:     ['SPY', 'QQQ']
}
```

## Heatmap 常量

```js
CSEC  — 87 个加密 token → 11 板块映射
EXCL  — 排除的稳定币/包装币（USDT/USDC/BUSD/DAI/WBTC/stETH 等）
```

## I18N

- `I18N` 对象：~86 个 key，zh/en 双语
- `t(key)` 函数取当前语言文案
- 41 个 `data-i18n` 属性元素由 `setLang()` 批量更新
- 市场选择器文案由 `updateMarketSelectors()` 更新
- **新增文案必须 zh/en 都加**
- 仍有 ~29 个硬编码中文字符串待国际化

## ECharts 坐标系约定

### ⚠️ 关键陷阱

- **xAxis 是 category 类型**（日期字符串数组）
- `markPoint.coord` 必须用 `[categoryValue, yValue]` 即 `[dt[idx], price]`
- `markArea` 的 xAxis/yAxis 也用实际值，不用数组索引
- **不能用数字索引做 coord**，ECharts category 轴不接受

### 各 Tab Grid 布局

| Tab | Grid 数量 | 布局 |
|---|---|---|
| kline | 2 | K线(56%) + 成交量(18%) |
| vp | 3 | K线(60%) + 成交量(12%) + VP横向柱(右侧28%) |
| indicators | 2+N | K线 + 成交量 + RSI/MACD/ATR 各一个 sub-panel |
| overlay | 1 | N条归一化%曲线（2-6 资产） |
| wrb | 2 | K线+WRB标记+Gap区域(54%) + 成交量(14%) |
| corr | 1 | N×N 热力图 |
| heatmap | 1 | Treemap（width:94%, height:84%） |
| fundamentals | 1 | Bar/Gauge/Bar（三种模式） |
| chat | 1 | 固定 #c-chat-main 容器，复用所有工具渲染 |

## 样式变量

```css
--up: #00d4aa (绿/涨)    --dn: #ff4757 (红/跌)
--acc: #5b8ff9 (蓝)      --gold: #ffc233 (金)
--purp: #7c4dff (紫)     --bg: #08081a (深底)
--card: #12122b          --bdr: #1e1e3d
--txt: #e8e8f0           --dim: #8888aa
```

## 已知问题

| # | 状态 | 问题 | 说明 |
|---|---|---|---|
| 1 | ⚠️ | WRB markPoint/Gap 显示异常 | coord 语法已修，但视觉效果仍不对 |
| 2 | ⚠️ | VP K线与 VP 柱对齐问题 | custom series + renderItem 方案，仍有偏移 |
| 3 | ⚠️ | 热力图仅 Crypto | Binance 24hr ticker only，无美股/A股数据源 |
| 4 | ⚠️ | Chat 热力图容器偏小 | ~370px vs 主 tab 580px |
| 5 | 📋 | 29 个硬编码中文字符串 | 待 i18n 国际化 |
| 6 | 📋 | Correlation cross-market 硬编码 | 6 个标的写死，不灵活 |

---

_创建于 2026-02-17 | 最后更新：2026-02-17 (0dc650d toolbar) | 每次修改 index.html 后必须同步更新_
