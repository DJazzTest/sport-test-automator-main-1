#!/bin/bash
set -euo pipefail

ROOT="/Users/davidjarrett/Documents/sport-test-automator-main-1"
cd "$ROOT"

# Array of test names and their corresponding spec files
declare -A tests=(
    ["PSG.Football"]="tests/specs/planetsports/PSG.Football.Animations.spec.ts"
    ["PSG.NFL"]="tests/specs/planetsports/PSG.NFL.Animations.spec.ts"
    ["PSG.Cricket"]="tests/specs/planetsports/PSG.cricket.Animations.spec.ts"
    ["PSG.Tennis"]="tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts"
    ["Starsports.NFL"]="tests/specs/starsports/starsports.nfl.animation.spec.ts"
    ["starsports.Football"]="tests/specs/starsports/starsports.football.animation.spec.ts"
    ["Starsports.Cricket"]="tests/specs/starsports/starsports.cricket.animation.spec.ts"
    ["starsports.Tennis"]="tests/specs/starsports/starsports.tennis.animation.spec.ts"
    ["Vodacom"]="tests/specs/vodacom/VodaCS.quick.spec.ts"
    ["planetf1"]="tests/specs/planetf1/Planetf1.webpages.spec.ts"
)

# Run each test and send email
for test_name in "${!tests[@]}"; do
    spec_file="${tests[$test_name]}"
    echo "🚀 Starting $test_name test..."
    
    # Run the test using the existing email script
    if [[ -f "$spec_file" ]]; then
        ./scripts/run_requested_email.sh "$test_name" "$spec_file"
        echo "✅ $test_name test completed successfully"
    else
        echo "❌ Error: Test file not found: $spec_file"
    fi
    
    echo "--------------------------------------------------"
done

echo "🎉 All tests completed! Check your email for reports."
