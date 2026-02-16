# GainLab 展示页架构文档

_修改展示页前必读。每次改完同步更新此文档。_

---

## 文件结构

```
docs/
├── index.html             — 单文件展示页（HTML + CSS + JS，~753行）
├── sample-data.js         — 非加密市场预拉取数据（EODHD，~55KB）
├── DEMO-ARCHITECTURE.md   — 本文件（展示页结构文档）
└── CHANGELOG.md           — 展示页变更日志（14 次 commit 历史）
```

## 数据流

| 市场 | 数据源 | 方式 | 延迟 |
|---|---|---|---|
| Crypto (USDT对) | Binance REST API | 实时 fetch | ~200ms |
| US Stock / A-Share / Commodity / Index | sample-data.js (SD对象) | 预加载静态 | 0 |

**判断逻辑**：`fdata()` 函数 — symbol 以 `USDT` 结尾 → Binance API，否则 → SD[symbol]

## 8个 Tab 及其控件

| Tab ID | 面板 | 市场选择器 | 标的选择器 | 其他控件 | 渲染函数 |
|---|---|---|---|---|---|
| kline | p-kline | kl-m (mkt-sel) | kl-s | kl-t(周期), kl-l(数量) | `lkl()` |
| vp | p-vp | vp-m (mkt-sel) | vp-s | vp-t, vp-l, vp-r(行数) | `lvp()` |
| indicators | p-indicators | in-m (mkt-sel) | in-s | in-i(多选指标) | `lind()` |
| overlay | p-overlay | ❌ 全市场合并 | ov-1~ov-6 (跨市场) | ov-d(天数) | `lov()` |
| fundamentals | p-fundamentals | ❌ 无市场选择 | fn-s(仅DCF/Est) | fn-m(模式切换) | `lfun()` → `lfunStd/DCF/Est()` |
| wrb | p-wrb | wrb-m (mkt-sel) | wrb-s | wrb-t, wrb-l | `lwrb()` |
| heatmap | p-heatmap | hm-m(仅crypto) | ❌ | hm-l(数量), hm-v(成交量过滤) | `lhm()` |
| corr | p-corr | cr-m(crypto/cross) | cr-a1~a4 | cr-d(天数) | `lcr()` |

## 市场 → 标的映射

```js
MKT_SYMS = {
  crypto:    [BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT],
  us_stock:  [AAPL, MSFT, NVDA, TSLA],
  a_stock:   [600519(茅台), 000001(平安)],
  commodity: [XAUUSD, XAGUSD],
  index:     [SPY, QQQ]
}
```

## 关键函数

| 函数 | 作用 | 注意事项 |
|---|---|---|
| `fdata(sym,tf,lim)` | 统一数据获取 | USDT→Binance，否则→SD |
| `umkt(prefix)` | 切换市场时更新标的下拉 | overlay 特殊：更新 ov-1/ov-2 而非 ov-s |
| `umktCorr()` | 相关性市场切换 | crypto/cross 两套标的列表 |
| `calcVP(klines,rows,vaP)` | 计算 Volume Profile | 返回 {rows, poc, vah, val} |
| `detectWRB(klines,lb,sens)` | WRB/HG 检测 | 返回 {wrb[], gaps[], bars[]} |
| `ic(id)` | 获取/初始化 ECharts 实例 | 缓存在 ch{} |
| `sw(name,el)` | Tab 切换 | 首次切换自动加载 |
| `setLang(lang)` | 中英文切换 | 更新 data-i18n 元素 + 市场选择器 |

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
| overlay | 1 | 两条归一化%曲线 |
| wrb | 2 | K线+WRB标记+Gap区域(54%) + 成交量(14%) |
| corr | 1 | N×N 热力图 |
| heatmap | 1 | Treemap |
| fundamentals | 1 | Bar/Gauge/Bar（三种模式） |

## 已知问题 & 待修

### ✅ [已修 cf089ce] WRB markPoint/markArea 坐标

- markPoint.coord 改为 `[dt[x.idx], price]`（类别字符串）
- 活跃 Gap markArea 终点改为 `dt[dt.length-1]`（延伸到最右）
- Pro signal 数据格式改为 `{value:[dt[idx],price]}`

### ✅ [已修 cf089ce] VP K线与 VP 柱对齐

- 右侧 VP yAxis 从 `category` 改为 `value` 类型
- 使用 `custom` series + `renderItem` 画横向柱
- 两个 grid 共享相同的 `min/max` 价格范围

### ✅ [已修 cf089ce] Overlay 跨市场多资产

- 砍掉单市场选择器，改为 6 个全市场合并下拉（ov-1~ov-6）
- 默认 BTC / AAPL / Gold，slot 3-6 有空选项
- 支持 2-6 资产同图对比，自动归一化 % change

### Correlation Cross-Market 硬编码（待优化）

**问题**：cross 模式 6 个标的写死，不灵活
**可优化**：参考 Overlay 思路，也用全市场合并列表

## I18N

- `I18N` 对象包含 zh/en 两套文案
- `t(key)` 函数取当前语言文案
- `data-i18n` 属性的元素由 `setLang()` 批量更新
- 市场选择器文案由 `updateMarketSelectors()` 更新
- **新增文案必须 zh/en 都加**

## 样式变量

```css
--up: #00d4aa (绿/涨)    --dn: #ff4757 (红/跌)
--acc: #5b8ff9 (蓝)      --gold: #ffc233 (金)
--purp: #7c4dff (紫)     --bg: #08081a (深底)
--card: #12122b          --bdr: #1e1e3d
--txt: #e8e8f0           --dim: #8888aa
```

---

_创建于 2026-02-17 | 最后更新：2026-02-17 (cf089ce) | 每次修改 index.html 后必须同步更新_
