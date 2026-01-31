/**
 * Minimal smoke test: verifies Playwright + Chromium work in this environment.
 * Uses about:blank (no network). Run with: npm run test:playwright -- tests/specs/smoke.playwright-works.spec.ts
 * Use this to confirm tests can run "in this window" (IDE/agent); full suite runs in your terminal.
 */
import { test, expect } from '@playwright/test';

test('Playwright smoke – browser launches and runs a trivial check', async ({ page }) => {
  test.setTimeout(15_000); // 15s max
  await page.goto('about:blank');
  const title = await page.title();
  expect(title).toBe('');
  console.log('✅ Smoke: Playwright + Chromium OK (about:blank)');
});
