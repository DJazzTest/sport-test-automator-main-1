#!/bin/bash

echo "=========================================="
echo "COMPREHENSIVE TEST EXECUTION REPORT"
echo "=========================================="
echo "Started: $(date)"
echo ""

# Test files to run
TESTS=(
  "tests/e2e/dragonbet/inplay-automation.spec.ts"
  "tests/e2e/akbets/inplay-automation.spec.ts"
  "tests/e2e/gentlemanjim/inplay-automation.spec.ts"
  "tests/e2e/pricedup/inplay-automation.spec.ts"
  "tests/e2e/nrg/inplay-automation.spec.ts"
  "tests/e2e/vodacom/inplay-automation.spec.ts"
  "tests/e2e/planetf1/inplay-automation.spec.ts"
  "tests/e2e/starsports/inplay-automation.spec.ts"
  "tests/e2e/teamtalk/TeamtalkWeb.spec.ts"
  "tests/e2e/planetsportgroup/animation-widget.spec.ts"
  "tests/e2e/planetsportgroup/automation.spec.ts"
  "tests/e2e/planetsportgroup/cricket.spec.ts"
  "tests/e2e/planetsportgroup/football.spec.ts"
  "tests/e2e/planetsportgroup/tennis.spec.ts"
  "tests/e2e/common/navigation.spec.ts"
)

TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()
PASSED_TESTS=()

for test_file in "${TESTS[@]}"; do
  TOTAL=$((TOTAL + 1))
  test_name=$(basename "$test_file" .spec.ts)
  echo "Running: $test_file"
  
  OUTPUT=$(npx playwright test "$test_file" --reporter=list --project=chromium 2>&1)
  EXIT_CODE=$?
  
  if [ $EXIT_CODE -eq 0 ]; then
    PASSED=$((PASSED + 1))
    PASSED_TESTS+=("$test_name")
    echo "✅ PASSED"
  else
    FAILED=$((FAILED + 1))
    FAILED_TESTS+=("$test_name")
    echo "❌ FAILED"
  fi
  echo "---"
done

echo ""
echo "=========================================="
echo "FINAL TEST REPORT"
echo "=========================================="
echo "Total Tests: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""
echo "✅ PASSED TESTS:"
for test in "${PASSED_TESTS[@]}"; do
  echo "  - $test"
done
echo ""
echo "❌ FAILED TESTS:"
for test in "${FAILED_TESTS[@]}"; do
  echo "  - $test"
done
echo ""
echo "Completed: $(date)"
