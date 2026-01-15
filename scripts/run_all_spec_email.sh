#!/bin/bash
set -euo pipefail

ROOT="/Users/davidjarrett/Documents/sport-test-automator-main-1"
cd "$ROOT"

# Ensure test-results directory exists for JUnit output
mkdir -p test-results

# Email configuration – can be overridden via env or .env
if [ -f .env ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(SMTP_USER|SMTP_PASSWORD|RECIPIENTS)=' .env | xargs) || true
fi
export SMTP_USER="${SMTP_USER:-davidjarrett001@gmail.com}"
export SMTP_PASSWORD="${SMTP_PASSWORD:-xbzndaxkfnpoxnuo}"
export RECIPIENTS="${RECIPIENTS:-davidjarrett001@planetsport.com}"

echo "🚀 Running all *.spec.ts tests headless (chromium)..."

JOB_STATUS="success"
# Let Playwright's default testMatch pick up all *.spec.ts / *.test.ts files under ./tests
if ! npx playwright test --project=chromium; then
  JOB_STATUS="failed"
fi

XML_FILE="test-results/junit.xml"
if [ ! -f "$XML_FILE" ]; then
  echo "❌ JUnit results file not found: $XML_FILE"
  exit 1
fi

# Build extra details: which specs ran and their 'area' (folder)
SPEC_LIST=$(find tests -name '*.spec.ts' | sort)
DETAILS_HTML="<h3>Specs Executed</h3><ul>"
while IFS= read -r spec; do
  [ -z "$spec" ] && continue
  area=""
  case "$spec" in
    tests/specs/planetsports/*) area="PlanetSportBet (PSG)";;
    tests/specs/starsports/*) area="StarSports";;
    tests/specs/dragonbet/*) area="DragonSport";;
    tests/specs/dragonsports/*) area="DragonSports";;
    tests/specs/planetf1/*) area="PlanetF1";;
    tests/specs/vodacom/*) area="Vodacom";;
    tests/specs/teamtalk/*|tests/teamtalk/*) area="TeamTalk";;
    tests/specs/common/*) area="Common Navigation";;
    tests/specs/unit/*) area="Unit / Server Sanity";;
    *) area="Other";;
  esac
  DETAILS_HTML+="<li><strong>${spec}</strong> – Area: ${area}</li>"
done <<< "$SPEC_LIST"
DETAILS_HTML+="</ul>"

export EMAIL_DETAILS_HTML="$DETAILS_HTML"
export CI_PROJECT_NAME="PlanetSport Animation & Site Tests"

echo "📧 Sending consolidated JUnit email report (${JOB_STATUS}) to ${RECIPIENTS}..."
SMTP_USER="$SMTP_USER" SMTP_PASSWORD="$SMTP_PASSWORD" RECIPIENTS="$RECIPIENTS" python3 scripts/send_email.py "$XML_FILE" "$JOB_STATUS"

echo "✅ Done."


