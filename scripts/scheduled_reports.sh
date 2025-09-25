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
export SMTP_PASSWORD="${SMTP_PASSWORD:-xbzn daxk fnpo xnuo}"
export RECIPIENTS="${RECIPIENTS:-David.jarrett@planetsport.com}"

run_psg_football(){
  local OUT="/tmp/psg_fb_sched.out"
  npx playwright test tests/specs/planetsports/PSG.Football.Animations.spec.ts --project=chromium | tee "$OUT"
  local RESULTS_BLOCK TODAY TOM ALL
  # Collect detailed results from each printed block like Cricket/Tennis
  RESULTS_BLOCK=$(awk '/^📋 === DETAILED RESULTS \(Today\) ===/{flag=1; next} /^📋 === DETAILED RESULTS \(Tomorrow\) ===/{flag=1; next} /^🧪 === FOOTBALL \(/{flag=0} flag && /^(PASS:|FAIL:)/{ if ($0 ~ /^PASS:/) { sub(/^PASS: /,"✅ PASS: "); print } else { sub(/^FAIL: /,"❌ FAIL: "); print } }' "$OUT")
  # Also capture any All tab detailed results if present
  local RESULTS_ALL
  RESULTS_ALL=$(awk '/^📋 === DETAILED RESULTS \(All\) ===/{flag=1; next} /^🧪 === FOOTBALL \(/{flag=0} flag && /^(PASS:|FAIL:)/{ if ($0 ~ /^PASS:/) { sub(/^PASS: /,"✅ PASS: "); print } else { sub(/^FAIL: /,"❌ FAIL: "); print } }' "$OUT")
  RESULTS_BLOCK=$(printf "%s\n%s" "$RESULTS_BLOCK" "$RESULTS_ALL" | sed '/^$/d' | sed 's/$/<br>/')

  TODAY=$(grep -A50 "=== FOOTBALL (Today) RESULTS ===" "$OUT" | grep -m1 "Total Football Events Tested" | sed -E 's/.*Tested: ([0-9]+).*/\1/' || echo 0)
  TOM=$(grep -A50 "=== FOOTBALL (Tomorrow) RESULTS ===" "$OUT" | grep -m1 "Total Football Events Tested" | sed -E 's/.*Tested: ([0-9]+).*/\1/' || echo 0)
  ALL=$(grep -A50 "=== FOOTBALL (All) RESULTS ===" "$OUT" | grep -m1 "Total Football Events Tested" | sed -E 's/.*Tested: ([0-9]+).*/\1/' || echo 0)
  python3 scripts/send_email.py --html "PSG.Football Findings (Today=${TODAY}, Tomorrow=${TOM}, All=${ALL})" "<strong>✅ === DETAILED RESULTS (Football) ===</strong><br>${RESULTS_BLOCK}"
}

run_psg_cricket(){
  local OUT="/tmp/psg_cricket_sched.out"
  npx playwright test tests/specs/planetsports/PSG.cricket.Animations.spec.ts --project=chromium-slow | tee "$OUT"
  local RESULTS_BLOCK
  RESULTS_BLOCK=$(awk '/^📋 === DETAILED RESULTS ===/{flag=1;next}/^🧪|^❌ ===|^🎉/{if(flag){exit}}flag && /^(PASS:|FAIL:)/{ if ($0 ~ /^PASS:/) { sub(/^PASS: /,"✅ PASS: "); print } else { sub(/^FAIL: /,"❌ FAIL: "); print } }' "$OUT" | sed 's/$/<br>/')
  python3 scripts/send_email.py --html "PSG.Cricket Headed Results" "<strong>✅ === DETAILED RESULTS (Cricket) ===</strong><br>${RESULTS_BLOCK}"
}

run_psg_tennis(){
  local OUT="/tmp/psg_tennis_sched.out"
  npx playwright test tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts --project=chromium-slow | tee "$OUT"
  local RESULTS_BLOCK
  RESULTS_BLOCK=$(awk '/^📋 === DETAILED RESULTS ===/{flag=1;next}/^🧪/{if(flag){exit}}flag && /^(PASS:|FAIL:)/{ if ($0 ~ /^PASS:/) { sub(/^PASS: /,"✅ PASS: "); print } else { sub(/^FAIL: /,"❌ FAIL: "); print } }' "$OUT" | sed 's/$/<br>/')
  python3 scripts/send_email.py --html "PSG.Tennis Headed Results" "<strong>✅ === DETAILED RESULTS (Tennis) ===</strong><br>${RESULTS_BLOCK}"
}

run_psg_nfl(){
  local OUT="/tmp/psg_nfl_sched.out"
  npx playwright test tests/specs/planetsports/PSG.NFL.Animations.spec.ts --project=chromium-slow | tee "$OUT"
  local RESULTS_BLOCK COMP_BLOCK
  RESULTS_BLOCK=$(awk '/✅ PASS: Live tracker animation found —|❌ FAIL: No live tracker animation —/{print}' "$OUT" | sed -E 's/✅ PASS: Live tracker animation found —/✅ PASS:/; s/❌ FAIL: No live tracker animation —/❌ FAIL:/' | sed 's/$/<br>/')
  COMP_BLOCK=$(awk '/🏷️  Competition breakdown:/{flag=1;next}/^=== AMERICAN FOOTBALL LIVE TRACKER RESULTS ===/{flag=0}flag{print}' "$OUT" | sed 's/$/<br>/')
  python3 scripts/send_email.py --html "PSG.NFL Headed Results (All)" "<strong>✅ === DETAILED RESULTS (NFL) ===</strong><br>${RESULTS_BLOCK}<br><strong>🏷️ Competition breakdown</strong><br>${COMP_BLOCK}"
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


