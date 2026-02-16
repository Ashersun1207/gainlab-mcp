#!/usr/bin/env bash
# GainLab 项目认知恢复 — 新会话启动时执行
# 输出项目状态摘要，让 AI 快速恢复全部上下文
# 用法: bash scripts/project-boot.sh
set -uo pipefail

MCP="/Users/mac/Desktop/卷卷/gainlab-mcp"
RESEARCH="/Users/mac/Desktop/卷卷/gainlab-research"

echo "🦞 GainLab Project Boot"
echo "========================"
echo ""

# ── 进度快照 ──
echo "📊 进度"
TOOLS=$(grep -r 'server\.tool(' "$MCP/src/tools/"*.ts 2>/dev/null | wc -l | tr -d ' ')
TESTS=$(cd "$MCP" && npm test 2>&1 | grep 'tests ' | tail -1 | sed 's/.*tests //' | tr -d ' ' 2>/dev/null || echo "?")
PASS=$(cd "$MCP" && npm test 2>&1 | grep 'pass ' | tail -1 | sed 's/.*pass //' | tr -d ' ' 2>/dev/null || echo "?")
FAIL=$(cd "$MCP" && npm test 2>&1 | grep 'fail ' | tail -1 | sed 's/.*fail //' | tr -d ' ' 2>/dev/null || echo "?")
DEMO_LINES=$(wc -l < "$MCP/docs/index.html" 2>/dev/null | tr -d ' ' || echo "?")
echo "  Tools: $TOOLS | Tests: $TESTS (pass:$PASS fail:$FAIL) | Demo: ${DEMO_LINES} lines"
echo ""

# ── Git 最近改动 ──
echo "📝 最近 5 次 commit (gainlab-mcp)"
cd "$MCP" && git log --oneline -5 2>/dev/null | sed 's/^/  /'
echo ""
echo "📝 最近 3 次 commit (gainlab-research)"
cd "$RESEARCH" && git log --oneline -3 2>/dev/null | sed 's/^/  /'
echo ""

# ── 文档新鲜度 ──
echo "⏰ 文档新鲜度"
for f in "$RESEARCH/status.md" "$RESEARCH/docs/RULES.md" "$MCP/ARCHITECTURE.md" "$MCP/docs/DEMO-ARCHITECTURE.md" "$RESEARCH/lessons.md"; do
  if [ -f "$f" ]; then
    name=$(basename "$f")
    days=$(( ($(date +%s) - $(stat -f %m "$f")) / 86400 ))
    if [ "$days" -gt 14 ]; then
      printf "  ⚠️ %-30s %d天前\n" "$name" "$days"
    else
      printf "  ✅ %-30s %d天前\n" "$name" "$days"
    fi
  fi
done
echo ""

# ── 未提交/未推送 ──
echo "📦 Git 状态"
for repo in "$MCP" "$RESEARCH"; do
  name=$(basename "$repo")
  cd "$repo" 2>/dev/null || continue
  dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  unpushed=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l | tr -d ' ')
  echo "  $name: ${dirty} dirty, ${unpushed} unpushed"
done
echo ""

# ── 必读文件清单 ──
echo "📖 必读文件（按顺序）"
echo "  1. RULES.md        → $RESEARCH/docs/RULES.md"
echo "  2. status.md       → $RESEARCH/status.md"
echo "  3. ARCHITECTURE.md → $MCP/ARCHITECTURE.md"
echo "  4. DEMO-ARCH.md    → $MCP/docs/DEMO-ARCHITECTURE.md  (改展示页时)"
echo "  5. lessons.md      → $RESEARCH/lessons.md"
echo "  6. decisions.md    → $RESEARCH/decisions.md           (查决策时)"
echo ""
echo "========================"
echo "Boot complete. $(date '+%Y-%m-%d %H:%M:%S')"
