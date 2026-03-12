import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { defineConfig, devices } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isCI = !!process.env.CI;
const projectBrowsersPath = path.join(__dirname, 'playwright-browsers');
const projectBrowsersExist = () => {
  try {
    if (!existsSync(projectBrowsersPath)) return false;
    const shellDir = path.join(projectBrowsersPath, 'chromium_headless_shell-1208');
    if (!existsSync(shellDir)) return false;
    const arm64 = path.join(shellDir, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
    const x64 = path.join(shellDir, 'chrome-headless-shell-mac-x64', 'chrome-headless-shell');
    return existsSync(arm64) || existsSync(x64);
  } catch {
    return false;
  }
};
// Use project browsers only when set by runner or when project folder exists (local). CI/sandbox use default cache.
const browsersPath = process.env.PLAYWRIGHT_BROWSERS_PATH || (projectBrowsersExist() ? projectBrowsersPath : '');
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && !isCI && projectBrowsersExist()) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = projectBrowsersPath;
}

// Use x64 Chromium on arm64 when arm64 binary is missing (e.g. run in Cursor/sandbox with only x64 installed; runs via Rosetta)
const arch = process.arch;
const shellDir = path.join(browsersPath, 'chromium_headless_shell-1208');
const arm64Shell = path.join(shellDir, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell');
const chromiumDir = path.join(browsersPath, 'chromium-1208', 'chrome-mac-x64');
const x64Chromium = path.join(chromiumDir, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');
const useX64Fallback = arch === 'arm64' && !existsSync(arm64Shell) && existsSync(x64Chromium);
const headedDemo = !!process.env.PLAYWRIGHT_HEADED_DEMO;
const chromiumUse = {
  ...devices['Desktop Chrome'],
  ...(useX64Fallback ? { executablePath: path.resolve(browsersPath, 'chromium-1208', 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing') } : {}),
  // When running with --headed, run a bit slower (500ms between actions) for easier watching
  ...(headedDemo ? { launchOptions: { slowMo: 500 } } : {}),
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: 'https://animationsautamation.netlify.app',
    headless: true, // Set to false for local visual debugging; must be true for CI
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'off', // Avoids ENOENT when tests timeout (browser torn down before trace file is written). Enable with --trace=on in CLI if needed.
  },
  retries: process.env.PLAYWRIGHT_HEADED_DEMO ? 0 : isCI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results-html', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['./scripts/detailed-run-reporter.ts'],
  ],
  projects: [
    { name: 'Golf365 Tests', testMatch: '**/golf365/**', use: chromiumUse },
    { name: 'Cricket365 Tests', testMatch: '**/cricket365/**', use: chromiumUse },
    { name: 'Football365 Tests', testMatch: '**/football365/**', use: chromiumUse },
    { name: 'PlanetFootball Tests', testMatch: '**/planetfootball/**', use: chromiumUse },
    {
      name: 'Other Tests',
      testIgnore: ['**/golf365/**', '**/cricket365/**', '**/football365/**', '**/planetfootball/**'],
      use: chromiumUse,
    },
  ],
});
