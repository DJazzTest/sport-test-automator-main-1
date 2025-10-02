#!/bin/bash
set -euo pipefail

ROOT="/Users/davidjarrett/Documents/sport-test-automator-main-1"
cd "$ROOT"

# Load .env if present
if [ -f .env ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(SMTP_USER|SMTP_PASSWORD|RECIPIENTS)=' .env | xargs)
fi

export SMTP_USER="${SMTP_USER:-davidjarrett001@gmail.com}"
export SMTP_PASSWORD="${SMTP_PASSWORD:-xbzndaxkfnpoxnuo}"
export RECIPIENTS="${RECIPIENTS:-davidjarrett001@gmail.com}"

run_psg_football(){
  local OUT="/tmp/psg_fb_sched.out"
  npx playwright test tests/specs/planetsports/PSG.Football.Animations.spec.ts --project=chromium | tee "$OUT"
  # Extract totals
  local TODAY TOM ALL TOTAL PASSED FAILED STATUS NOTES PASSRATE
  TODAY=$(grep -A50 "=== FOOTBALL (Today) RESULTS ===" "$OUT" | grep -m1 "Total Football Events Tested" | sed -E 's/.*Tested: ([0-9]+).*/\1/' || echo 0)
  TOM=$(grep -A50 "=== FOOTBALL (Tomorrow) RESULTS ===" "$OUT" | grep -m1 "Total Football Events Tested" | sed -E 's/.*Tested: ([0-9]+).*/\1/' || echo 0)
  ALL=$(grep -A50 "=== FOOTBALL (All) RESULTS ===" "$OUT" | grep -m1 "Total Football Events Tested" | sed -E 's/.*Tested: ([0-9]+).*/\1/' || echo 0)
  TOTAL=$(( (TODAY+0) + (TOM+0) + (ALL+0) ))
  PASSED=$(grep -E "^✅ Events with Animations \(PASS\):" "$OUT" | awk '{s+=$NF} END{print s+0}')
  FAILED=$(grep -E "^❌ Events without Animations \(FAIL\):" "$OUT" | awk '{s+=$NF} END{print s+0}')
  if [ "${TOTAL:-0}" -gt 0 ]; then PASSRATE=$(( PASSED * 100 / TOTAL )); else PASSRATE=0; fi
  if [ "${FAILED:-0}" -eq 0 ] && [ "${TOTAL:-0}" -gt 0 ]; then STATUS="✅ PASSED"; NOTES="All events have animations"; else STATUS="⚠️ PARTIAL PASS"; NOTES="${FAILED:-0} failed"; fi

  # Build details block
  local DETAILS
  DETAILS=$(awk '/^📋 === DETAILED RESULTS \(Today\) ===/{tab="Today";flag=1;next} /^📋 === DETAILED RESULTS \(Tomorrow\) ===/{tab="Tomorrow";flag=1;next} /^📋 === DETAILED RESULTS \(All\) ===/{tab="All";flag=1;next} /^🧪 === FOOTBALL \(/{flag=0} flag && /^(PASS:|FAIL:)/{gsub(/^PASS: /,"✅ PASS: "); gsub(/^FAIL: /,"❌ FAIL: "); print}' "$OUT" | sed 's/$/<br>/')

  local SUMMARY_TABLE EMAIL_SUBJECT EMAIL_BODY
  SUMMARY_TABLE="<table border=\"1\" style=\"border-collapse:collapse;width:100%\"><tr><th style=\"text-align:left;padding:6px\">Test Suite</th><th style=\"text-align:left;padding:6px\">Status</th><th style=\"text-align:left;padding:6px\">Events Tested</th><th style=\"text-align:left;padding:6px\">Pass Rate</th><th style=\"text-align:left;padding:6px\">Notes</th></tr><tr><td style=\"padding:6px\">PSG.Football.Animations.spec</td><td style=\"padding:6px\">$STATUS</td><td style=\"padding:6px\">$TOTAL</td><td style=\"padding:6px\">${PASSRATE}%</td><td style=\"padding:6px\">$NOTES</td></tr></table>"
  EMAIL_SUBJECT="🏆 PSG FOOTBALL Scheduled Test Report - $(date '+%Y-%m-%d %H:%M')"
  EMAIL_BODY="<h2>📊 Final Summary</h2>${SUMMARY_TABLE}<h3>📋 Event Details</h3><div style=\"font-family:monospace\">${DETAILS}</div>"
  python3 scripts/send_email.py --html "$EMAIL_SUBJECT" "$EMAIL_BODY"
}

run_psg_cricket(){
  local OUT="/tmp/psg_cricket_sched.out"
  npx playwright test tests/specs/planetsports/PSG.cricket.Animations.spec.ts --project=chromium-slow | tee "$OUT"
  local TOTAL PASSED FAILED STATUS NOTES PASSRATE DETAILS
  TOTAL=$(grep -m1 "^📊 Total Cricket Events Tested:" "$OUT" | awk '{print $6+0}')
  PASSED=$(grep -m1 "^✅ Events with Animations (PASS):" "$OUT" | awk '{print $7+0}')
  FAILED=$(grep -m1 "^❌ Events without Animations (FAIL):" "$OUT" | awk '{print $7+0}')
  [ -z "$TOTAL" ] && TOTAL=0; [ -z "$PASSED" ] && PASSED=0; [ -z "$FAILED" ] && FAILED=0
  if [ "$TOTAL" -gt 0 ]; then PASSRATE=$(( PASSED * 100 / TOTAL )); else PASSRATE=0; fi
  if [ "$FAILED" -eq 0 ] && [ "$TOTAL" -gt 0 ]; then STATUS="✅ PASSED"; NOTES="All events have animations"; else STATUS="⚠️ PARTIAL PASS"; NOTES="$FAILED failed"; fi
  DETAILS=$(awk '/^📋 === DETAILED RESULTS /{flag=1;next}/^🏁|^🧪/{if(flag){exit}}flag && /^(PASS:|FAIL:)/{gsub(/^PASS: /,"✅ PASS: "); gsub(/^FAIL: /,"❌ FAIL: "); print}' "$OUT" | sed 's/$/<br>/')
  local SUMMARY_TABLE EMAIL_SUBJECT EMAIL_BODY
  SUMMARY_TABLE="<table border=\"1\" style=\"border-collapse:collapse;width:100%\"><tr><th style=\"text-align:left;padding:6px\">Test Suite</th><th style=\"text-align:left;padding:6px\">Status</th><th style=\"text-align:left;padding:6px\">Events Tested</th><th style=\"text-align:left;padding:6px\">Pass Rate</th><th style=\"text-align:left;padding:6px\">Notes</th></tr><tr><td style=\"padding:6px\">PSG.cricket.Animations.spec</td><td style=\"padding:6px\">$STATUS</td><td style=\"padding:6px\">$TOTAL</td><td style=\"padding:6px\">${PASSRATE}%</td><td style=\"padding:6px\">$NOTES</td></tr></table>"
  EMAIL_SUBJECT="🏏 PSG CRICKET Scheduled Test Report - $(date '+%Y-%m-%d %H:%M')"
  EMAIL_BODY="<h2>📊 Final Summary</h2>${SUMMARY_TABLE}<h3>📋 Event Details</h3><div style=\"font-family:monospace\">${DETAILS}</div>"
  python3 scripts/send_email.py --html "$EMAIL_SUBJECT" "$EMAIL_BODY"
}

run_psg_tennis(){
  local OUT="/tmp/psg_tennis_sched.out"
  npx playwright test tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts --project=chromium-slow | tee "$OUT"
  local TOTAL PASSED FAILED STATUS NOTES PASSRATE DETAILS
  TOTAL=$(grep -m1 "^📊 Total Tennis Events Tested:" "$OUT" | awk '{print $6+0}')
  PASSED=$(grep -m1 "^✅ Events with Animations (PASS):" "$OUT" | awk '{print $7+0}')
  FAILED=$(grep -m1 "^❌ Events without Animations (FAIL):" "$OUT" | awk '{print $7+0}')
  [ -z "$TOTAL" ] && TOTAL=0; [ -z "$PASSED" ] && PASSED=0; [ -z "$FAILED" ] && FAILED=0
  if [ "$TOTAL" -gt 0 ]; then PASSRATE=$(( PASSED * 100 / TOTAL )); else PASSRATE=0; fi
  if [ "$FAILED" -eq 0 ] && [ "$TOTAL" -gt 0 ]; then STATUS="✅ PASSED"; NOTES="All events have animations"; else STATUS="⚠️ PARTIAL PASS"; NOTES="$FAILED failed"; fi
  DETAILS=$(awk '/^📋 === DETAILED RESULTS /{flag=1;next}/^🏁|^🧪/{if(flag){exit}}flag && /^(PASS:|FAIL:)/{gsub(/^PASS: /,"✅ PASS: "); gsub(/^FAIL: /,"❌ FAIL: "); print}' "$OUT" | sed 's/$/<br>/')
  local SUMMARY_TABLE EMAIL_SUBJECT EMAIL_BODY
  SUMMARY_TABLE="<table border=\"1\" style=\"border-collapse:collapse;width:100%\"><tr><th style=\"text-align:left;padding:6px\">Test Suite</th><th style=\"text-align:left;padding:6px\">Status</th><th style=\"text-align:left;padding:6px\">Events Tested</th><th style=\"text-align:left;padding:6px\">Pass Rate</th><th style=\"text-align:left;padding:6px\">Notes</th></tr><tr><td style=\"padding:6px\">PSG.Tennis.Animations.Spec</td><td style=\"padding:6px\">$STATUS</td><td style=\"padding:6px\">$TOTAL</td><td style=\"padding:6px\">${PASSRATE}%</td><td style=\"padding:6px\">$NOTES</td></tr></table>"
  EMAIL_SUBJECT="🎾 PSG TENNIS Scheduled Test Report - $(date '+%Y-%m-%d %H:%M')"
  EMAIL_BODY="<h2>📊 Final Summary</h2>${SUMMARY_TABLE}<h3>📋 Event Details</h3><div style=\"font-family:monospace\">${DETAILS}</div>"
  python3 scripts/send_email.py --html "$EMAIL_SUBJECT" "$EMAIL_BODY"
}

run_psg_nfl(){
  local OUT="/tmp/psg_nfl_sched.out"
  npx playwright test tests/specs/planetsports/PSG.NFL.Animations.spec.ts --project=chromium-slow | tee "$OUT"
  # Aggregate totals
  local TOTAL PASSED FAILED STATUS NOTES PASSRATE
  TOTAL=$(grep -m1 "^📊 Total Events Tested:" "$OUT" | awk '{print $5+0}')
  PASSED=$(grep -m1 "^✅ PASS: " "$OUT" | awk '{print $5+0}')
  FAILED=$(grep -m1 "^❌ FAIL: " "$OUT" | awk '{print $5+0}')
  [ -z "$TOTAL" ] && TOTAL=0; [ -z "$PASSED" ] && PASSED=0; [ -z "$FAILED" ] && FAILED=0
  if [ "$TOTAL" -gt 0 ]; then PASSRATE=$(( PASSED * 100 / TOTAL )); else PASSRATE=0; fi
  if [ "$FAILED" -eq 0 ] && [ "$TOTAL" -gt 0 ]; then STATUS="✅ PASSED"; NOTES="All events have animations"; else STATUS="⚠️ PARTIAL PASS"; NOTES="$FAILED failed"; fi

  # Build details list
  local DETAILS
  DETAILS=$(awk '/^🔍 Testing: /{title=$0;next} /^✅ PASS: Live tracker animation found —/{sub(/^✅ PASS: Live tracker animation found — /,"✅ PASS: "); print title "\n" $0; next} /^❌ FAIL: No live tracker animation —/{sub(/^❌ FAIL: No live tracker animation — /,"❌ FAIL: "); print title "\n" $0; next}' "$OUT" | sed 's/$/<br>/')

  local SUMMARY_TABLE EMAIL_SUBJECT EMAIL_BODY
  SUMMARY_TABLE="<table border=\"1\" style=\"border-collapse:collapse;width:100%\"><tr><th style=\"text-align:left;padding:6px\">Test Suite</th><th style=\"text-align:left;padding:6px\">Status</th><th style=\"text-align:left;padding:6px\">Events Tested</th><th style=\"text-align:left;padding:6px\">Pass Rate</th><th style=\"text-align:left;padding:6px\">Notes</th></tr><tr><td style=\"padding:6px\">PSG.NFL.Animations.spec</td><td style=\"padding:6px\">$STATUS</td><td style=\"padding:6px\">$TOTAL</td><td style=\"padding:6px\">${PASSRATE}%</td><td style=\"padding:6px\">$NOTES</td></tr></table>"
  EMAIL_SUBJECT="🏈 PSG NFL Scheduled Test Report - $(date '+%Y-%m-%d %H:%M')"
  EMAIL_BODY="<h2>📊 Final Summary</h2>${SUMMARY_TABLE}<h3>📋 Event Details</h3><div style=\"font-family:monospace\">${DETAILS}</div>"
  python3 scripts/send_email.py --html "$EMAIL_SUBJECT" "$EMAIL_BODY"
}

run_planetf1(){
  local OUT="/tmp/pf1_sched.out"
  npx playwright test tests/specs/planetf1/Planetf1.webpages.spec.ts --project=chromium-slow | tee "$OUT"
  local SUMMARY_BLOCK
  SUMMARY_BLOCK=$(awk 'BEGIN{tab=""} /^🔍 Tab: /{tab=$0; next} /^⏱️/{print tab "\n" $0; next} /^🔗 Broken links \(sample\):/{flag=1; next} flag && /^  - \[[0-9]+\]/{ sub(/^  - /, "❌ "); print; next } /^$/ {flag=0}' "$OUT" | sed 's/$/<br>/')
  python3 scripts/send_email.py --html "PlanetF1 Headed Results — With Broken Links" "<strong>Summary</strong><br>${SUMMARY_BLOCK}"
}

run_vodacom(){
  local OUT="/tmp/vodacom_sched.out"
  npx playwright test tests/specs/vodacom/VodaCS.test.spec.ts --project=chromium | tee "$OUT"
  local RESULTS_BLOCK SUMMARY
  RESULTS_BLOCK=$(awk '/^🎯 Testing event /{title=$0; next} /^✅ PASS: match animation detected/{print "✅ PASS: " title; next} /^❌ FAIL: no match animation detected/{print "❌ FAIL: " title; next}' "$OUT" | sed 's/$/<br>/')
  SUMMARY=$(awk '/^🧪 === VODACOM SOCCER – MATCH CENTRE ANIMATION RESULTS ===/{flag=1;next}flag{print}' "$OUT" | sed 's/$/<br>/')
  python3 scripts/send_email.py --html "Vodacom Match Centre Findings" "<strong>✅ === DETAILED RESULTS (Vodacom) ===</strong><br>${RESULTS_BLOCK}<br><strong>Summary</strong><br>${SUMMARY}"
}

main(){
  run_psg_football
  run_psg_cricket
  run_psg_tennis
  run_psg_nfl
  run_planetf1
  run_vodacom
}

main "$@"


