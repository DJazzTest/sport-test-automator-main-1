#!/bin/bash
set -euo pipefail

ROOT="/Users/davidjarrett/Documents/sport-test-automator-main-1"
cd "$ROOT"

# SMTP config (allow override via env or .env)
if [ -f .env ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(SMTP_USER|SMTP_PASSWORD|RECIPIENTS)=' .env | xargs)
fi
export SMTP_USER="${SMTP_USER:-davidjarrett001@gmail.com}"
export SMTP_PASSWORD="${SMTP_PASSWORD:-xbzndaxkfnpoxnuo}"
export RECIPIENTS="${RECIPIENTS:-davidjarrett001@gmail.com}"

run_suite(){
  local display_name="$1"     # e.g. PSG Football
  local spec="$2"             # path to spec
  local project="${3:-chromium}"
  local max_events_env="${4:-}"

  local out_file
  out_file="/tmp/$(echo "$display_name" | tr ' ' '_' | tr -cd '[:alnum:]_').out"

  echo "🏃 Running ${display_name}..."
  if [ -n "$max_events_env" ]; then
    MAX_EVENTS="$max_events_env" npx playwright test "$spec" --project="$project" | tee "$out_file" || true
  else
    npx playwright test "$spec" --project="$project" | tee "$out_file" || true
  fi

  # Extract totals (generic across suites)
  local total pass fail
  pass=$(grep -E "^✅ Events with Animations \(PASS\):|^✅ Total Passed:" "$out_file" | awk '{print $NF}' | awk '{s+=$1} END{print s+0}')
  fail=$(grep -E "^❌ Events without Animations \(FAIL\):|^❌ Total Failed:" "$out_file" | awk '{print $NF}' | awk '{s+=$1} END{print s+0}')
  total=$(grep -E "^📊 Total (Football |Cricket |Tennis |Events |events )?Events Tested:|^📊 Total events checked:" "$out_file" | awk '{print $NF}' | awk '{s+=$1} END{print s+0}')
  if [ "${total:-0}" -eq 0 ] && [ -n "$pass" ] && [ -n "$fail" ]; then total=$(( (pass+0) + (fail+0) )); fi

  # Build numbered details for passes and fails
  local passed_list failed_list
  passed_list=$(awk '/^✅ PASSED EVENTS \([0-9]+\):/{flag=1;next} flag && /^[0-9]+\./{print;next} flag && /^$/{flag=0}' "$out_file" | sed 's/^\([0-9]\+\.\)\s*/\1 ✅ /')
  failed_list=$(awk '/^❌ FAILED EVENTS \([0-9]+\):/{flag=1;next} flag && /^[0-9]+\./{print;next} flag && /^$/{flag=0}' "$out_file" | sed 's/^\([0-9]\+\.\)\s*/\1 ❌ /')

  # Fallback to line-per PASS/FAIL entries (e.g., StarSports)
  if [ -z "$passed_list" ]; then
    passed_list=$(awk '/^✅ PASS: /{print}' "$out_file" | nl -w1 -s'. ' | sed 's/^\([0-9]\+\.\) /\1 ✅ /')
  fi
  if [ -z "$failed_list" ]; then
    failed_list=$(awk '/^❌ FAIL: /{print}' "$out_file" | nl -w1 -s'. ' | sed 's/^\([0-9]\+\.\) /\1 ❌ /')
  fi

  # Compose HTML body
  local uk_time subject body
  uk_time=$(TZ='Europe/London' date '+%d %B %Y %H:%M:%S UK Time')
  subject="${display_name} - Animation Check Report"
  body="<div style=\"font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif\">"
  body+="<h2>${display_name} – Automated Results</h2>"
  body+="<p><strong>Run Time:</strong> ${uk_time}</p>"
  body+="<p><strong>Total:</strong> ${total} | <strong>Pass:</strong> ${pass} | <strong>Fail:</strong> ${fail} | <strong>Success:</strong> $(( total>0 ? (pass*100/total) : 0 ))%</p>"
  if [ -n "$passed_list" ]; then
    body+="<h3>✅ PASSED EVENTS</h3><pre style=\"white-space:pre-wrap\">${passed_list}</pre>"
  fi
  if [ -n "$failed_list" ]; then
    body+="<h3>❌ FAILED EVENTS</h3><pre style=\"white-space:pre-wrap\">${failed_list}</pre>"
  fi
  body+="<p style=\"color:#666\">Spec: <code>${spec}</code></p>"
  body+="</div>"

  python3 scripts/send_email.py --html "$subject" "$body"
}

main(){
  # PSG
  run_suite "PSG Football" "tests/specs/planetsports/PSG.Football.Animations.spec.ts" "chromium" "10"
  run_suite "PSG NFL" "tests/specs/planetsports/PSG.NFL.Animations.spec.ts" "chromium-slow"
  run_suite "PSG Cricket" "tests/specs/planetsports/PSG.cricket.Animations.spec.ts" "chromium-slow"
  run_suite "PSG Tennis" "tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts" "chromium-slow"

  # StarSports
  run_suite "StarSports NFL" "tests/specs/starsports/starsports.nfl.animation.spec.ts" "chromium"
  run_suite "StarSports Football" "tests/specs/starsports/starsports.football.animation.spec.ts" "chromium"
  run_suite "StarSports Cricket" "tests/specs/starsports/starsports.cricket.animation.spec.ts" "chromium"
  run_suite "StarSports Tennis" "tests/specs/starsports/starsports.tennis.animation.spec.ts" "chromium"

  # Vodacom
  run_suite "Vodacom" "tests/specs/vodacom/VodaCS.test.spec.ts" "chromium"

  # PlanetF1
  run_suite "PlanetF1" "tests/specs/planetf1/Planetf1.webpages.spec.ts" "chromium-slow"
}

main "$@"


