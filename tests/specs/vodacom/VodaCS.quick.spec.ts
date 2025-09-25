import { test, expect } from '@playwright/test';

test('Vodacom Soccer – basic navigation and popups', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('https://vodacomsoccer.com/', { waitUntil: 'domcontentloaded' });

  // Accept all Cookies
  try {
    await page.getByRole('button', { name: 'Accept all Cookies' }).click({ timeout: 5000 });
  } catch {}

  // Agree and proceed
  try {
    await page.getByRole('button', { name: 'Agree and proceed' }).click({ timeout: 5000 });
  } catch {}

  // Click Match Centre
  await page.getByRole('link', { name: 'Match Centre' }).click();

  // Briefly ensure page loaded
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Optional: verify animation marker exists if present later
  // const liveAnim = page.locator('span.live-animation');
  // console.log('live-animation visible:', await liveAnim.first().isVisible().catch(() => false));
});







