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
if [ "${SKIP_RUN:-0}" != "1" ]; then
  MAX_EVENTS="${MAX_EVENTS:-10}" npx playwright test tests/specs/vodacom/VodaCS.test.spec.ts --project=chromium | tee "$OUT" || true
fi

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

# Curated sample URLs with status icons
first_of(){ printf "%s" "$1" | head -n1; }
mc_one=$(first_of "$mc_urls")
play_one=$(first_of "$play_urls")
comp_one=$(first_of "$comp_urls")
news_feat_broken=$(grep -E '^❌ Broken link \[[0-9]+\]' "$OUT" | awk '{print $NF}' | head -n1)
news_feat_one=$(first_of "$news_feat_urls")
teams_one=$(first_of "$teams_urls")

body+="<h3>Sample URLs (with status)</h3><ul>"
if [ -n "$mc_one" ]; then body+="<li>Match Centre (surface, ✅): ${mc_one}</li>"; fi
if [ -n "$play_one" ]; then body+="<li>Play (✅): ${play_one}</li>"; fi
if [ -n "$comp_one" ]; then body+="<li>Competitions (✅): ${comp_one}</li>"; fi
if [ -n "$news_feat_broken" ]; then
  body+="<li>News — Featured (❌): ${news_feat_broken}</li>"
elif [ -n "$news_feat_one" ]; then
  body+="<li>News — Featured (✅): ${news_feat_one}</li>"
fi
if [ -n "$teams_one" ]; then body+="<li>Teams (✅): ${teams_one}</li>"; fi
body+="</ul>"

# Events list (first 10)
events=$(awk '/^🎯 Testing event [0-9]+\/[0-9]+:/{sub(/^🎯 Testing event [0-9]+\/[0-9]+: /,""); print}' "$OUT" | head -n 10)
events_html=$(printf "%s\n" "$events" | sed 's/^/✅ /' | nl -w1 -s'.  ' | sed 's/$/<br>/')
body+="<h3>Match Centre — animations (sample)</h3><div style=\"font-family:monospace\">${events_html}</div>"
# Per-section stats from log lines
section_line(){ awk -v sec="$1" -F"—" '/^📋 /{gsub(/^📋 /,"",$0); if(index($0,sec)==1) print $0}' "$OUT" | head -n1; }
section_stats(){
  local name="$1"; local line; line=$(section_line "$name");
  if [ -n "$line" ]; then
    # Example: "Home — Checked images: 3, broken: 0; Checked links: 3, broken: 0"
    local img_broken link_broken img_checked link_checked
    img_checked=$(printf "%s" "$line" | sed -E 's/.*Checked images: ([0-9]+).*/\1/')
    img_broken=$(printf "%s" "$line" | sed -E 's/.*Checked images: [0-9]+, broken: ([0-9]+).*/\1/')
    link_checked=$(printf "%s" "$line" | sed -E 's/.*Checked links: ([0-9]+).*/\1/')
    link_broken=$(printf "%s" "$line" | sed -E 's/.*Checked links: [0-9]+, broken: ([0-9]+).*/\1/')
    local img_status link_status
    if [ "${img_broken:-0}" -eq 0 ]; then img_status="✅ Pass (no broken images)"; else img_status="❌ ${img_broken} broken images"; fi
    if [ "${link_broken:-0}" -eq 0 ]; then link_status="✅ Pass (no broken links)"; else link_status="❌ ${link_broken} broken links"; fi
    printf '<li><strong>%s</strong>: Images %s (checked %s) — Links %s (checked %s)</li>\n' "$name" "$img_status" "${img_checked:-0}" "$link_status" "${link_checked:-0}"
  fi
}

body+="<h3>Section checks</h3><ul>"
body+=$(section_stats "Home ")
body+=$(section_stats "Match Centre (surface)")
body+=$(section_stats "Play")
body+=$(section_stats "Competitions")
body+=$(section_stats "News — Featured")
body+=$(section_stats "News — PSL")
body+=$(section_stats "News — EPL")
body+=$(section_stats "News — Bafana")
body+=$(section_stats "News — La Liga")
body+=$(section_stats "News — Bundesliga")
body+=$(section_stats "Teams")
body+="</ul>"
# Build detailed per-event PASS/FAIL list with URLs (if present in log)
# Generate TSV: status\ttitle\turl
events_tsv=$(awk '
  /^🎯 Testing event [0-9]+\/[0-9]+:/ { 
    title = $0; sub(/^🎯 Testing event [0-9]+\/[0-9]+: /, "", title); url=""; status=""; in_event=1; next 
  }
  /^URL: / && in_event { url=$0; sub(/^URL: /, "", url); next }
  (/^✅ PASS: / || /^❌ FAIL: /) && in_event {
    if ($0 ~ /^✅ PASS: /) { status="PASS" } else { status="FAIL" }
    print status "\t" title "\t" url;
    in_event=0; title=""; url=""; status=""; next
  }
' "$OUT")

# Split into passed and failed HTML lists
passed_events_html=$(printf "%s\n" "$events_tsv" | awk -F"\t" '$1=="PASS"{printf("<li>✅ %s%s%s</li>\n", $2, ($3!=""?" — ":""), ($3!=""?$3:"") )}')
failed_events_html=$(printf "%s\n" "$events_tsv" | awk -F"\t" '$1=="FAIL"{printf("<li>❌ %s%s%s</li>\n", $2, ($3!=""?" — ":""), ($3!=""?$3:"") )}')

# Compose enhanced sections
body+="<h3>What was tested</h3><p>Match Centre event pages (up to ${total:-0} sampled), plus light checks on Home, Match Centre surface, Play, Competitions, News (sampled tabs), Teams, and Videos.</p>"
if [ -n "$passed_events_html" ]; then
  body+="<h3>✅ Passed</h3><ul>"$passed_events_html"</ul>"
fi
if [ -n "$failed_events_html" ]; then
  body+="<h3>❌ Failed</h3><ul>"$failed_events_html"</ul>"
fi


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

# Explicitly pass environment variables to Python
SMTP_USER="$SMTP_USER" SMTP_PASSWORD="$SMTP_PASSWORD" RECIPIENTS="$RECIPIENTS" python3 scripts/send_email.py --html "$subject" "$body"
echo "Email notification sent successfully: $subject"

# Also write preview to a local HTML file for review
printf '<!doctype html>\n<html><head><meta charset="utf-8"><title>Vodacom Email Preview</title></head><body>%s</body></html>\n' "$body" > /tmp/vodacom_email_preview.html


