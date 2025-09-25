import { test, expect } from '@playwright/test';

test('StarSports – Football Animation Check', async ({ page, context }) => {
  // Longer timeout to iterate many events with per-event caps
  test.setTimeout(10 * 60_000);

  // Helper: accept cookies if shown
  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
  };

  // 1) Go to StarSports homepage and click Football in the left navigation
  await page.goto('https://starsports.bet', { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  // Find the left-hand nav link to Football and click it
  const leftNavFootball = page.locator('a[href="/sport/football"]');
  await leftNavFootball.first().scrollIntoViewIfNeeded().catch(() => {});
  await leftNavFootball.first().click({ timeout: 6000 }).catch(async () => {
    // Fallback: try by text
    await page.getByRole('link', { name: /^Football$/i }).first().click({ timeout: 6000 }).catch(() => {});
  });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(800);
  // Ensure Today tab is selected (next to All)
  try {
    const todayBtn = page.locator('[data-test-filter-key="today"]').first();
    if (await todayBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await todayBtn.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(600);
    }
  } catch {}

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

    // Open event in a separate page to isolate and prevent closing the main list page
    const href = await link.getAttribute('href').catch(() => null);
    if (!href) {
      console.log(`⚠️  Skip: no href for detail page — ${title}`);
      continue;
    }
    const absolute = new URL(href, 'https://starsports.bet').toString();
    const detail = await context.newPage();
    await detail.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {});
    await detail.waitForTimeout(600).catch(() => {});

    // 3) Check for animation widgets
    const animationCheck = async () => {
      // Prefer the specific animated widget container first
      const widgetContainer = detail.locator('.animated_widget');
      try { await widgetContainer.scrollIntoViewIfNeeded(); } catch {}
      let hasAnimLocal = false;

      try {
        await widgetContainer.waitFor({ state: 'visible', timeout: 8_000 });
        const iframe = widgetContainer.locator('iframe');
        await iframe.waitFor({ state: 'visible', timeout: 10_000 });
        // Poll for src to be populated and correct
        const start = Date.now();
        while (Date.now() - start < 8_000 && !hasAnimLocal) {
          const src = await iframe.getAttribute('src').catch(() => null);
          const visible = await iframe.isVisible().catch(() => false);
          if (src && src.includes('widgets.thesports01.com') && visible) {
            hasAnimLocal = true;
            break;
          }
          await detail.waitForTimeout(400).catch(() => {});
        }
      } catch {}

      if (hasAnimLocal) return true;

      // Fallbacks: generic widget ids and expanding Live tracker section
      const sportWidget = detail.locator('[id*="sport-widget"] iframe, [id*="widget"] iframe');
      const sportVisible = await sportWidget.isVisible({ timeout: 3000 }).catch(() => false);
      if (sportVisible) return true;

      const liveTrackerHeading = detail.getByRole('heading', { name: /Live tracker/i }).first();
      await liveTrackerHeading.click({ timeout: 2000 }).catch(() => {});
      // After expanding, retry container path briefly
      try {
        await widgetContainer.waitFor({ state: 'visible', timeout: 4_000 });
        const iframe = widgetContainer.locator('iframe');
        const start2 = Date.now();
        while (Date.now() - start2 < 5_000) {
          const src = await iframe.getAttribute('src').catch(() => null);
          const visible = await iframe.isVisible().catch(() => false);
          if (src && src.includes('widgets.thesports01.com') && visible) return true;
          await detail.waitForTimeout(400).catch(() => {});
        }
      } catch {}
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
    // Close the detail page to return focus to the list (do not navigate the main page)
    try { await detail.close(); } catch {}
    try { await page.bringToFront(); } catch {}
    // Small settle wait; avoid interacting if page got closed unexpectedly
    try { if (!page.isClosed()) await page.waitForTimeout(250); } catch {}

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


