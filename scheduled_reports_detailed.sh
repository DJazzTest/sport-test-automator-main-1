#!/bin/bash

# Set environment variables for email
export SMTP_USER="davidjarrett001@gmail.com"
export SMTP_PASSWORD="xbzndaxkfnpoxnuo"
export RECIPIENTS="davidjarrett001@gmail.com"

# Get current UK time
UK_TIME=$(TZ='Europe/London' date '+%H:%M')
echo "🕐 Current UK Time: $UK_TIME"

# Function to run test and capture detailed results
run_test_detailed() {
    local test_name="$1"
    local test_file="$2"
    local sport="$3"
    
    echo "🏃 Running $test_name..."
    
    # Run test and capture output
    OUTPUT=$(npx playwright test "$test_file" --project=chromium --timeout=300000 2>&1)
    local exit_code=$?
    
    # Extract results from output
    local total_events=$(echo "$OUTPUT" | grep -o "Total.*Events Tested: [0-9]*" | grep -o "[0-9]*" | tail -1)
    local passed_events=$(echo "$OUTPUT" | grep -o "Events with Animations.*: [0-9]*" | grep -o "[0-9]*" | tail -1)
    local failed_events=$(echo "$OUTPUT" | grep -o "Events without Animations.*: [0-9]*" | grep -o "[0-9]*" | tail -1)
    
    # Extract detailed pass/fail lists
    local passed_list=$(echo "$OUTPUT" | sed -n '/✅ PASSED EVENTS/,/❌ FAILED EVENTS/p' | grep "✅" | sed 's/✅//g' | sed 's/^[[:space:]]*//' | head -20)
    local failed_list=$(echo "$OUTPUT" | sed -n '/❌ FAILED EVENTS/,/🧪/p' | grep "❌" | sed 's/❌//g' | sed 's/^[[:space:]]*//' | head -20)
    
    # Calculate success rate
    local success_rate=0
    if [ ! -z "$total_events" ] && [ "$total_events" -gt 0 ]; then
        success_rate=$(( (passed_events * 100) / total_events ))
    fi
    
    # Create detailed report
    echo "## 🏆 $test_name - $sport" >> detailed_results.md
    echo "" >> detailed_results.md
    echo "**Status:** $(if [ $exit_code -eq 0 ]; then echo "✅ PASSED"; else echo "❌ FAILED"; fi)" >> detailed_results.md
    echo "**Total Events Tested:** $total_events" >> detailed_results.md
    echo "**Events with Animations:** $passed_events ✅" >> detailed_results.md
    echo "**Events without Animations:** $failed_events ❌" >> detailed_results.md
    echo "**Success Rate:** $success_rate%" >> detailed_results.md
    echo "" >> detailed_results.md
    
    if [ ! -z "$passed_list" ]; then
        echo "### ✅ PASSED EVENTS:" >> detailed_results.md
        echo "$passed_list" | while IFS= read -r line; do
            if [ ! -z "$line" ]; then
                echo "- ✅ $line" >> detailed_results.md
            fi
        done
        echo "" >> detailed_results.md
    fi
    
    if [ ! -z "$failed_list" ]; then
        echo "### ❌ FAILED EVENTS:" >> detailed_results.md
        echo "$failed_list" | while IFS= read -r line; do
            if [ ! -z "$line" ]; then
                echo "- ❌ $line" >> detailed_results.md
            fi
        done
        echo "" >> detailed_results.md
    fi
    
    echo "---" >> detailed_results.md
    echo "" >> detailed_results.md
    
    return $exit_code
}

# Create results file
echo "# 🏆 COMPREHENSIVE SPORTS TEST RESULTS - $(TZ='Europe/London' date '+%Y-%m-%d %H:%M UK Time')" > detailed_results.md
echo "" >> detailed_results.md
echo "## 📊 EXECUTIVE SUMMARY" >> detailed_results.md
echo "" >> detailed_results.md

# Run all tests
echo "🚀 Starting comprehensive sports testing..."

# PSG Tests
run_test_detailed "PSG Football" "tests/specs/planetsports/PSG.Football.Animations.spec.ts" "Football"
run_test_detailed "PSG NFL" "tests/specs/planetsports/PSG.NFL.Animations.spec.ts" "American Football"
run_test_detailed "PSG Cricket" "tests/specs/planetsports/PSG.cricket.Animations.spec.ts" "Cricket"
run_test_detailed "PSG Tennis" "tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts" "Tennis"

# StarSports Tests
run_test_detailed "StarSports NFL" "tests/specs/starsports/starsports.nfl.animation.spec.ts" "American Football"
run_test_detailed "StarSports Football" "tests/specs/starsports/starsports.football.animation.spec.ts" "Football"
run_test_detailed "StarSports Cricket" "tests/specs/starsports/starsports.cricket.animation.spec.ts" "Cricket"
run_test_detailed "StarSports Tennis" "tests/specs/starsports/starsports.tennis.animation.spec.ts" "Tennis"

# Other Tests
run_test_detailed "Vodacom" "tests/specs/vodacom/VodaCS.comprehensive.spec.ts" "Site Health Check"
run_test_detailed "PlanetF1" "tests/specs/planetf1/Planetf1.webpages.spec.ts" "F1 Website"

echo "✅ All tests completed. Sending detailed email report..."

# Send comprehensive email
python3 scripts/send_email.py --html "Comprehensive Sports Test Results - $(TZ='Europe/London' date '+%Y-%m-%d %H:%M UK Time')" "$(cat detailed_results.md)"

echo "📧 Detailed email report sent to $RECIPIENTS"

