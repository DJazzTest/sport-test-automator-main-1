#!/bin/bash

# Set environment variables for email
export SMTP_USER="davidjarrett001@gmail.com"
export SMTP_PASSWORD="xbzndaxkfnpoxnuo"
export RECIPIENTS="david.jarrett@planetsport.com"

# Get current UK time
UK_TIME=$(TZ='Europe/London' date '+%H:%M')
echo "🕐 Current UK Time: $UK_TIME"

# Function to run a single test and send detailed email
run_single_test() {
    local test_name="$1"
    local test_file="$2"
    local sport="$3"
    
    echo "🏃 Running $test_name..."
    
    # Run test and capture output
    OUTPUT=$(timeout 300 npx playwright test "$test_file" --project=chromium --timeout=300000 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 124 ]; then
        echo "⏰ Test timed out after 5 minutes"
        return 1
    fi
    
    # Extract results from output
    local total_events=$(echo "$OUTPUT" | grep -o "Total.*Events Tested: [0-9]*" | grep -o "[0-9]*" | tail -1)
    local passed_events=$(echo "$OUTPUT" | grep -o "Events with Animations.*: [0-9]*" | grep -o "[0-9]*" | tail -1)
    local failed_events=$(echo "$OUTPUT" | grep -o "Events without Animations.*: [0-9]*" | grep -o "[0-9]*" | tail -1)
    
    # Extract detailed pass/fail lists
    local passed_list=$(echo "$OUTPUT" | sed -n '/✅ PASSED EVENTS/,/❌ FAILED EVENTS/p' | grep "✅" | sed 's/✅//g' | sed 's/^[[:space:]]*//' | head -10)
    local failed_list=$(echo "$OUTPUT" | sed -n '/❌ FAILED EVENTS/,/🧪/p' | grep "❌" | sed 's/❌//g' | sed 's/^[[:space:]]*//' | head -10)
    
    # Calculate success rate
    local success_rate=0
    if [ ! -z "$total_events" ] && [ "$total_events" -gt 0 ]; then
        success_rate=$(( (passed_events * 100) / total_events ))
    fi
    
    # Create detailed email body
    local email_body="## 🏆 $test_name - $sport

**Status:** $(if [ $exit_code -eq 0 ]; then echo "✅ PASSED"; else echo "❌ FAILED"; fi)
**Total Events Tested:** $total_events
**Events with Animations:** $passed_events ✅
**Events without Animations:** $failed_events ❌
**Success Rate:** $success_rate%

### ✅ PASSED EVENTS:"
    
    if [ ! -z "$passed_list" ]; then
        echo "$passed_list" | while IFS= read -r line; do
            if [ ! -z "$line" ]; then
                email_body="$email_body
- ✅ $line"
            fi
        done
    else
        email_body="$email_body
- No passed events found"
    fi
    
    email_body="$email_body

### ❌ FAILED EVENTS:"
    
    if [ ! -z "$failed_list" ]; then
        echo "$failed_list" | while IFS= read -r line; do
            if [ ! -z "$line" ]; then
                email_body="$email_body
- ❌ $line"
            fi
        done
    else
        email_body="$email_body
- No failed events found"
    fi
    
    email_body="$email_body

**Test Time:** $(TZ='Europe/London' date '+%Y-%m-%d %H:%M UK Time')
**Execution:** Headless mode for speed"
    
    # Send email
    echo "$email_body" | python3 scripts/send_email.py --html "$test_name - $sport Test Results" "$(cat)"
    
    echo "📧 $test_name report sent to $RECIPIENTS"
    return $exit_code
}

# Run individual tests
echo "🚀 Starting individual sports testing..."

run_single_test "PSG Football" "tests/specs/planetsports/PSG.Football.Animations.spec.ts" "Football"
run_single_test "PSG NFL" "tests/specs/planetsports/PSG.NFL.Animations.spec.ts" "American Football"
run_single_test "PSG Cricket" "tests/specs/planetsports/PSG.cricket.Animations.spec.ts" "Cricket"
run_single_test "PSG Tennis" "tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts" "Tennis"
run_single_test "StarSports NFL" "tests/specs/starsports/starsports.nfl.animation.spec.ts" "American Football"
run_single_test "StarSports Football" "tests/specs/starsports/starsports.football.animation.spec.ts" "Football"
run_single_test "StarSports Cricket" "tests/specs/starsports/starsports.cricket.animation.spec.ts" "Cricket"
run_single_test "StarSports Tennis" "tests/specs/starsports/starsports.tennis.animation.spec.ts" "Tennis"
run_single_test "Vodacom" "tests/specs/vodacom/VodaCS.test.spec.ts" "Site Health Check"
run_single_test "PlanetF1" "tests/specs/planetf1/Planetf1.webpages.spec.ts" "F1 Website"

echo "✅ All individual test reports sent!"









