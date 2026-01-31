#!/usr/bin/env node
/**
 * Remove duplicate Playwright browser installs:
 * 1. From project: remove the arch that doesn't match this machine (e.g. remove x64 when on arm64).
 * 2. Optional --remove-global-chromium: remove Chromium from global cache (so only project remains).
 * Run: node scripts/remove-duplicate-playwright-browsers.cjs [--remove-global-chromium] [--yes]
 */
const path = require('path');
const fs = require('fs');
const os = require('os');

const projectRoot = path.resolve(__dirname, '..');
const projectBrowsers = path.join(projectRoot, 'playwright-browsers');
const home = os.homedir();
const globalCache =
  process.platform === 'darwin'
    ? path.join(home, 'Library', 'Caches', 'ms-playwright')
    : path.join(home, '.cache', 'ms-playwright');

const arch = process.arch; // 'arm64' or 'x64'
const keepShellDir = `chrome-headless-shell-mac-${arch}`;
const keepChromiumDir = `chrome-mac-${arch}`;

const args = process.argv.slice(2);
const removeGlobalChromium = args.includes('--remove-global-chromium');
const yes = args.includes('--yes');

function listDir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function rmDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  fs.rmSync(dirPath, { recursive: true, force: true });
  console.log('  Removed:', dirPath);
}

// 1. Remove from project the arch that doesn't match current machine (only if current arch exists)
console.log('=== Remove duplicate Playwright browsers ===\n');
console.log(`Machine arch: ${arch} (keeping ${keepShellDir}, ${keepChromiumDir})\n`);

let removed = 0;

if (fs.existsSync(projectBrowsers)) {
  const shellDir = path.join(projectBrowsers, 'chromium_headless_shell-1208');
  const hasKeepShell = fs.existsSync(path.join(shellDir, keepShellDir));
  if (fs.existsSync(shellDir) && hasKeepShell) {
    const subdirs = listDir(shellDir).filter(
      (e) => e.startsWith('chrome-headless-shell-mac-') && e !== 'DEPENDENCIES_VALIDATED' && e !== 'INSTALLATION_COMPLETE'
    );
    for (const d of subdirs) {
      if (d !== keepShellDir) {
        rmDir(path.join(shellDir, d));
        removed++;
      }
    }
  } else if (fs.existsSync(shellDir) && !hasKeepShell) {
    console.log(`  Project has no ${keepShellDir}; run npm run test:setup to install for this machine. Skipping shell removal.`);
  }
  const chromiumDir = path.join(projectBrowsers, 'chromium-1208');
  const hasKeepChromium = fs.existsSync(path.join(chromiumDir, keepChromiumDir));
  if (fs.existsSync(chromiumDir) && hasKeepChromium) {
    const subdirs = listDir(chromiumDir).filter(
      (e) => e.startsWith('chrome-mac-') && e !== 'DEPENDENCIES_VALIDATED' && e !== 'INSTALLATION_COMPLETE'
    );
    for (const d of subdirs) {
      if (d !== keepChromiumDir) {
        rmDir(path.join(chromiumDir, d));
        removed++;
      }
    }
  }
}

if (removed > 0) {
  console.log(`\nRemoved ${removed} duplicate arch dir(s) from project (kept only ${arch}).`);
} else {
  console.log('Project: no duplicate-arch dirs to remove (only current arch, or run npm run test:setup first).');
}

// 2. Optional: remove Chromium from global cache
if (removeGlobalChromium && fs.existsSync(globalCache)) {
  const globalChromium = path.join(globalCache, 'chromium-1181');
  const globalShell = path.join(globalCache, 'chromium_headless_shell-1181');
  if (!yes) {
    console.log('\n--remove-global-chromium: would remove from global cache:');
    if (fs.existsSync(globalChromium)) console.log('  ', globalChromium);
    if (fs.existsSync(globalShell)) console.log('  ', globalShell);
    console.log('\nOther Playwright projects may use global cache. Run with --yes to confirm.');
    process.exit(0);
  }
  if (fs.existsSync(globalChromium)) {
    rmDir(globalChromium);
    removed++;
  }
  if (fs.existsSync(globalShell)) {
    rmDir(globalShell);
    removed++;
  }
  console.log('\nRemoved Chromium from global cache. This project uses project playwright-browsers/ only.');
}

console.log('\nDone. Run: npm run test:check-browsers');
