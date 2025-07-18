import { test, expect } from '@playwright/test';

test.setTimeout(180000);

test('PlanetSportBet – Animation Check', async ({ page }) => {
  await page.goto('https://planetsportbet.com');

  // Dismiss cookie popup
  try {
    await page.getByRole('button', { name: /Allow all|Accept|Agree|Yes/i }).click({ timeout: 5000 });
  } catch {}

  // Dismiss "Sign Up" popup
  try {
    await page.locator('.css-7o8a95-SvgElement-CloseButton').click({ timeout: 5000 });
  } catch {}

  // Click IN PLAY tab
  await page.getByRole('link', { name: /In Play/i }).click();

  // Wait for All Sports section
  const eventHeaders = page.locator('.css-1yvmh6z-EventRowHeader');
  await expect(eventHeaders.first()).toBeVisible({ timeout: 10000 });

  const count = await eventHeaders.count();
  console.log(`Found ${count} events`);

  const testCount = Math.min(count, 20);
  let results: { event: string; result: string }[] = [];

  for (let i = 0; i < testCount; i++) {
    const event = eventHeaders.nth(i);
    let title = `Event ${i}`;
    try {
      title = await event.innerText();
    } catch {}

    await event.scrollIntoViewIfNeeded();
    await event.click();
    await page.waitForTimeout(2000);

    try {
      const animation = page.locator('animate-svg');
      await expect(animation).toBeVisible({ timeout: 5000 });
      results.push({ event: title, result: 'PASS' });
      console.log(`✅ PASS: ${title}`);
    } catch {
      results.push({ event: title, result: 'FAIL' });
      console.log(`❌ FAIL: ${title}`);
    }

    // Go back to All Sports
    await page.goto('https://planetsportbet.com/inplay');
    await expect(eventHeaders.first()).toBeVisible({ timeout: 10000 });
  }

  console.log('\\n--- Test Summary ---');
  results.forEach(r => console.log(`${r.result}: ${r.event}`));
});
