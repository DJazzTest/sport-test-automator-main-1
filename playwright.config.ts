import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  use: {
    baseURL: 'https://animationsautamation.netlify.app',
    headless: true, // Set to false for local visual debugging; must be true for CI
  },
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'test-results-html', open: 'never' }]],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],
});
