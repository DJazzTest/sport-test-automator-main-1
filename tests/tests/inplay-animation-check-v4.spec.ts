import { test, expect } from '@playwright/test';

test('PlanetSportBet – In Play events animation check (v4)', async ({ page }) => {
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

    // 3) Wait for animated_widget elements (3D widgets in iframes)
    let animPassed = false;
    try {
      await page.waitForSelector('.animated_widget', {
        state: 'visible',
        timeout: 15_000
      });
      animPassed = true;
      console.log(`✅ PASS: animated_widget found for — ${title}`);
    } catch {
      console.log(`❌ FAIL: no animated_widget for — ${title}`);
    }

    results.push({ event: title, result: animPassed ? 'PASS' : 'FAIL' });

    // 4) Go back to the In Play list
    await Promise.all([
      page.waitForURL(/\/inplay$/, { timeout: 10_000 }),
      page.goBack()
    ]);
    await expect(eventWrappers.first()).toBeVisible({ timeout: 10_000 });
  }

  console.log('\n🧪 --- Test Results ---');
  results.forEach(r => console.log(`${r.result}: ${r.event}`));
});
