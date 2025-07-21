import { test, expect } from '@playwright/test';

test('PlanetSportBet – animation widget check', async ({ page }) => {
  // 1) Land on In Play list
  await page.goto('https://planetsportbet.com/');
  await page.getByRole('button', { name: /Allow all/i }).click();
  await page.locator('[data-test="close-icon"] path').click();
  await page.locator('[data-test="inplay-link"]').click();
  const eventWrappers = page.locator('.css-f5hkhk-EventRowWrapper');
  await expect(eventWrappers.first()).toBeVisible({ timeout: 10_000 });

  const count = await eventWrappers.count();
  console.log(`🧠 Number of In Play events: ${count}`);

  const results: {event: string, result: string}[] = [];
  const indices = count === 15
    ? [0,2,4,6,8,10,14]
    : Array.from({ length: count }, (_, i) => i);

  for (const i of indices) {
    const event = eventWrappers.nth(i);
    let title = `Event index ${i}`;
    try {
      title = await event.locator('.css-1qujoqs-EventRowTitle').innerText();
    } catch {}

    await event.scrollIntoViewIfNeeded();

    // 2) Click and wait for navigation into the event page
    await Promise.all([
      page.waitForURL(/\/event\//, { timeout: 10_000 }),
      event.click()
    ]);

    // 3) Check for animation widget elements
    await page.waitForTimeout(3000); // Wait for page and widgets to load
    
    const animatedWidgetCount = await page.locator('.animated_widget').count();
    
    if (animatedWidgetCount > 0) {
      console.log(`✅ PASS: ${title}`);
    } else {
      console.log(`❌ FAIL: ${title}`);
    }

    results.push({ 
      event: title, 
      result: animatedWidgetCount > 0 ? 'PASS' : 'FAIL'
    });

    // 4) Click In Play link to return to event list
    await page.locator('[data-test="inplay-link"]').click();
    await expect(eventWrappers.first()).toBeVisible({ timeout: 10_000 });
  }

  const passCount = results.filter(r => r.result === 'PASS').length;
  const failCount = results.filter(r => r.result === 'FAIL').length;
  
  console.log(`\n--- ANIMATION RESULTS ---`);
  console.log(`Live events: ${results.length}`);
  console.log(`Live events with animations: ${passCount}`);
  console.log(`Live events without animations: ${failCount}`);
  
  results.forEach(r => {
    console.log(`${r.result}: ${r.event}`);
  });
});
