import { test, expect } from '@playwright/test';

test('StarSports – Tennis Animation Check', async ({ page }) => {
  test.setTimeout(10 * 60_000);

  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
  };

  await page.goto('https://starsports.bet', { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  await page.locator('[data-test="inplay-link"]').click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /Tennis/i }).click({ timeout: 4000 }).catch(() => {});
  await acceptCookies();
  await page.waitForTimeout(600);

  const main = page.locator('main, [role="main"], body');
  let eventLinks = main.locator('a[href*="/event/"]');
  let total = await eventLinks.count().catch(() => 0);
  if (total === 0) {
    eventLinks = main.locator('[data-test*="event"] a, [class*="EventRow"] a, a:has-text(" vs "), a:has-text(" v ")');
    total = await eventLinks.count().catch(() => 0);
  }
  console.log(`📊 StarSports Tennis events found: ${total}`);
  expect(total).toBeGreaterThan(0);

  const maxToTest = Math.min(total, 30);
  let pass = 0, fail = 0;

  for (let i = 0; i < maxToTest; i++) {
    const link = eventLinks.nth(i);
    const title = (await link.innerText().catch(() => `Event ${i + 1}`)).trim() || `Event ${i + 1}`;
    console.log(`\n🎯 Testing event ${i + 1}/${maxToTest}: ${title}`);

    let navigated = false;
    try {
      await Promise.all([
        page.waitForURL(/\/event\//, { timeout: 8_000 }),
        link.click({ timeout: 6_000 })
      ]);
      navigated = /\/event\//.test(page.url());
    } catch {}
    if (!navigated) {
      const href = await link.getAttribute('href').catch(() => null);
      if (href) {
        try {
          await page.goto(new URL(href, 'https://starsports.bet').toString(), { waitUntil: 'domcontentloaded', timeout: 10_000 });
          navigated = /\/event\//.test(page.url());
        } catch {}
      }
    }
    if (!navigated) {
      console.log(`⚠️  Skip: could not open detail page — ${title}`);
      await page.goto('https://starsports.bet/inplay', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.getByRole('button', { name: /Tennis/i }).click({ timeout: 2000 }).catch(() => {});
      await acceptCookies();
      await page.waitForTimeout(250);
      continue;
    }

    const detect = async () => {
      const animatedWidget = page.locator('.animated_widget iframe, .animated_widget iframe.iframe-widget');
      const sportWidget = page.locator('[id*="sport-widget"] iframe, [id*="widget"] iframe');
      if (await animatedWidget.isVisible({ timeout: 2000 }).catch(() => false)) return true;
      if (await sportWidget.isVisible({ timeout: 2000 }).catch(() => false)) return true;
      const liveTrackerHeading = page.getByRole('heading', { name: /Live tracker/i }).first();
      await liveTrackerHeading.click({ timeout: 2000 }).catch(() => {});
      const start = Date.now();
      while (Date.now() - start < 6_000) {
        const v1 = await animatedWidget.isVisible({ timeout: 500 }).catch(() => false);
        const v2 = await sportWidget.isVisible({ timeout: 500 }).catch(() => false);
        if (v1 || v2) return true;
      }
      return false;
    };

    let hasAnim = false;
    try {
      hasAnim = await Promise.race([
        detect(),
        new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('EVENT_TIMEOUT')), 18_000))
      ]) as boolean;
    } catch { hasAnim = false; }

    if (hasAnim) { console.log(`✅ PASS: animation detected — ${title}`); pass++; }
    else { console.log(`❌ FAIL: no animation detected — ${title}`); fail++; }

    await page.goto('https://starsports.bet/inplay', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.getByRole('button', { name: /Tennis/i }).click({ timeout: 1500 }).catch(() => {});
    await acceptCookies();
    await page.waitForTimeout(250);
  }

  console.log('\n🧪 === STARSPORTS – TENNIS ANIMATION RESULTS ===');
  console.log(`📊 Total events checked: ${maxToTest}`);
  console.log(`✅ Passed: ${pass}`);
  console.log(`❌ Failed: ${fail}`);
});


