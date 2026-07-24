#!/usr/bin/env bash
# Run all e2e regression tests for coding-harness-viz
# Each test suite runs with its own BFF mock fixture
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WEB_DIR="$SCRIPT_DIR/../apps/web"
BFF_DIR="$SCRIPT_DIR/../apps/bff"

FIXTURES_DIR="$BFF_DIR/test/fixtures"
BFF_PORT="${BFF_PORT:-3300}"
WEB_PORT="${WEB_PORT:-5173}"

echo "=== coding-harness-viz e2e regression ==="
echo "BFF_PORT=$BFF_PORT WEB_PORT=$WEB_PORT"

run_suite() {
  local fixture_name="$1"
  local spec_file="$2"
  local fixture_path="$FIXTURES_DIR/$fixture_name"

  echo ""
  echo "--- Running $spec_file with fixture $fixture_name ---"

  export MOCK_FIXTURE_PATH="$fixture_path"
  export BFF_PORT
  export WEB_PORT

  cd "$WEB_DIR"
  npx playwright test "$spec_file" --config=playwright.config.ts 2>&1
  local rc=$?

  if [ $rc -ne 0 ]; then
    echo "FAIL: $spec_file (exit $rc)"
    return $rc
  fi
  echo "PASS: $spec_file"
}

FAILED=0

run_suite "ac-01-issue-created.json" "e2e/ac-01.spec.ts" || FAILED=$((FAILED + 1))
run_suite "ac-05-pr-merged.json" "e2e/ac-05.spec.ts" || FAILED=$((FAILED + 1))
run_suite "ac-06-deployed.json" "e2e/ac-06.spec.ts" || FAILED=$((FAILED + 1))

echo ""
echo "=== Regression complete: $FAILED failure(s) ==="
exit $FAILED
