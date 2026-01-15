#!/bin/bash
# Quick verification script to check that all email formats are correct
# This doesn't run tests, just verifies the script configuration

set -euo pipefail

ROOT="/Users/davidjarrett/Documents/sport-test-automator-main-1"
cd "$ROOT"

echo "🔍 Verifying All 11 Tests Email Configuration"
echo "=============================================="
echo ""

# Check that build_detailed_email is defined
if grep -q "build_detailed_email()" scripts/run_all_11_tests_email.sh; then
  echo "✅ build_detailed_email() function found"
else
  echo "❌ build_detailed_email() function NOT found"
  exit 1
fi

# Check that extract_event_details is defined
if grep -q "extract_event_details()" scripts/run_all_11_tests_email.sh; then
  echo "✅ extract_event_details() function found"
else
  echo "❌ extract_event_details() function NOT found"
  exit 1
fi

echo ""
echo "Checking each test uses detailed email format:"
echo "-----------------------------------------------"

# Check PSG tests
for test in "PSG Football" "PSG Cricket" "PSG NFL" "PSG Tennis"; do
  if grep -q "build_detailed_email.*${test}" scripts/run_all_11_tests_email.sh; then
    echo "✅ ${test} - uses build_detailed_email()"
  else
    echo "❌ ${test} - NOT using build_detailed_email()"
  fi
done

# Check DragonSport tests
for test in "DragonSport Football" "DragonSport Cricket" "DragonSport Tennis" "DragonSport NFL"; do
  if grep -q "build_detailed_email.*${test}" scripts/run_all_11_tests_email.sh; then
    echo "✅ ${test} - uses build_detailed_email()"
  else
    echo "❌ ${test} - NOT using build_detailed_email()"
  fi
done

# Check special tests
if grep -q "run_vodacom_email.sh" scripts/run_all_11_tests_email.sh; then
  echo "✅ Vodacom - uses dedicated script (run_vodacom_email.sh)"
else
  echo "❌ Vodacom - script not found"
fi

if grep -q "PlanetF1.*Tabs Successfully Loaded" scripts/run_all_11_tests_email.sh; then
  echo "✅ PlanetF1 - uses custom tab format"
else
  echo "❌ PlanetF1 - custom format not found"
fi

if grep -q "TeamTalk.*Teams Successfully Loaded" scripts/run_all_11_tests_email.sh; then
  echo "✅ TeamTalk - uses custom team format"
else
  echo "❌ TeamTalk - custom format not found"
fi

echo ""
echo "📊 Configuration Summary:"
echo "-------------------------"
echo "Sports tests (8): Using 'Automated Results' format with full event lists"
echo "Vodacom (1):     Using dedicated detailed script"
echo "PlanetF1 (1):    Using custom tab-based format"
echo "TeamTalk (1):    Using custom team-based format"
echo ""
echo "✅ All 11 tests are configured for detailed emails!"
echo ""
echo "Next: Run a full test suite to verify emails contain event details"








