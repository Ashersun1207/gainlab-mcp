# 展示页变更日志

_每次修改 index.html 后追加记录。新条目在最上面。_

---

## cf241f1 — check-all.sh i18n 检测改进
- i18n key 检查从 grep subtitle 改为统计 zh/en block key 数量
- 消除误报

## 3e69ce1 — 文档交叉修复
- ARCHITECTURE.md 补 scripts/ 子目录（check-all.sh + project-boot.sh）
- DEMO-ARCHITECTURE.md 补文件列表（CHANGELOG.md）
- status.md 进度同步（多市场 + Overlay 跨市场 → ✅）

## cac03c9 — check-all.sh ARCHITECTURE 文件检测 pattern 修复
- grep `[a-z]` → `[a-zA-Z_]`，正确匹配大写文件名

## b28de00 — 项目知识系统 v2
- 新增 check-all.sh（6 节全量质量检查）
- 新增 project-boot.sh（新会话认知恢复）
- 新增 DEMO-ARCHITECTURE.md（展示页结构文档）
- 新增 CHANGELOG.md（本文件）
- ARCHITECTURE.md 补全 render/charts/ 子目录（10 个文件）

## cf089ce — Overlay 跨市场 + WRB coord 修复 + VP y轴同步
- Overlay: 单市场选择器 → 6 个跨市场资产选择器（BTC/AAPL/Gold 默认）
- WRB: markPoint coord 从数字索引改为 category 字符串 `dt[idx]`
- WRB: 活跃 Gap markArea 终点延伸到图表右端
- VP: 右侧 yAxis 从 category 改为 value，与 K 线共享 min/max

## 206856b — 变量遮蔽修复 + VP叠加 + K线显示名
- 修复 `t` 变量遮蔽 i18n `t()` 函数 → 改名 `tf`
- VP 用 custom series 横向柱替代旧的 bar series
- K 线标题显示标的名称（非 symbol code）

## 385c10b — i18n 中英文 + WRB 标签 + VP 叠加模式
- 新增 I18N 系统：zh/en 两套文案，右上角切换按钮
- WRB: 看涨/看跌标签跟随语言切换
- VP: 初步叠加模式（K线 + VP 同面板）

## 467ad03 — 统一标的选择器
- 所有 tab 的 symbol select 改由 `initSelects()` 统一初始化
- 修复 overlay 的 `ov-s` 不存在 → 改为 `ov-1`/`ov-2`

## 9791920 — 市场选择器 + WRB 标记 + 中文字体
- 每个 tab 新增绿色市场选择器（.mkt-sel）
- WRB markPoint 格式修正 `coord:[xIdx, yVal]`
- 新增 Noto Sans SC 中文字体

## 7e2405d — 多市场支持 + sample-data.js
- 新增 sample-data.js（55KB，EODHD 预拉取 10 标的）
- 支持 Crypto/US Stock/A-Share/Gold-Silver/Index 五个市场
- Correlation 新增 Cross-Market 模式

## 47e4bff — Phase 2.5c: WRB tab + DCF/Estimates
- 新增 WRB Scoring tab（WRB/HG 检测 + Pro 信号菱形标记）
- Fundamentals 三模式：Standard / DCF Gauge / Analyst Estimates
- 统计数字 6→7 tools, 216→275 tests

## cfef2a9 — Heatmap + Correlation tabs
- 新增 Heatmap tab（Binance 24hr treemap，120+ token 分类）
- 新增 Correlation tab（N×N Pearson 热力图）

## a7dc43c — Volume Profile + VWAP/ATR
- 新增 VP tab（POC/VAH/VAL + 横向柱状图）
- Indicators 新增 VWAP 和 ATR 选项

## c78fd8b — Phase 2: 多指标 + 叠加 + 基本面
- 新增 Indicators tab（MA/RSI/MACD/Bollinger 多面板）
- 新增 Overlay tab（2 资产标准化%对比）
- 新增 Fundamentals tab（营收对比柱状图）

## bed6d24 — 初始版本
- K 线图（Binance 实时）
- 单 tab，单市场（crypto only）

---

_每次改展示页后追加一条，格式：commit hash — 标题 + 改动列表_
