#!/usr/bin/env bash
# check-docs.sh — Detect README ↔ code drift
# Run manually or via pre-commit hook / CI
# Exit 0 = all good, Exit 1 = drift detected

set -euo pipefail
cd "$(dirname "$0")/.."

ERRORS=0
WARNINGS=0

red()    { printf "\033[31m✘ %s\033[0m\n" "$1"; }
yellow() { printf "\033[33m⚠ %s\033[0m\n" "$1"; }
green()  { printf "\033[32m✔ %s\033[0m\n" "$1"; }

# ── 1. Tool count: code vs README ──────────────────────────────
CODE_TOOLS=$(grep -r 'server\.tool(' src/tools/*.ts 2>/dev/null | wc -l | tr -d ' ')
README_TOOL_BADGE=$(grep -o 'tools-[0-9]*' README.md 2>/dev/null | head -1 | sed 's/tools-//' || echo 0)
README_TOOL_HEADER=$(grep -o '[0-9]* Tools' README.md 2>/dev/null | head -1 | sed 's/ Tools//' || echo 0)

if [ "$CODE_TOOLS" != "$README_TOOL_BADGE" ]; then
  red "Tool count badge: README says $README_TOOL_BADGE, code has $CODE_TOOLS"
  ERRORS=$((ERRORS + 1))
else
  green "Tool count badge matches: $CODE_TOOLS"
fi

if [ -n "$README_TOOL_HEADER" ] && [ "$CODE_TOOLS" != "$README_TOOL_HEADER" ]; then
  red "Tool count header: README says '$README_TOOL_HEADER Tools', code has $CODE_TOOLS"
  ERRORS=$((ERRORS + 1))
fi

# Check that every registered tool name appears in README
MISSING_TOOLS=0
for TOOL_NAME in $(grep -o '"gainlab_[a-z_]*"' src/tools/*.ts | sed 's/.*"//;s/"//' | sort -u); do
  if ! grep -q "$TOOL_NAME" README.md; then
    red "Tool '$TOOL_NAME' registered in code but missing from README"
    ERRORS=$((ERRORS + 1))
    MISSING_TOOLS=$((MISSING_TOOLS + 1))
  fi
done
if [ $MISSING_TOOLS -eq 0 ]; then
  green "All registered tools mentioned in README"
fi

# ── 2. Test count: actual vs README ────────────────────────────
TEST_OUTPUT=$(npm test 2>&1) || true  # test failures shouldn't crash check-docs
ACTUAL_TESTS=$(echo "$TEST_OUTPUT" | grep '# tests' | sed 's/.*tests //' || echo "")
if [ -z "$ACTUAL_TESTS" ]; then
  # node --test format: "ℹ tests 216"
  ACTUAL_TESTS=$(echo "$TEST_OUTPUT" | grep 'tests ' | tail -1 | sed 's/.*tests //' | tr -d ' ' || echo "")
fi

README_TESTS_BADGE=$(grep -o 'tests-[0-9]*' README.md 2>/dev/null | head -1 | sed 's/tests-//' || echo 0)
README_TESTS_TEXT=$(grep -o '[0-9]* tests' README.md 2>/dev/null | head -1 | sed 's/ tests//' || echo 0)

if [ -z "$ACTUAL_TESTS" ]; then
  yellow "Could not determine actual test count"
  WARNINGS=$((WARNINGS + 1))
elif [ "$ACTUAL_TESTS" != "$README_TESTS_BADGE" ]; then
  red "Test count badge: README says $README_TESTS_BADGE, actual is $ACTUAL_TESTS"
  ERRORS=$((ERRORS + 1))
else
  green "Test count badge matches: $ACTUAL_TESTS"
fi

if [ -n "$ACTUAL_TESTS" ] && [ "$README_TESTS_TEXT" != "0" ] && [ "$ACTUAL_TESTS" != "$README_TESTS_TEXT" ]; then
  red "Test count in text: README says $README_TESTS_TEXT, actual is $ACTUAL_TESTS"
  ERRORS=$((ERRORS + 1))
fi

# ── 3. Suite count ─────────────────────────────────────────────
ACTUAL_SUITES=$(echo "$TEST_OUTPUT" | grep 'suites ' | tail -1 | sed 's/.*suites //' | tr -d ' ' || echo "")
README_SUITES=$(grep -o '[0-9]* suites' README.md 2>/dev/null | head -1 | sed 's/ suites//' || echo 0)

if [ -n "$ACTUAL_SUITES" ] && [ "$README_SUITES" != "0" ] && [ "$ACTUAL_SUITES" != "$README_SUITES" ]; then
  yellow "Suite count: README says $README_SUITES, actual is $ACTUAL_SUITES"
  WARNINGS=$((WARNINGS + 1))
fi

# ── 4. Source files vs Project Structure ───────────────────────
MISSING_FILES=0
for SRC_FILE in $(find src/ -name "*.ts" -not -path "*/node_modules/*" | sed 's|src/||' | sort); do
  BASENAME=$(basename "$SRC_FILE" .ts)
  # Skip generic files
  if [ "$BASENAME" = "index" ] || [ "$BASENAME" = "types" ]; then continue; fi
  if ! grep -q "$BASENAME" README.md; then
    yellow "Source file 'src/$SRC_FILE' not mentioned in README project structure"
    WARNINGS=$((WARNINGS + 1))
    MISSING_FILES=$((MISSING_FILES + 1))
  fi
done
if [ $MISSING_FILES -eq 0 ]; then
  green "All source files reflected in README structure"
fi

# ── 5. Indicators list ────────────────────────────────────────
# Parse comma-separated indicator names, trimming whitespace but preserving multi-word names
CODE_INDICATORS=$(head -5 src/utils/ta.ts | grep 'Includes:' | sed 's/.*Includes: //' | tr ',' '\n' | sed 's/^ *//;s/ *$//' || echo "")
if [ -n "$CODE_INDICATORS" ]; then
  MISSING_IND=0
  while IFS= read -r IND; do
    [ -z "$IND" ] && continue
    if ! grep -qi "$IND" README.md; then
      yellow "Indicator '$IND' in ta.ts header but not in README"
      WARNINGS=$((WARNINGS + 1))
      MISSING_IND=$((MISSING_IND + 1))
    fi
  done <<< "$CODE_INDICATORS"
  if [ $MISSING_IND -eq 0 ]; then
    green "All indicators mentioned in README"
  fi
fi

# ── 6. Architecture tool count ─────────────────────────────────
ARCH_TOOLS=$(grep -o '([0-9]* tools)' README.md | head -1 | sed 's/[^0-9]//g' || echo "")
if [ -n "$ARCH_TOOLS" ] && [ "$ARCH_TOOLS" != "$CODE_TOOLS" ]; then
  red "Architecture diagram says ($ARCH_TOOLS tools), code has $CODE_TOOLS"
  ERRORS=$((ERRORS + 1))
else
  green "Architecture diagram tool count consistent"
fi

# ── Summary ────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
PKG_NAME=$(node -p "require('./package.json').name")
echo "Package: $PKG_NAME"
if [ $ERRORS -gt 0 ]; then
  red "FAIL: $ERRORS error(s), $WARNINGS warning(s)"
  echo "README is out of sync with code. Update before committing."
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  yellow "PASS with $WARNINGS warning(s)"
  exit 0
else
  green "ALL CLEAR — README matches code"
  exit 0
fi
