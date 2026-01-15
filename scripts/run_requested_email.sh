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

  # Build numbered details for passes and fails (strip headers, add symbols per line)
  local passed_list failed_list
  passed_list=$(awk '/^✅ PASSED EVENTS \([0-9]+\):/{flag=1;next} flag && /^[0-9]+\./{line=$0; sub(/^[0-9]+\.\s*/,"",line); print line; next} flag && /^$/{flag=0}' "$out_file" | sed 's/^/✅/')
  failed_list=$(awk '/^❌ FAILED EVENTS \([0-9]+\):/{flag=1;next} flag && /^[0-9]+\./{line=$0; sub(/^[0-9]+\.\s*/,"",line); print line; next} flag && /^$/{flag=0}' "$out_file" | sed 's/^/❌/')

  # Fallback to line-per PASS/FAIL entries (e.g., StarSports)
  if [ -z "$passed_list" ]; then
    passed_list=$(awk '/^✅ PASS: /{sub(/^✅ PASS: /,"✅"); print}' "$out_file")
  fi
  if [ -z "$failed_list" ]; then
    failed_list=$(awk '/^❌ FAIL: /{sub(/^❌ FAIL: /,"❌"); print}' "$out_file")
  fi

  # Combine and add numbers
  combined_list=$( ( printf "%s\n" "$passed_list"; printf "%s\n" "$failed_list" ) | sed '/^$/d' | nl -w1 -s'.  ' )

  # Compose HTML body with per-tab pass/fail icons when available
  local uk_time subject body
  uk_time=$(TZ='Europe/London' date '+%d %B %Y %H:%M:%S UK Time')
  subject="${display_name} - Animation Check Report"
  body="<div style=\"font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif\">"
  body+="<h2>${display_name} – Automated Results</h2>"
  body+="<p><strong>Run Time:</strong> ${uk_time}</p>"
  body+="<p><strong>Total:</strong> ${total} | <strong>Pass:</strong> ${pass} | <strong>Fail:</strong> ${fail} | <strong>Success:</strong> $(( total>0 ? (pass*100/total) : 0 ))%</p>"
  body+="<pre style=\"white-space:pre-wrap;font-family:monospace\">${combined_list}</pre>"

  # PlanetF1: summarize main tabs with ✅ if they appear in output
  if echo "$display_name" | grep -qi "PlanetF1"; then
    body+="<h3>Pages</h3><ul>"
    for t in Home News Live Drivers Teams Standings Schedule Results Data Tech; do
      if grep -q "Loaded ${t} in" "$out_file"; then
        case "$t" in
          Live) url="https://live.planetf1.com/";;
          Home) url="https://www.planetf1.com/";;
          News) url="https://www.planetf1.com/news";;
          Drivers) url="https://www.planetf1.com/drivers";;
          Teams) url="https://www.planetf1.com/teams";;
          Standings) url="https://www.planetf1.com/standings";;
          Schedule) url="https://www.planetf1.com/schedule";;
          Results) url="https://www.planetf1.com/results";;
          Data) url="https://www.planetf1.com/f1-data";;
          Tech) url="https://www.planetf1.com/f1-tech";;
        esac
        body+="<li>✅ ${t}: ${url}</li>"
      else
        body+="<li>❌ ${t}: (not detected)</li>"
      fi
    done
    # Live sub-tabs
    body+="</ul><h3>Live Sub-tabs</h3><ul>"
    for s in P1 P2 P3 Q1 Q2 Q3 Grid Race; do
      if grep -q "LIVE TAB OK: ${s}" "$out_file"; then
        body+="<li>✅ ${s}</li>"
      elif grep -q "LIVE TAB ISSUE: ${s}" "$out_file"; then
        body+="<li>❌ ${s}</li>"
      else
        body+="<li>❌ ${s} (not found)</li>"
      fi
    done
    body+="</ul>"
  fi
  body+="<p style=\"color:#666\">Spec: <code>${spec}</code></p>"
  body+="</div>"

  python3 scripts/send_email.py --html "$subject" "$body"
}

main(){
  # If specific display name and spec are provided, run just that suite
  if [ "$#" -ge 2 ]; then
    local dn="$1"; shift
    local sp="$1"; shift
    local proj="${1:-chromium}"
    run_suite "$dn" "$sp" "$proj"
    return
  fi
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


