#!/usr/bin/env node
/**
 * Run Playwright with project browsers so tests work in IDE and sandbox.
 * Sets PLAYWRIGHT_BROWSERS_PATH to project playwright-browsers/ when not in CI.
 * In CI we leave it unset so Playwright uses the default cache (filled by
 * "npx playwright install --with-deps" in the workflow) and Linux binaries work.
 */
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const browsersPath = path.join(projectRoot, 'playwright-browsers');
if (!process.env.CI) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
}

// Avoid Node warning: "NO_COLOR env is ignored due to FORCE_COLOR being set"
delete process.env.FORCE_COLOR;

let args = process.argv.slice(2);
if (args.includes('--sandbox')) {
  args = args.filter((a) => a !== '--sandbox');
  process.env.PLAYWRIGHT_SANDBOX = '1';
} else if (args.includes('--quick')) {
  args = args.filter((a) => a !== '--quick');
  process.env.PLAYWRIGHT_QUICK = '1';
}

execSync('npx playwright ' + args.map(a => /[\s()]/.test(a) ? JSON.stringify(a) : a).join(' '), {
  stdio: 'inherit',
  env: process.env,
  cwd: projectRoot,
  shell: true,
});
