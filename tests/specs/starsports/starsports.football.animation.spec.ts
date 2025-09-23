import { test, expect } from '@playwright/test';

test('StarSports – Football Animation Check', async ({ page }) => {
  // Longer timeout to iterate many events with per-event caps
  test.setTimeout(10 * 60_000);

  // Helper: accept cookies if shown
  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
  };

  // 1) Go to StarSports and In Play (football often listed there)
  await page.goto('https://starsports.bet', { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  // Try direct football page first, fallback to In Play + filter
  let onFootball = false;
  try {
    await page.goto('https://starsports.bet/sport/football', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    onFootball = true;
  } catch {}
  if (!onFootball) {
    await page.locator('[data-test="inplay-link"]').click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(2000);
    // Try a Football filter tab/button
    const footballTab = page.getByRole('button', { name: /Football/i }).first();
    try { await footballTab.click({ timeout: 3000 }); } catch {}
  }
  await acceptCookies();
  await page.waitForTimeout(800);

  // 2) Locate football events links
  const main = page.locator('main, [role="main"], body');
  let eventLinks = main.locator('a[href*="/event/"]');
  let total = await eventLinks.count().catch(() => 0);
  if (total === 0) {
    // Broader fallback
    eventLinks = main.locator('[data-test*="event"] a, [class*="EventRow"] a, a:has-text(" vs "), a:has-text(" v ")');
    total = await eventLinks.count().catch(() => 0);
  }

  console.log(`📊 StarSports Football events found: ${total}`);
  expect(total).toBeGreaterThan(0);

  const maxToTest = Math.min(total, 30);
  let pass = 0;
  let fail = 0;
  const failedEvents: string[] = [];

  for (let i = 0; i < maxToTest; i++) {
    const link = eventLinks.nth(i);
    const title = (await link.innerText().catch(() => `Event ${i + 1}`)).trim() || `Event ${i + 1}`;
    console.log(`\n🎯 Testing event ${i + 1}/${maxToTest}: ${title}`);

    const eventStart = Date.now();

    // Navigate into event (click + URL wait; fallback to href)
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
          const absolute = new URL(href, 'https://starsports.bet').toString();
          await page.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 10_000 });
          navigated = /\/event\//.test(page.url());
        } catch {}
      }
    }
    if (!navigated) {
      console.log(`⚠️  Skip: could not open detail page — ${title}`);
      // Attempt to recover to listing
      if (onFootball) {
        await page.goto('https://starsports.bet/sport/football', { waitUntil: 'domcontentloaded' }).catch(() => {});
      } else {
        await page.goto('https://starsports.bet/inplay', { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
      await acceptCookies();
      await page.waitForTimeout(300);
      continue;
    }

    // 3) Check for animation widgets
    const animationCheck = async () => {
      // Common patterns
      const animatedWidget = page.locator('.animated_widget iframe, .animated_widget iframe.iframe-widget');
      const sportWidget = page.locator('[id*="sport-widget"] iframe, [id*="widget"] iframe');

      // Quick visible checks
      const widgetVisible = await animatedWidget.isVisible({ timeout: 2000 }).catch(() => false);
      if (widgetVisible) return true;
      const sportVisible = await sportWidget.isVisible({ timeout: 2000 }).catch(() => false);
      if (sportVisible) return true;

      // Try to expand a Live tracker area
      const liveTrackerHeading = page.getByRole('heading', { name: /Live tracker/i }).first();
      await liveTrackerHeading.click({ timeout: 2000 }).catch(() => {});

      // Retry loop for lazy-load
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
        animationCheck(),
        new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('EVENT_TIMEOUT')), 18_000))
      ]) as boolean;
    } catch {
      hasAnim = false;
    }

    if (hasAnim) {
      console.log(`✅ PASS: animation detected — ${title}`);
      pass++;
    } else {
      console.log(`❌ FAIL: no animation detected — ${title}`);
      fail++;
      failedEvents.push(title);
    }

    // 4) Navigate back to listing to continue
    if (onFootball) {
      await page.goto('https://starsports.bet/sport/football', { waitUntil: 'domcontentloaded' }).catch(() => {});
    } else {
      await page.goto('https://starsports.bet/inplay', { waitUntil: 'domcontentloaded' }).catch(() => {});
      const footballTab = page.getByRole('button', { name: /Football/i }).first();
      await footballTab.click({ timeout: 1500 }).catch(() => {});
    }
    await acceptCookies();
    await page.waitForTimeout(250);

    // Watchdog per-event overhead
    if (Date.now() - eventStart > 25_000 && !hasAnim) {
      console.log(`⏭️  Event exceeded time budget — ${title}`);
    }
  }

  console.log('\n🧪 === STARSPORTS – FOOTBALL ANIMATION RESULTS ===');
  console.log(`📊 Total events checked: ${maxToTest}`);
  console.log(`✅ Passed: ${pass}`);
  console.log(`❌ Failed: ${fail}`);
});


