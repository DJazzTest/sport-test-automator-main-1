# Test suites audit: PlanetF1, TeamTalk, PlanetSportBet

This document answers for each suite:
1. **What is tested** – scope and expectations
2. **What fails we detect** – failure types and how we find them
3. **What we report** – console output (what was tested + failures)
4. **What we send in the test report** – email body content (from Playwright Selectable workflow)

---

## PlanetF1

**Spec:** `tests/specs/planetf1/Planetf1.webpages.spec.ts`  
**Run:** `npm run test:planetf1`

### 1) What is tested
- **Tabs:** Home, News, Live, Drivers, Teams, Standings, Schedule, Results, Data, Tech (direct URLs).
- **Per tab:** Page load, consent dismissal, content presence, tab-specific checks (e.g. Live → Race/Grid/Q3/Q1; Standings → Constructors; Drivers/Teams → sample links and images).
- **Explicit checks:**
  - **Broken URLs (404s)** – same-origin links fetched via `request.fetch`; status ≥ 400 = broken. Critical links (Audi, Cadillac, /f1-teams/, /tracks/) always included.
  - **Stale content** – articles with no date within 14 days (via `<time datetime>`, `data-ps-datetime`, `data-ps-date`).
  - **Broken images** – `<img>` with zero `naturalWidth`/`naturalHeight` (excludes known tracker/ad hosts). On Standings, we wait for team logos to settle before check.
  - **No ads** – no display ad (banner/MPU) found by heuristic (size/class/id).

### 2) What fails we detect
- **Fail:** Broken link (404 or request error) → logged as `❌ Fail: Tab>URL`.
- **BrokenImage:** Broken image URL on a tab → `❌ BrokenImage: Location=Tab | URL=...`.
- **StaleContent:** No article with date within 14 days → `❌ StaleContent: Location=Tab | message`.
- **NoAds:** No display ad on tab → `❌ NoAds: Location=Tab | No display ad found`.
- Navigation/content failures per tab are also recorded in summary and can fail the test.

### 3) What we report (console)
- Per-tab load time and URL.
- `📋 Testing Covered` – for each tab that passed: `✅ PASS: Tab>feature1>feature2...`.
- If any broken links: `❌ Issues Identified as broken ❌` then `❌ Fail: Tab>URL` for each, plus steps to recreate.
- Broken images: `❌ BrokenImage: Location=Tab | URL=...`.
- Stale content: `❌ StaleContent: Location=Tab | message`.
- No ads: `❌ NoAds: Location=Tab | No display ad found`.
- Soft assertion on slow tabs (>5s).

### 4) What we send in the test report (email)
- **Workflow:** `playwright-selectable.yml` detects `test:planetf1` (or path containing `planetf1`) and extracts the exact report block the spec prints.
- **Email body:** The spec prints a report block; the workflow uses it as-is. It always starts with `✅ Planetf1 testing has completed see below details✅`. Then either:
  - `✅No Fails identified✅` when the test ran and found no failures;
  - Or each failure line: `❌ BrokenImage: ...`, `❌ Fail: Tab>URL (status)`, `❌ StaleContent: ...`, `❌ NoAds: ...`.
- If the report block is not found in the log (e.g. test failed before completing, e.g. browser not found), the email says so and tells you to check workflow logs – it never says "no failures".

---

## TeamTalk

**Spec:** `tests/specs/teamtalk/teamtlkweb.spec.ts`  
**Run:** `npm run test:teamtalk`

### 1) What is tested
- **Sections:** Home, Transfer News (listing + sample articles), Confirmed Transfers, Premier League.
- **Team pages:** Overview + News tab for a subset of teams (Arsenal, Aston Villa, Brentford, Chelsea, Liverpool, Manchester City, Manchester United, Tottenham Hotspur); count controlled by `MAX_TEAMS` (CI: 3, local: 5).
- **Per section:** Load, consent dismissal, overlay dismissal, scroll for lazy load, then:
  - **Broken images** – visible `<img>` with `naturalWidth === 0` (best-effort; we do not log each URL to console for report).
  - **Ad presence** – count of ad-like containers (log only).
  - **Broken links** – sample of `main a[href]` (up to 20); skip images, uploads, social share URLs; `request.fetch` with `maxRedirects: 0`; status ≥ 400 = broken.
  - **Error markers** – 404/server error/fatal error text in `main`; test fails if detected.

### 2) What fails we detect
- **Broken links** – HTTP status ≥ 400 (or fetch error). Logged as `❌ Fail: Section>URL` (for email) and detailed `console.warn` with steps.
- **404/error markers** – text in main content → test fails and we log section + steps.
- Broken images are checked but do not fail the test; we do not list each broken image URL in the report.

### 3) What we report (console)
- Section headers: `===== SECTION =====`.
- Per section: ad container count, broken link count (if any), and for each broken link: `❌ Fail: Section>URL` plus steps to recreate (same format as PlanetF1 for email).
- Final block: `📋 TeamTalk test finished` with list of sections tested and total broken links (if any).

### 4) What we send in the test report (email)
- **Workflow:** `playwright-selectable.yml` detects `test:teamtalk` (or path containing `teamtalk`) and uses a dedicated block (same idea as PlanetF1).
- **Email body:** Always starts with `✅ TeamTalk test finished`. Then either:
  - `✅ No failures detected` + what was tested (sections + checks), or
  - The extracted `❌ Fail: Section>URL` lines + what was tested.

---

## PlanetSportBet (PlanetSports / PSG)

**Specs:**  
- Football: `tests/specs/planetsports/PSG.Football.Animations.spec.ts`  
- Cricket: `tests/specs/planetsports/PSG.cricket.Animations.spec.ts`  
- Tennis: `tests/specs/planetsports/PSG.Tennis.Animations.Spec.ts`  
- NFL: `tests/specs/planetsports/PSG.NFL.Animations.spec.ts`  

**Run:** `npm run test:planetf1` (PlanetF1 only); PlanetSportBet = `npm run test:planetsports` or `test:cricket`, `test:football`, `test:tennis`, `test:nfl`.

### 1) What is tested
- **Site:** https://planetsportbet.com/ (and sport-specific URLs).
- **Scope:** Animation / Live tracker presence on event detail pages.
- **Flow:** Land on site → consent/popups → navigate to sport (Football/Cricket/Tennis/NFL) → open tabs (e.g. Today, Tomorrow, All) → for each of N events open event page → check for animation (iframe with thesports01.com/widget, or .animate-svg, or “Live tracker” click then widget).
- **Expectation:** Event detail pages should show the animation widget (or equivalent); missing animation = FAIL for that event.

### 2) What fails we detect
- **Per event:** No animation detected (no widget iframe, no SVG animation, or Live tracker not found/not opening) → FAIL for that event.
- **Errors:** Navigation/timeout/closed page → ERROR for that event.
- Tab/section not found or no events → logged; test continues or falls back (e.g. “All” tab).

### 3) What we report (console)
- Start: e.g. `🚀 Starting Football Animation Test...`.
- Tab visibility, event counts, per-event result (✅/❌).
- **RESULTS block per tab:** `🧪 === FOOTBALL (Tab) RESULTS ===`, `📊 Total Football Events Tested`, `✅ Events with Animations (PASS)`, `❌ Events without Animations (FAIL)`, `🚨 Events with Errors (ERROR)`.
- **DETAILED RESULTS:** Lists of PASSED EVENTS, FAILED EVENTS, ERROR EVENTS.
- Final: e.g. `🏁 Football Animation Test completed!` (and for Tennis/Cricket/NFL similar final summaries).

### 4) What we send in the test report (email)
- **Workflow:** Same generic extraction as TeamTalk; keeps lines with ✅, ❌, 📋, RESULTS, Animation, PlanetSportBet, etc.
- **Email body:** Extracted console output including RESULTS blocks, pass/fail counts, and detailed PASSED/FAILED/ERROR event lists so the email shows what was tested and what failed.

---

## Summary table

| Suite         | What is tested                          | Failures we detect                    | Report (console)                          | Email (what we send)                          |
|---------------|------------------------------------------|---------------------------------------|-------------------------------------------|-----------------------------------------------|
| **PlanetF1**  | 10 tabs, links, images, stale, ads       | Fail, BrokenImage, StaleContent, NoAds| PASS per tab; ❌ lines for each failure   | Header + “No failures” or list of ❌ lines   |
| **TeamTalk**  | Home, Transfer, Transfers, PL, teams     | Broken links (Fail: Section>URL), 404 text | Section headers; ❌ Fail: Section>URL; summary | Extracted lines including ❌ and summary     |
| **PlanetSportBet** | Sport animation on event pages   | Per-event PASS/FAIL/ERROR              | RESULTS + DETAILED RESULTS per tab        | Extracted RESULTS + pass/fail/error lists     |
