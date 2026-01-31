# Why tests can't run in this window (and how to fix it)

When you run Playwright tests **from Cursor's agent or from the IDE "Run Test"**, they often fail or never finish. Here’s what’s going on and what to do.

---

## 1. Wrong browser architecture (main cause)

**Symptom:**  
`Executable doesn't exist at .../playwright-browsers/chromium_headless_shell-1208/chrome-headless-shell-mac-**arm64**/chrome-headless-shell`

**Cause:**  
Your project’s `playwright-browsers/` folder was filled on a **different CPU** (e.g. Intel / x64). On an **Apple Silicon (M1/M2/M3)** Mac, Playwright expects **arm64** binaries. If only **mac-x64** is present, the executable path above is missing and the test run fails.

**Fix (on the machine where you run tests):**

```bash
cd /path/to/sport-test-automator-main-1
PLAYWRIGHT_BROWSERS_PATH="$(pwd)/playwright-browsers" npx playwright install chromium
```

Or use the project script (same effect):

```bash
npm run test:setup
```

That runs `npx playwright install chromium --force` into `playwright-browsers/` for **your current CPU** (e.g. arm64 on Apple Silicon). After this, running tests in **your own terminal** in this window (or in Cursor’s terminal) should work.

---

## 2. Timeout when the agent runs tests

**Symptom:**  
“Running 1 test using 1 worker” appears, then the command times out (e.g. after 1–2 minutes) with no result.

**Cause:**  
When the **Cursor agent** runs a command, it has a **time limit**. Real tests (PlanetF1, TeamTalk, PlanetSportBet, etc.) need **network** and run for **several minutes**. The agent’s run is stopped before they finish.

**Fix:**  
Run the full suite in **your own terminal** (same repo, same `npm run test:...` commands). There is no process timeout there.

- Example: `npm run test:planetf1`
- Or: `npm run test:teamtalk`

---

## 3. Quick check that Playwright works “in this window”

After fixing (1), you can confirm Playwright works in the same environment with a **short, local-only** smoke test:

```bash
npm run test:playwright -- tests/specs/smoke.playwright-works.spec.ts
```

That spec uses `about:blank` (no network), finishes in a few seconds, and verifies that Chromium + Playwright run correctly. If this passes, the only reason longer tests “can’t run in this window” is (2) – timeout when the agent runs them.

---

## 4. Tests run slow in sandbox

To run PlanetF1 faster in the IDE/sandbox (fewer tabs, shorter waits, ~1–2 min instead of ~5 min):

```bash
npm run test:planetf1:quick
```

Or set `PLAYWRIGHT_QUICK=1` when running any test. In CI, quick mode is used automatically.

---

## Summary

| Issue | Cause | Fix |
|-------|--------|-----|
| `Executable doesn't exist at ... chrome-headless-shell-mac-arm64` | Browsers in `playwright-browsers/` are for a different CPU (e.g. x64 only). | Run `npm run test:setup` on the machine where you run tests. |
| Test starts then times out when the agent runs it | Agent has a short run timeout; real tests need network and run for minutes. | Use quick mode: `npm run test:planetf1:quick`; or run full tests in your own terminal. |
| Tests run slow in sandbox | Sandbox may have slower network/CPU; full test has many tabs and waits. | Use `npm run test:planetf1:quick` or set `PLAYWRIGHT_QUICK=1`. |
| Want to confirm Playwright works in this window | — | Run `npm run test:playwright -- tests/specs/smoke.playwright-works.spec.ts` after fixing (1). |
