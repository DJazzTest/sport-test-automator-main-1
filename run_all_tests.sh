#!/bin/bash

# Single-run, headless, comprehensive test run with a final HTML email report.

# Email configuration (can be overridden via environment or .env)
export SMTP_USER="${SMTP_USER:-davidjarrett001@gmail.com}"
export SMTP_PASSWORD="${SMTP_PASSWORD:-xbzndaxkfnpoxnuo}"
export RECIPIENTS="${RECIPIENTS:-davidjarrett001@gmail.com}"

# Create results file
RESULTS_FILE="test_results_$(date +%Y%m%d_%H%M%S).txt"
echo "=== COMPREHENSIVE TEST RESULTS - $(date) ===" > "$RESULTS_FILE"

# Function to run test and capture results
run_test() {
    local test_name="$1"
    local test_file="$2"
    echo "" >> "$RESULTS_FILE"
    echo "=== $test_name ===" >> "$RESULTS_FILE"
    echo "Running: $test_file"
    
    # Run test and capture output (headless chromium via project)
    npx playwright test "$test_file" --project=chromium --timeout=300000 >> "$RESULTS_FILE" 2>&1
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo "✅ $test_name - PASSED" >> "$RESULTS_FILE"
    else
        echo "❌ $test_name - FAILED" >> "$RESULTS_FILE"
    fi
    
    echo "Exit code: $exit_code" >> "$RESULTS_FILE"
    echo "---" >> "$RESULTS_FILE"
}

# Run all tests sequentially
echo "Starting comprehensive test run..."

run_test "PSG Football" "tests/specs/planetsports/PSG.Football.Animations.spec.ts"
run_test "PSG NFL" "tests/specs/planetsports/PSG.NFL.Animations.spec.ts"
run_test "PSG Cricket" "tests/specs/planetsports/PSG.cricket.Animations.spec.ts"
run_test "PSG Tennis" "tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts"
run_test "StarSports NFL" "tests/specs/starsports/starsports.nfl.animation.spec.ts"
run_test "StarSports Football" "tests/specs/starsports/starsports.football.animation.spec.ts"
run_test "StarSports Cricket" "tests/specs/starsports/starsports.cricket.animation.spec.ts"
run_test "StarSports Tennis" "tests/specs/starsports/starsports.tennis.animation.spec.ts"
run_test "Vodacom" "tests/specs/vodacom/VodaCS.comprehensive.spec.ts"
run_test "PlanetF1" "tests/specs/planetf1/Planetf1.webpages.spec.ts"

echo "All tests completed. Results saved to: $RESULTS_FILE"

# Send comprehensive email as HTML using the shared send_email.py helper
SUBJECT="Comprehensive Test Results - $(date +%Y-%m-%d)"
# Escape minimal HTML characters so the text file can be embedded safely
HTML_BODY="<div style=\"font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif\"><h2>${SUBJECT}</h2><pre style=\"white-space:pre-wrap;font-family:monospace\">$(sed 's/&/\\&amp;/g; s/</\\&lt;/g; s/>/\\&gt;/g' \"$RESULTS_FILE\")</pre></div>"
SMTP_USER="$SMTP_USER" SMTP_PASSWORD="$SMTP_PASSWORD" RECIPIENTS="$RECIPIENTS" python3 scripts/send_email.py --html "$SUBJECT" "$HTML_BODY"


















