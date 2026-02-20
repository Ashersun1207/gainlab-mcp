#!/bin/bash
# 前后端 API 契约一致性检查
# 用法: cd gainlab-mcp && bash scripts/check-contract.sh
set -e
cd "$(dirname "$0")/.."

WORKER_TYPES="worker/src/types.ts"
APP_TYPES="../gainlab-app/src/types/mcp.ts"
APP_MARKET="../gainlab-app/src/types/market.ts"
FAIL=0

# ── Check 1: Worker types.ts 存在 ──
if [ ! -f "$WORKER_TYPES" ]; then
  echo "  ❌ $WORKER_TYPES not found (T3 未完成)"
  exit 1
fi

# ── Check 2: SSE event types ──
echo "=== Check 1: SSE Event Types ==="
worker_events=$(grep "type:" "$WORKER_TYPES" | grep -oE "'[a-z_]+'" | sort -u)
app_events=$(grep "type.*:" "$APP_TYPES" | grep -oE "'[a-z_]+'" | sort -u)

if [ "$worker_events" = "$app_events" ]; then
  echo "  ✅ SSE event types match"
else
  echo "  ❌ SSE event types mismatch!"
  diff <(echo "$worker_events") <(echo "$app_events") || true
  FAIL=1
fi

# ── Check 3: Worker MarketType 是前端 MarketType 的子集 ──
echo "=== Check 2: MarketType subset ==="
worker_markets=$(grep "WorkerMarketType" "$WORKER_TYPES" | grep -oE "'[a-z]+'" | sort -u)
app_markets=$(grep "export type MarketType" "$APP_MARKET" | grep -oE "'[a-z]+'" | sort -u)

if [ -z "$worker_markets" ]; then
  echo "  ⚠️  WorkerMarketType not found in $WORKER_TYPES"
else
  missing=""
  for m in $worker_markets; do
    if ! echo "$app_markets" | grep -q "$m"; then
      missing="$missing $m"
    fi
  done
  if [ -z "$missing" ]; then
    echo "  ✅ Worker markets are subset of frontend"
  else
    echo "  ❌ Worker has markets not in frontend:$missing"
    FAIL=1
  fi
fi

if [ "$FAIL" = "1" ]; then
  echo ""
  echo "❌ Contract check FAILED"
  exit 1
fi
echo ""
echo "✅ All contract checks passed"
