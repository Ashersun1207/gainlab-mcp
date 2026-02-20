#!/bin/bash
# Worker 质量验证脚本
# 用法: cd gainlab-mcp/worker && bash verify.sh
set -e
cd "$(dirname "$0")"

FAIL=0

echo "=== V1: TypeScript check ==="
if npx tsc --noEmit 2>&1 | head -20 | grep -q "error TS"; then
  echo "  ❌ tsc --noEmit has type errors"
  npx tsc --noEmit 2>&1 | head -10
  FAIL=1
else
  echo "  ✅ tsc passed"
fi

echo "=== V2: Contract check ==="
if [ -f "../scripts/check-contract.sh" ]; then
  cd .. && bash scripts/check-contract.sh && cd worker
else
  echo "  ⚠️  check-contract.sh not found, skipping"
fi

echo "=== V3: No duplicate logic ==="
# handleKline 函数体内不应直接调用外部 API（应委托给 fetchKlineData）
# macOS 兼容：用 awk + sed 代替 head -n -1
KLINE_BODY=$(awk '/^async function handleKline/,/^async function handleQuote/' src/index.ts 2>/dev/null | sed '$ d')
if [ -n "$KLINE_BODY" ] && echo "$KLINE_BODY" | grep -q "api.bybit.com\|financialmodelingprep.com\|eodhd.com"; then
  echo "  ❌ handleKline contains direct API calls (should delegate to fetchKlineData)"
  FAIL=1
else
  echo "  ✅ No duplicate logic"
fi

echo "=== V4: Endpoint smoke test ==="
BASE="https://gainlab-api.asher-sun.workers.dev"
EP_FAIL=0
for ep in "/api/kline?symbol=BTCUSDT&market=crypto" "/api/quote?symbol=BTCUSDT&market=crypto" "/api/search?q=BTC&market=crypto" "/api/fundamentals?symbol=AAPL&market=us" "/api/screener?market=crypto"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE$ep" 2>/dev/null)
  if [ "$status" = "200" ]; then
    echo "  ✅ $ep → $status"
  else
    echo "  ❌ $ep → $status"
    EP_FAIL=1
  fi
done
if [ "$EP_FAIL" = "1" ]; then
  echo "  ⚠️  Some endpoints failed (Worker 可能需要重新部署，不阻塞本地检查)"
fi

echo ""
if [ "$FAIL" = "1" ]; then
  echo "❌ Worker verify FAILED"
  exit 1
fi
echo "✅ All Worker checks passed"
