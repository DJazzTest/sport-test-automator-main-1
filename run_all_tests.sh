#!/bin/bash

# Set environment variables for email
export SMTP_USER="davidjarrett001@gmail.com"
export SMTP_PASSWORD="xbzndaxkfnpoxnuo"
export RECIPIENTS="david.jarrett@planetsport.com"

# Create results file
RESULTS_FILE="test_results_$(date +%Y%m%d_%H%M%S).txt"
echo "=== COMPREHENSIVE TEST RESULTS - $(date) ===" > $RESULTS_FILE

# Function to run test and capture results
run_test() {
    local test_name="$1"
    local test_file="$2"
    echo "" >> $RESULTS_FILE
    echo "=== $test_name ===" >> $RESULTS_FILE
    echo "Running: $test_file"
    
    # Run test and capture output
    npx playwright test "$test_file" --project=chromium --timeout=300000 >> $RESULTS_FILE 2>&1
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        echo "✅ $test_name - PASSED" >> $RESULTS_FILE
    else
        echo "❌ $test_name - FAILED" >> $RESULTS_FILE
    fi
    
    echo "Exit code: $exit_code" >> $RESULTS_FILE
    echo "---" >> $RESULTS_FILE
}

# Run all tests
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

# Send comprehensive email
python3 scripts/send_email.py --subject "Comprehensive Test Results - $(date +%Y-%m-%d)" --recipient "david.jarrett@planetsport.com" --body "$(cat $RESULTS_FILE)"




