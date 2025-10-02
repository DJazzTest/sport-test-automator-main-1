#!/bin/bash
set -euo pipefail

ROOT="/Users/davidjarrett/Documents/sport-test-automator-main-1"
cd "$ROOT"

# Load SMTP config from .env if present
if [ -f .env ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(SMTP_USER|SMTP_PASSWORD|RECIPIENTS)=' .env | xargs)
fi

export SMTP_USER="${SMTP_USER:-davidjarrett001@gmail.com}"
export SMTP_PASSWORD="${SMTP_PASSWORD:-xbzndaxkfnpoxnuo}"
export RECIPIENTS="${RECIPIENTS:-davidjarrett001@gmail.com}"

run_and_email(){
  local display_name="$1"       # e.g. "PSG Football"
  local spec_file="$2"          # e.g. tests/specs/planetsports/PSG.Football.Animations.spec.ts
  local project="${3:-chromium}" # default headless chromium

  echo "🏃 Running ${display_name} in headless (${project})..."

  local out_file
  out_file="/tmp/$(echo "$display_name" | tr ' ' '_' | tr -cd '[:alnum:]_').out"

  # Always run in headless by selecting the 'chromium' project from playwright.config.ts
  # Capture output for parsing and email summary
  if ! npx playwright test "$spec_file" --project="$project" | tee "$out_file"; then
    echo "⚠️ Test exited non-zero for ${display_name} (continuing)"
  fi

  # Parse PSG-style output: "✅ Events with Animations (PASS): 6"
  local total pass fail
  pass=$(grep -E "✅ Events with Animations \(PASS\):" "$out_file" | awk -F': ' '{print $2}' | awk '{s+=$1} END{print s+0}')
  fail=$(grep -E "❌ Events without Animations \(FAIL\):" "$out_file" | awk -F': ' '{print $2}' | awk '{s+=$1} END{print s+0}')
  
  # Parse StarSports-style output: "✅ Total Passed: 19"
  if [ "${pass:-0}" -eq 0 ]; then
    pass=$(grep -E "✅ Total Passed:" "$out_file" | awk '{print $NF}' | awk '{s+=$1} END{print s+0}')
  fi
  if [ "${fail:-0}" -eq 0 ]; then
    fail=$(grep -E "❌ Total Failed:" "$out_file" | awk '{print $NF}' | awk '{s+=$1} END{print s+0}')
  fi

  # Parse total from various formats
  total=$(grep -E "(📊 Total.*Events Tested:|📊 Total events checked:)" "$out_file" | awk '{print $NF}' | awk '{s+=$1} END{print s+0}')
  
  # Fallback: total = pass + fail if both present
  if [ "${total:-0}" -eq 0 ] && [ -n "${pass}" ] && [ -n "${fail}" ]; then
    total=$(( (pass+0) + (fail+0) ))
  fi

  # Collect detailed lines (first 40 to keep email concise)
  local details
  # Extract from PSG-style "✅ PASSED EVENTS" and "❌ FAILED EVENTS" sections
  details=$(awk '/^✅ PASSED EVENTS|^❌ FAILED EVENTS/{flag=1; print; next} flag && /^[0-9]+\./{print "  " $0; next} flag && /^$/{flag=0}' "$out_file" | sed 's/$/<br>/' | head -40)
  
  # Fallback to StarSports-style individual PASS:/FAIL: lines
  if [ -z "$details" ]; then
    details=$(awk '/^✅ PASS: |^❌ FAIL: /{print}' "$out_file" | sed 's/$/<br>/' | head -40)
  fi
  
  # Last fallback: normalize bare PASS:/FAIL: lines
  if [ -z "$details" ]; then
    details=$(awk '/^(PASS:|FAIL:)/{gsub(/^PASS: /,"✅ PASS: "); gsub(/^FAIL: /,"❌ FAIL: "); print}' "$out_file" | sed 's/$/<br>/' | head -40)
  fi

  local status notes passrate
  if [ "${total}" -gt 0 ]; then
    passrate=$(( ( (pass+0) * 100 ) / (total+0) ))
  else
    passrate=0
  fi

  if [ "${fail:-0}" -eq 0 ] && [ "${total:-0}" -gt 0 ]; then
    status="✅ PASSED"
    notes="All checks passed"
  else
    status="❌ FAILED"
    notes="${fail:-0} failed of ${total:-0}"
  fi

  # Determine icon and platform for nicer header
  local icon platform test_type
  case "$display_name" in
    *Football*) icon="⚽"; test_type="FOOTBALL Animation Check";;
    *NFL*) icon="🏈"; test_type="NFL Animation Check";;
    *Cricket*) icon="🏏"; test_type="CRICKET Animation Check";;
    *Tennis*) icon="🎾"; test_type="TENNIS Animation Check";;
    *Vodacom*) icon="📡"; test_type="Site Health Check";;
    *PlanetF1*) icon="🏎️"; test_type="Web Pages Check";;
    *) icon="📊"; test_type="Automated Test";;
  esac
  if echo "$spec_file" | grep -qi "/planetsports/"; then platform="PlanetSportBet (PSG)"; fi
  if echo "$spec_file" | grep -qi "/starsports/"; then platform="StarSports"; fi
  if echo "$spec_file" | grep -qi "/planetf1/"; then platform="PlanetF1"; fi
  if echo "$spec_file" | grep -qi "/vodacom/"; then platform="Vodacom"; fi

  local uk_time overall_label overall_status display_name_upper
  uk_time=$(TZ='Europe/London' date '+%d %B %Y at %H:%M:%S UK Time')
  if [ "${fail:-0}" -eq 0 ]; then overall_label="Completed Successfully"; overall_status="✅"; else overall_label="Completed with Issues"; overall_status="⚠️"; fi
  display_name_upper=$(echo "$display_name" | tr '[:lower:]' '[:upper:]')

  # Build email HTML to match requested layout
  local subject body
  subject="${icon} ${display_name_upper} Scheduled Test Report"
  body="<div style=\"font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.45\">"
  body+="<h2 style=\"margin:0 0 8px\">${icon} ${display_name_upper} Scheduled Test Report</h2>"
  body+="<p style=\"margin:0 0 16px\">Automated Test Results - ${uk_time}</p>"

  body+="<h3 style=\"margin:16px 0 8px\">📅 Test Schedule Information</h3>"
  body+="<ul style=\"margin:0 0 16px\">"
  body+="<li><strong>Test Type:</strong> ${test_type}</li>"
  body+="<li><strong>Platform:</strong> ${platform:-Unknown}</li>"
  body+="<li><strong>Test Time:</strong> ${uk_time}</li>"
  body+="<li><strong>Test Status:</strong> ${overall_label}</li>"
  body+="</ul>"

  body+="<h3 style=\"margin:16px 0 8px\">${overall_status} Overall Status</h3>"
  body+="<table border=\"1\" cellpadding=\"6\" style=\"border-collapse:collapse\"><tr><th>Total Events</th><th>Passed</th><th>Failed/Error</th><th>Success Rate</th></tr><tr><td style=\"text-align:center\">${total}</td><td style=\"text-align:center\">${pass:-0}</td><td style=\"text-align:center\">${fail:-0}</td><td style=\"text-align:center\">${passrate}%</td></tr></table>"

  body+="<h3 style=\"margin:16px 0 8px\">${icon} ${display_name_upper} Events Tested</h3>"
  body+="<ul style=\"margin:0 0 8px\">"
  body+="<li><strong>Sport:</strong> ${display_name}</li>"
  body+="<li><strong>Events Found:</strong> ${total}</li>"
  body+="<li><strong>Events Passed:</strong> ${pass:-0}</li>"
  body+="<li><strong>Events Failed:</strong> ${fail:-0}</li>"
  body+="<li><strong>Success Rate:</strong> ${passrate}%</li>"
  body+="</ul>"

  body+="<h3 style=\"margin:16px 0 8px\">📋 Event Details:</h3>"
  body+="<div style=\"font-family:monospace\">${details:-No detailed PASS/FAIL lines printed}<br></div>"

  body+="<h3 style=\"margin:16px 0 8px\">🔄 Next Scheduled Tests</h3>"
  body+="<p style=\"margin:0\">This test is part of a scheduled testing program running at:</p>"
  body+="<ul style=\"margin:8px 0\"><li>17:05 UK Time - NFL & Football</li><li>18:05 UK Time - NFL & Football</li><li>19:45 UK Time - NFL & Football</li><li>20:30 UK Time - NFL & Football</li></ul>"
  body+="<p style=\"margin-top:16px;color:#666\">Spec: <code>${spec_file}</code></p>"
  body+="</div>"

  python3 scripts/send_email.py --html "$subject" "$body"
}

main(){
  # PSG
  run_and_email "PSG Football" "tests/specs/planetsports/PSG.Football.Animations.spec.ts"
  run_and_email "PSG NFL" "tests/specs/planetsports/PSG.NFL.Animations.spec.ts"
  run_and_email "PSG Cricket" "tests/specs/planetsports/PSG.cricket.Animations.spec.ts"
  run_and_email "PSG Tennis" "tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts"

  # StarSports
  run_and_email "StarSports NFL" "tests/specs/starsports/starsports.nfl.animation.spec.ts"
  run_and_email "StarSports Football" "tests/specs/starsports/starsports.football.animation.spec.ts"
  run_and_email "StarSports Cricket" "tests/specs/starsports/starsports.cricket.animation.spec.ts"
  run_and_email "StarSports Tennis" "tests/specs/starsports/starsports.tennis.animation.spec.ts"

  # Vodacom
  run_and_email "Vodacom" "tests/specs/vodacom/VodaCS.test.spec.ts"

  # PlanetF1
  run_and_email "PlanetF1" "tests/specs/planetf1/Planetf1.webpages.spec.ts"
}

main "$@"
