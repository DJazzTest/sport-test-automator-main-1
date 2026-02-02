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
const chromiumUse = {
  ...devices['Desktop Chrome'],
  ...(useX64Fallback ? { executablePath: path.resolve(browsersPath, 'chromium-1208', 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing') } : {}),
};

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  use: {
    baseURL: 'https://animationsautamation.netlify.app',
    headless: true, // Set to false for local visual debugging; must be true for CI
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results-html', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  projects: [
    {
      name: 'chromium',
      use: chromiumUse,
    },
  ],
});
