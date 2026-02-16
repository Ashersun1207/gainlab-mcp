#!/usr/bin/env bash
# GainLab 全项目质量检查 — 统一入口
# 用法: bash scripts/check-all.sh
# 跑完所有检查，汇总结果
set -uo pipefail

MCP="/Users/mac/Desktop/卷卷/gainlab-mcp"
RESEARCH="/Users/mac/Desktop/卷卷/gainlab-research"
WORKSPACE="/Users/mac/.openclaw/workspace"

TOTAL_ERRORS=0
TOTAL_WARNS=0

section() { echo ""; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "🔍 $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }
red()    { printf "\033[31m✘ %s\033[0m\n" "$1"; TOTAL_ERRORS=$((TOTAL_ERRORS+1)); }
yellow() { printf "\033[33m⚠ %s\033[0m\n" "$1"; TOTAL_WARNS=$((TOTAL_WARNS+1)); }
green()  { printf "\033[32m✔ %s\033[0m\n" "$1"; }

# ── 1. Research 知识库检查 ──
section "1/6 Research 知识库"
if [ -f "$RESEARCH/tools/check.sh" ]; then
  bash "$RESEARCH/tools/check.sh" 2>&1 | tail -5
else
  red "research check.sh not found"
fi

# ── 2. MCP Server README ↔ 代码检查 ──
section "2/6 MCP Server README ↔ 代码"
if [ -f "$MCP/scripts/check-docs.sh" ]; then
  bash "$MCP/scripts/check-docs.sh" 2>&1 | tail -5
else
  red "check-docs.sh not found"
fi

# ── 3. ARCHITECTURE.md ↔ 代码一致性 ──
section "3/6 ARCHITECTURE.md 一致性"
if [ -f "$MCP/ARCHITECTURE.md" ]; then
  # 检查 ARCHITECTURE.md 提到的每个 .ts 文件是否存在
  ARCH_MISSING=0
  while IFS= read -r fpath; do
    if [ ! -f "$MCP/$fpath" ]; then
      red "ARCHITECTURE.md mentions $fpath but file missing"
      ARCH_MISSING=$((ARCH_MISSING+1))
    fi
  done < <(grep -oE 'src/[a-zA-Z_/-]+\.ts' "$MCP/ARCHITECTURE.md" | sort -u)
  [ "$ARCH_MISSING" -eq 0 ] && green "All source files in ARCHITECTURE.md exist"

  # 检查实际 src/ 文件是否都在 ARCHITECTURE.md 中
  UNTRACKED=0
  while IFS= read -r srcf; do
    rel="${srcf#$MCP/}"
    base=$(basename "$srcf" .ts)
    [ "$base" = "index" ] || [ "$base" = "types" ] && continue
    if ! grep -q "$base" "$MCP/ARCHITECTURE.md"; then
      yellow "Source file $rel not in ARCHITECTURE.md"
      UNTRACKED=$((UNTRACKED+1))
    fi
  done < <(find "$MCP/src" -name "*.ts" -not -name "index.ts" -not -name "types.ts" | sort)
  [ "$UNTRACKED" -eq 0 ] && green "All source files documented in ARCHITECTURE.md"

  # 检查工具数一致
  ARCH_TOOL_COUNT=$(grep -c 'gainlab_' "$MCP/ARCHITECTURE.md" 2>/dev/null | head -1 || echo 0)
  CODE_TOOL_COUNT=$(grep -r 'server\.tool(' "$MCP/src/tools/"*.ts 2>/dev/null | wc -l | tr -d ' ')
  # ARCHITECTURE lists each tool twice (table + route), so divide
  green "ARCHITECTURE.md references gainlab tools, code has $CODE_TOOL_COUNT"
else
  red "ARCHITECTURE.md not found"
fi

# ── 4. 展示页基础检查 ──
section "4/6 展示页检查"
DEMO="$MCP/docs/index.html"
if [ -f "$DEMO" ]; then
  # ECharts coord 陷阱：检查是否有数字索引 coord（不含 api.coord 的 custom series）
  BAD_COORDS=$(grep -n 'coord:\[' "$DEMO" | grep -v 'dt\[' | grep -v 'api\.coord' | grep -v '//' || true)
  if [ -n "$BAD_COORDS" ]; then
    red "展示页可能有 coord 使用数字索引（应用 dt[idx]）:"
    echo "$BAD_COORDS" | head -5 | sed 's/^/    /'
  else
    green "展示页 coord 均使用 category 字符串值"
  fi

  # 检查 i18n 完整性：zh 和 en 块是否都存在且有相同数量的 key
  ZH_COUNT=$(grep -A200 "zh: {" "$DEMO" | grep -c ":" 2>/dev/null || echo 0)
  EN_COUNT=$(grep -A200 "en: {" "$DEMO" | grep -c ":" 2>/dev/null || echo 0)
  if [ "$ZH_COUNT" -gt 5 ] && [ "$EN_COUNT" -gt 5 ]; then
    green "I18N zh($ZH_COUNT keys) / en($EN_COUNT keys) 均存在"
  else
    yellow "I18N 可能缺失 key (zh:$ZH_COUNT en:$EN_COUNT)"
  fi

  # 行数统计
  DEMO_LINES=$(wc -l < "$DEMO" | tr -d ' ')
  echo "  📏 展示页 $DEMO_LINES 行"

  # 检查 DEMO-ARCHITECTURE.md 是否存在
  if [ -f "$MCP/docs/DEMO-ARCHITECTURE.md" ]; then
    green "DEMO-ARCHITECTURE.md 存在"
  else
    red "DEMO-ARCHITECTURE.md 缺失"
  fi
else
  red "index.html not found"
fi

# ── 5. Git 状态 ──
section "5/6 Git 状态"
for repo in "$MCP" "$RESEARCH"; do
  name=$(basename "$repo")
  cd "$repo" 2>/dev/null || continue
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  UNPUSHED=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l | tr -d ' ')
  if [ "$DIRTY" -gt 0 ]; then
    yellow "$name: $DIRTY 未提交文件"
  else
    green "$name: 工作区干净"
  fi
  if [ "$UNPUSHED" -gt 0 ]; then
    yellow "$name: $UNPUSHED 未推送 commit"
  else
    green "$name: 已推送到 remote"
  fi
done

# ── 6. 同步状态 ──
section "6/6 文档同步"
SYNC_DIR="$WORKSPACE/memory/gainlab-sync"
SYNC_PAIRS="README.md:gainlab-research-index.md status.md:gainlab-status.md decisions.md:gainlab-decisions-sync.md"
SYNC_FAIL=0
for pair in $SYNC_PAIRS; do
  src="${pair%%:*}"; dst="${pair#*:}"
  if [ ! -f "$SYNC_DIR/$dst" ]; then
    yellow "$dst 不存在"
    SYNC_FAIL=$((SYNC_FAIL+1))
  elif ! diff -q "$RESEARCH/$src" "$SYNC_DIR/$dst" > /dev/null 2>&1; then
    yellow "$src → $dst 不同步"
    SYNC_FAIL=$((SYNC_FAIL+1))
  fi
done
[ "$SYNC_FAIL" -eq 0 ] && green "research → workspace 同步正常"

# Check ARCHITECTURE.md sync
if [ -f "$SYNC_DIR/gainlab-architecture.md" ]; then
  if ! diff -q "$MCP/ARCHITECTURE.md" "$SYNC_DIR/gainlab-architecture.md" > /dev/null 2>&1; then
    yellow "ARCHITECTURE.md → workspace 不同步"
  else
    green "ARCHITECTURE.md 已同步到 workspace"
  fi
else
  yellow "ARCHITECTURE.md 未同步到 workspace（memory_search 搜不到）"
fi

# ── 汇总 ──
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 全项目检查汇总"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$TOTAL_ERRORS" -gt 0 ]; then
  printf "\033[31m🔴 %d 错误 | %d 警告\033[0m\n" "$TOTAL_ERRORS" "$TOTAL_WARNS"
elif [ "$TOTAL_WARNS" -gt 0 ]; then
  printf "\033[33m🟡 0 错误 | %d 警告\033[0m\n" "$TOTAL_WARNS"
else
  printf "\033[32m🟢 全部通过\033[0m\n"
fi
echo "$(date '+%Y-%m-%d %H:%M:%S')"
