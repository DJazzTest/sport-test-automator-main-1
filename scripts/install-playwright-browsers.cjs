#!/usr/bin/env node
/**
 * Install Playwright Chromium for the current machine's architecture into
 * project playwright-browsers/. Use --force so the correct arch (e.g. arm64 on
 * Apple Silicon) is installed. Run via: npm run test:setup
 */
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const browsersPath = path.join(projectRoot, 'playwright-browsers');
process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;

console.log('Installing Chromium for current arch into:', browsersPath);
console.log('(Run this on the same machine where you run tests.)\n');
execSync('npx playwright install chromium --force', {
  stdio: 'inherit',
  env: process.env,
  cwd: projectRoot,
  shell: true,
});
