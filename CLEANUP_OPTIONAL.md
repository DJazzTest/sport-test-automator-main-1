# Optional cleanup – duplicates and cruft

These are **optional** to remove. Your tests don’t depend on them.

## Likely safe to remove

| Item | Why |
|------|-----|
| **playwright.yml.** (file with trailing dot in root) | Looks like a typo; not referenced. May be an old config copy. |
| **tests/planetsportbet-inplay-selenium.py** | Selenium script; project uses Playwright. Legacy. |
| **ALL_TEST_COMMANDS.txt** vs **QUICK_TEST_COMMANDS.txt** | Overlap with `package.json` scripts and **ALL_TESTS_LIST.md**. Keep one list or merge. |
| **Debug PNGs in root** (e.g. `cricket-page-debug.png`, `football-page-debug-*.png`, `step4_*.png`, `overlay_*.png`) | Test run artifacts. Now in `.gitignore` for future runs; you can delete tracked ones and commit. |
| **planetf1.out**, **tennis.out**, **current_cron** | Log/cron output. Now in `.gitignore`. |
| **test_results_*.txt** (if any) | Old test output. |

## Docs that overlap (keep one source of truth)

- **QUICK_START.md**, **SIMPLE_SETUP.md**, **FIND_PROJECT_FOLDER.md**, **ANIMATION_TEST_README.md**, **MAC_USERS_README.txt** – consider merging into one “Run tests” doc or keeping only the one you use.

## Scripts (many run-* and scripts/run_*_email.sh)

- Root: `run_all_tests.sh`, `run-tests.sh`, `run-f1-test.sh`, `run-single-test.sh`, `quick_test.sh`, etc.
- `scripts/`: `run_all_tests_email.sh`, `run_all_spec_email.sh`, `run_all_11_tests_email.sh`, etc.

They’re not duplicates of each other (different targets). If you don’t use some of them, you can remove or archive the unused ones.

---

**Note:** This project uses **Playwright** for web automation (no Appium or native mobile). Playwright and Chromium have been updated; run `npx playwright install chromium` anytime to refresh the browser.
