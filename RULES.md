# GainLab MCP — 开发规则

_任何改动前必读。详细通用规则见 gainlab-research/docs/RULES.md。_

---

## 通用规则

遵循 `gainlab-research/docs/RULES.md` 的所有条款。本文件补充 MCP Server + Worker 专属规则。

## MCP Server 规则

1. **开工前跑 `bash scripts/project-boot.sh`**（认知恢复）
2. **改完跑 `bash scripts/check-all.sh`**（全项目质量检查）
3. **展示页改动必须读 `docs/DEMO-ARCHITECTURE.md`**
4. **新 MCP 工具必须走完全流程**：PRD → TASK → 实现 → 测试 → 文档同步 → 提交

## Worker 专属规则（`worker/` 目录）

1. **改 Worker 前跑 `cd worker && npx tsc --noEmit`**
2. **改完必须跑 `bash worker/verify.sh`**（V1 类型检查 + V2 契约检查 + V3 重复检查 + V4 冒烟测试）
3. **不复制粘贴数据获取逻辑**：新端点复用 `fetchKlineData` / `fetchHeatmapData` / `fetchFundamentals` 等共享函数
4. **TOOL_REGISTRY 是唯一真相源**：加新 tool 只改 TOOL_REGISTRY + 对应的 fetch 函数
5. **加新 tool 必须同步更新 `buildSystemPrompt` 末尾的优先级列表**
6. **改 SSE 事件格式必须同步检查 `gainlab-app/src/services/mcpClient.ts`**
7. **部署用 Cloudflare REST API**（不用 wrangler，代理环境下不稳定）
8. **类型定义在 `worker/src/types.ts`**（Wire Format 契约，前端必须兼容）

## 前后端契约

Worker 发送的 SSE 事件是 **Wire Format**，前端 `mcpClient.ts` 负责映射为内部类型。

| Wire 字段 | 前端内部字段 | 说明 |
|---|---|---|
| `{ type: 'error', message: '...' }` | `{ type: 'error', error: '...' }` | error 事件的文本字段 |
| `{ tool: { arguments: {} } }` | `{ toolCall: { args: {} } }` | tool_call 事件的参数 |

改任何一方都必须检查另一方！跑 `bash scripts/check-contract.sh` 验证。

## 文档关联

| 文档 | 位置 | 什么时候读 |
|---|---|---|
| 通用规则 | `gainlab-research/docs/RULES.md` | 任何改动前 |
| Worker 架构 | `worker/ARCHITECTURE.md` | 改 Worker 前 |
| MCP 架构 | `ARCHITECTURE.md` | 改 MCP Server 前 |
| 决策记录 | `gainlab-research/decisions.md` | 做重大决策时 |
| 教训 | `gainlab-research/lessons.md` | 踩坑后 |
| 展示页结构 | `docs/DEMO-ARCHITECTURE.md` | 改展示页前 |

---

_v1.0 | 2026-02-20_
