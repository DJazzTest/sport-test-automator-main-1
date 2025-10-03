#!/bin/bash
set -euo pipefail

ROOT="/Users/davidjarrett/Documents/sport-test-automator-main-1"
cd "$ROOT"

# SMTP/recipient config (override via env if needed)
if [ -f .env ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(SMTP_USER|SMTP_PASSWORD|RECIPIENTS)=' .env | xargs) || true
fi
export SMTP_USER="${SMTP_USER:-davidjarrett001@gmail.com}"
export SMTP_PASSWORD="${SMTP_PASSWORD:-xbzndaxkfnpoxnuo}"
export RECIPIENTS="${RECIPIENTS:-david.jarrett@planetsport.com}"

# Run Vodacom test (limit to 10 events) and capture output
OUT="/tmp/vodacom_scheduled.out"
MAX_EVENTS=10 npx playwright test tests/specs/vodacom/VodaCS.test.spec.ts --project=chromium | tee "$OUT" || true

# Parse core results
total=$(awk '/^🧪 === VODACOM SOCCER – MATCH CENTRE ANIMATION RESULTS ===/{flag=1;next} flag && /^📊 Total events checked:/{print $NF; exit}' "$OUT")
pass=$(awk  '/^🧪 === VODACOM SOCCER – MATCH CENTRE ANIMATION RESULTS ===/{flag=1;next} flag && /^✅ Passed:/{print $NF; exit}' "$OUT")
fail=$(awk  '/^🧪 === VODACOM SOCCER – MATCH CENTRE ANIMATION RESULTS ===/{flag=1;next} flag && /^❌ Failed:/{print $NF; exit}' "$OUT")

# Count broken links/images by grepping lines emitted by the extended checks
broken_links=$(grep -E '^❌ Broken link \[404\]|^❌ Broken link \[fetch error\]' "$OUT" | wc -l | awk '{print $1}')
broken_imgs=$(grep -E '^❌ Broken image ' "$OUT" | wc -l | awk '{print $1}')

# Pick two example URLs per key section (best-effort from the log)
pick_two() {
  grep -E "^✅ Link ok|^❌ Broken link|^✅ Video link|^https?://" "$OUT" | awk '{print $NF}' | sed 's/\x1b\[[0-9;]*m//g' | head -n 2
}

home_urls=$(awk '/^🔎 Checking images and links on Home\.{3}/{flag=1;next} flag && /^📋/{flag=0} flag && /https?:\/\//{print $NF}' "$OUT" | head -n 2)
mc_urls=$(awk '/^🔎 Checking images and links on Match Centre \(surface\)\.{3}/{flag=1;next} flag && /^📋/{flag=0} flag && /https?:\/\//{print $NF}' "$OUT" | head -n 2)
play_urls=$(awk '/^🔎 Checking images and links on Play\.{3}/{flag=1;next} flag && /^📋/{flag=0} flag && /https?:\/\//{print $NF}' "$OUT" | head -n 2)
comp_urls=$(awk '/^🔎 Checking images and links on Competitions\.{3}/{flag=1;next} flag && /^📋/{flag=0} flag && /https?:\/\//{print $NF}' "$OUT" | head -n 2)
news_feat_urls=$(awk '/^🔎 Checking images and links on News — Featured\.{3}/{flag=1;next} flag && /^📋/{flag=0} flag && /https?:\/\//{print $NF}' "$OUT" | head -n 2)
teams_urls=$(awk '/^🔎 Checking images and links on Teams\.{3}/{flag=1;next} flag && /^📋/{flag=0} flag && /https?:\/\//{print $NF}' "$OUT" | head -n 2)
videos_urls=$(grep -E '^✅ Video link \[200\]' "$OUT" | awk '{print $NF}' | head -n 2)

# Build HTML body
uk_time=$(TZ='Europe/London' date '+%d %b %Y %H:%M UK')
subject="📡 Vodacom Extended Site Check — Match Centre + Tabs (MAX_EVENTS=10)"

body="<h2>📡 Vodacom Extended Site Check — Headless (MAX_EVENTS=10)</h2>"
body+="<p><strong>Run:</strong> ${uk_time}</p>"
body+="<h3>Summary</h3><ul>"
body+="<li><strong>Match Centre animations:</strong> ${total:-0} checked, ${pass:-0} passed, ${fail:-0} failed</li>"
body+="<li><strong>Broken assets:</strong> ${broken_links} broken links, ${broken_imgs} broken images (sampled)</li>"
body+="</ul>"

# Events list (first 10)
events=$(awk '/^🎯 Testing event [0-9]+\/[0-9]+:/{sub(/^🎯 Testing event [0-9]+\/[0-9]+: /,""); print}' "$OUT" | head -n 10)
events_html=$(printf "%s\n" "$events" | sed 's/^/✅ /' | nl -w1 -s'.  ' | sed 's/$/<br>/')
body+="<h3>Match Centre — animations (sample)</h3><div style=\"font-family:monospace\">${events_html}</div>"

# Helper to render a small section
render_section(){
  local title="$1"; shift
  local urls="$1"; shift || true
  body+="<h3>${title}</h3><div style=\"font-family:monospace\">"
  if [ -n "$urls" ]; then
    while IFS= read -r u; do [ -n "$u" ] && body+="${u}<br>"; done <<< "$urls"
  else
    body+="(no sample URLs captured)<br>"
  fi
  body+="</div>"
}

render_section "Home (sample URLs)" "$home_urls"
render_section "Match Centre (surface)" "$mc_urls"
render_section "Play" "$play_urls"
render_section "Competitions" "$comp_urls"
render_section "News — Featured" "$news_feat_urls"
render_section "Teams" "$teams_urls"
render_section "Videos (2)" "$videos_urls"

body+="<hr><p style=\"color:#666;font-style:italic;text-align:center\">THIS IS AN AUTOMATED REPORT DO NOT REPLY</p>"

python3 scripts/send_email.py --html "$subject" "$body"


