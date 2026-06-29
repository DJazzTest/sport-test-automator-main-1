import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 60000,
  // Run tests in parallel for better performance
  workers: process.env.CI ? 2 : 4, // Use 4 workers locally, 2 in CI
  // Reduce retries to speed up failures
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "https://animationsautamation.netlify.app",
    headless: true, // Set to false for local visual debugging; must be true for CI
    // Optimize network settings
    actionTimeout: 30000, // Reduce action timeout from default
    navigationTimeout: 30000, // Reduce navigation timeout
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results-html", open: "never" }],
    ["./tests/reporters/grafana-metrics-reporter.ts"],
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
