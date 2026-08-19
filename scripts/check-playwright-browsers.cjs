#!/usr/bin/env node
/**
 * Check Playwright browser installations: project vs global, versions, and arch.
 * Run: node scripts/check-playwright-browsers.cjs
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const projectBrowsers = path.join(projectRoot, 'playwright-browsers');
const home = os.homedir();
// Default cache path (used when PLAYWRIGHT_BROWSERS_PATH is not set)
const globalCache =
  process.platform === 'darwin'
    ? path.join(home, 'Library', 'Caches', 'ms-playwright')
    : path.join(home, '.cache', 'ms-playwright');

const arch = process.arch; // 'arm64' or 'x64'
const expectedShellDir = `chrome-headless-shell-mac-${arch}`;
const expectedChromiumDir = `chrome-mac-${arch}`;

function listDir(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function getSize(dirPath) {
  try {
    return execSync(`du -sh "${dirPath}" 2>/dev/null`, { encoding: 'utf8' }).split(/\s/)[0];
  } catch {
    return '?';
  }
}

function checkLocation(label, basePath) {
  if (!fs.existsSync(basePath)) {
    console.log(`\n${label}: not found`);
    return 0;
  }
  const size = getSize(basePath);
  console.log(`\n${label}: ${basePath} (${size})`);
  const entries = listDir(basePath).filter((e) => !e.startsWith('.'));
  for (const name of entries) {
    if (name.startsWith('chromium') || name.startsWith('ffmpeg')) {
      const full = path.join(basePath, name);
      const sub = listDir(full).filter((e) => !e.startsWith('.') && e !== 'DEPENDENCIES_VALIDATED' && e !== 'INSTALLATION_COMPLETE');
      console.log(`  ${name}/ → ${sub.join(', ')}`);
    }
  }
  return 1;
}

console.log('=== Playwright browser check ===');
console.log(`Machine arch: ${arch}`);
console.log(`Playwright on this Mac looks for: chromium_headless_shell-*/${expectedShellDir}/chrome-headless-shell`);

let locationCount = 0;
locationCount += checkLocation('Project (playwright-browsers/)', projectBrowsers);
locationCount += checkLocation('Global cache (no PLAYWRIGHT_BROWSERS_PATH)', globalCache);

// Summary
const projectShell = path.join(projectBrowsers, 'chromium_headless_shell-1208', expectedShellDir);
const hasProjectArch = fs.existsSync(projectShell);
console.log('\n--- Summary ---');
console.log(`Playwright-browser locations: ${locationCount} (project + global cache)`);
console.log(`Project has ${expectedShellDir} for current arch: ${hasProjectArch ? 'YES' : 'NO'}`);
if (!hasProjectArch) {
  const projectShellDir = path.join(projectBrowsers, 'chromium_headless_shell-1208');
  if (fs.existsSync(projectShellDir)) {
    const subs = listDir(projectShellDir).filter((e) => !e.startsWith('.') && e !== 'DEPENDENCIES_VALIDATED' && e !== 'INSTALLATION_COMPLETE');
    console.log(`  Project only has: ${subs.join(', ')}`);
  }
  console.log('\nTo fix: run on this machine:');
  console.log('  npm run test:setup');
  console.log('  or: PLAYWRIGHT_BROWSERS_PATH="$(pwd)/playwright-browsers" npx playwright install chromium');
}

const projectCount = fs.existsSync(projectBrowsers) ? listDir(projectBrowsers).filter((e) => e.startsWith('chromium')).length : 0;
const globalCount = fs.existsSync(globalCache) ? listDir(globalCache).filter((e) => e.startsWith('chromium')).length : 0;
console.log(`\nChromium installs: project=${projectCount} (version 1208), global cache=${globalCount} (may be different version).`);
if (projectCount > 0 && globalCount > 0) {
  console.log('You have both: project-local and global. Tests use project when PLAYWRIGHT_BROWSERS_PATH is set (run-playwright.cjs sets it).');
  console.log('To remove duplicate Chromium from global cache: npm run test:remove-duplicate-browsers -- --remove-global-chromium');
}
if (projectCount > 0 && !hasProjectArch) {
  const projectShellDir = path.join(projectBrowsers, 'chromium_headless_shell-1208');
  if (fs.existsSync(projectShellDir)) {
    const subs = listDir(projectShellDir).filter((e) => e.startsWith('chrome-') && e !== 'DEPENDENCIES_VALIDATED' && e !== 'INSTALLATION_COMPLETE');
    if (subs.length > 0) {
      console.log('To remove wrong-arch from project (keep only current arch): npm run test:remove-duplicate-browsers');
    }
  }
}
