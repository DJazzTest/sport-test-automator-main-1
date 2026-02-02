#!/usr/bin/env node
/**
 * Run Playwright so tests work in IDE, local terminal, and Cursor sandbox.
 * - CI: leave PLAYWRIGHT_BROWSERS_PATH unset so workflow's Linux browsers are used.
 * - Local/sandbox: use project playwright-browsers/ only when it exists and is
 *   usable; otherwise install Chromium to default cache so sandbox can run tests.
 *   Use USE_PLAYWRIGHT_PROJECT_BROWSERS=1 to force project path (skip default-cache install).
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const browsersPath = path.resolve(projectRoot, 'playwright-browsers');

function projectBrowsersAvailable() {
  try {
    if (!fs.existsSync(browsersPath)) return false;
    const shellDir = path.join(browsersPath, 'chromium_headless_shell-1208');
    if (!fs.existsSync(shellDir)) return false;
    const arm64 = path.join(shellDir, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
    const x64 = path.join(shellDir, 'chrome-headless-shell-mac-x64', 'chrome-headless-shell');
    const exe = process.arch === 'arm64' ? arm64 : x64;
    if (!fs.existsSync(exe)) return false;
    fs.accessSync(exe, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

let useProjectBrowsersPath = null;
if (!process.env.CI) {
  if (projectBrowsersAvailable()) {
    useProjectBrowsersPath = browsersPath;
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
  } else {
    console.log('Project playwright-browsers/ not available. Installing Chromium to default cache so tests can run in sandbox…');
    execSync('npx playwright install chromium', { stdio: 'inherit', cwd: projectRoot, shell: true });
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  }
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

const playArgs = args.map(a => /[\s()]/.test(a) ? JSON.stringify(a) : a).join(' ');
const envPrefix = useProjectBrowsersPath
  ? `PLAYWRIGHT_BROWSERS_PATH=${JSON.stringify(useProjectBrowsersPath)} `
  : '';
const cmd = envPrefix + 'npx playwright ' + playArgs;

execSync(cmd, {
  stdio: 'inherit',
  env: process.env,
  cwd: projectRoot,
  shell: true,
});
