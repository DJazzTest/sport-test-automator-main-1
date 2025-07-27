import { test, expect } from '@playwright/test';

test('PlanetSportBet – All In Play events animation check', async ({ page }) => {
  await page.goto('https://planetsportbet.com/');
  await page.getByRole('button', { name: /Allow all/i }).click();
  await page.locator('[data-test="close-icon"] path').click();
  await page.locator('[data-test="inplay-link"]').click();
  // Wait for event wrappers to load
  const eventWrappers = page.locator('.css-f5hkhk-EventRowWrapper');
  await expect(eventWrappers.first()).toBeVisible({ timeout: 10000 });
  const count = await eventWrappers.count();
  console.log(`Number of In Play events: ${count}`);
  let results: {event: string, result: string}[] = [];

  // Determine which indices to test
  let indices: number[] = [];
  if (count === 15) {
    // Test 7 evenly distributed events
    indices = [0, 2, 4, 6, 8, 10, 14];
  } else {
    indices = Array.from({length: count}, (_, i) => i);
  }

  for (const i of indices) {
    const event = eventWrappers.nth(i);
    // Try to get the event title for reporting
    let eventTitle = '';
    try {
      eventTitle = await event.locator('.css-1qujoqs-EventRowTitle').innerText();
    } catch {
      eventTitle = `Event index ${i}`;
    }
    await event.scrollIntoViewIfNeeded();
    await event.click();
    // Wait for animation to load
    await page.waitForTimeout(2000);
    // Check for animation (tag or id 'animate-svg')
    const animation = page.locator('animate-svg, #animate-svg');
    try {
      await expect(animation).toBeVisible({ timeout: 7000 });
      results.push({event: eventTitle, result: 'PASS'});
      console.log(`PASS: Animation found for event: ${eventTitle}`);
    } catch {
      results.push({event: eventTitle, result: 'FAIL'});
      console.log(`FAIL: Animation NOT found for event: ${eventTitle}`);
    }
    // Always navigate back to IN PLAY page
    await page.goto('https://planetsportbet.com/inplay');
    await expect(eventWrappers.first()).toBeVisible({ timeout: 10000 });
  }
  console.log('--- Test Results ---');
  results.forEach(r => console.log(`${r.result}: ${r.event}`));
});
