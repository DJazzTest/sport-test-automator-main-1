import { test, expect } from '@playwright/test';

test('StarSports – Cricket Animation Check', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);

  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
  };

  // 1) Go to homepage and click Cricket from left-hand navigation
  await page.goto('https://starsports.bet', { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  const leftNavCricket = page.locator('a[href="/sport/cricket"]');
  await leftNavCricket.first().scrollIntoViewIfNeeded().catch(() => {});
  await leftNavCricket.first().click({ timeout: 6000 }).catch(async () => {
    await page.getByRole('link', { name: /^Cricket$/i }).first().click({ timeout: 6000 }).catch(() => {});
  });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(600);
  // Ensure Today tab is selected
  try {
    const todayBtn = page.locator('[data-test-filter-key="today"]').first();
    if (await todayBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      await todayBtn.click({ timeout: 2500 }).catch(() => {});
      await page.waitForTimeout(600);
    }
  } catch {}

  const main = page.locator('main, [role="main"], body');
  let eventLinks = main.locator('a[href*="/event/"]');
  let total = await eventLinks.count().catch(() => 0);
  if (total === 0) {
    eventLinks = main.locator('[data-test*="event"] a, [class*="EventRow"] a, a:has-text(" vs "), a:has-text(" v ")');
    total = await eventLinks.count().catch(() => 0);
  }
  console.log(`📊 StarSports Cricket events found: ${total}`);
  expect(total).toBeGreaterThan(0);

  const maxToTest = Math.min(total, 30);
  let pass = 0, fail = 0;

  for (let i = 0; i < maxToTest; i++) {
    const link = eventLinks.nth(i);
    const title = (await link.innerText().catch(() => `Event ${i + 1}`)).trim() || `Event ${i + 1}`;
    console.log(`\n🎯 Testing event ${i + 1}/${maxToTest}: ${title}`);

    // Open detail in a separate page to keep main list stable
    const href = await link.getAttribute('href').catch(() => null);
    if (!href) {
      console.log(`⚠️  Skip: no href for detail page — ${title}`);
      continue;
    }
    const absolute = new URL(href, 'https://starsports.bet').toString();
    const detail = await context.newPage();
    await detail.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {});
    await detail.waitForTimeout(600).catch(() => {});

    // Detect animation: prefer .animated_widget iframe with correct src
    const detect = async () => {
      const widgetContainer = detail.locator('.animated_widget');
      try { await widgetContainer.scrollIntoViewIfNeeded(); } catch {}
      let ok = false;
      try {
        await widgetContainer.waitFor({ state: 'visible', timeout: 8_000 });
        const iframe = widgetContainer.locator('iframe');
        await iframe.waitFor({ state: 'visible', timeout: 10_000 });
        const start = Date.now();
        while (Date.now() - start < 8_000 && !ok) {
          const src = await iframe.getAttribute('src').catch(() => null);
          const visible = await iframe.isVisible().catch(() => false);
          if (src && src.includes('widgets.thesports01.com') && visible) { ok = true; break; }
          await detail.waitForTimeout(400).catch(() => {});
        }
      } catch {}
      if (ok) return true;
      const sportWidget = detail.locator('[id*="sport-widget"] iframe, [id*="widget"] iframe');
      if (await sportWidget.isVisible({ timeout: 3000 }).catch(() => false)) return true;
      const liveTrackerHeading = detail.getByRole('heading', { name: /Live tracker/i }).first();
      await liveTrackerHeading.click({ timeout: 2000 }).catch(() => {});
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
        detect(),
        new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('EVENT_TIMEOUT')), 20_000))
      ]) as boolean;
    } catch { hasAnim = false; }

    if (hasAnim) { console.log(`✅ PASS: animation detected — ${title}`); pass++; }
    else { console.log(`❌ FAIL: no animation detected — ${title}`); fail++; }

    // Close detail and continue; main page remains on Cricket Today
    try { await detail.close(); } catch {}
    try { await page.bringToFront(); } catch {}
    try { if (!page.isClosed()) await page.waitForTimeout(200); } catch {}
  }

  console.log('\n🧪 === STARSPORTS – CRICKET ANIMATION RESULTS ===');
  console.log(`📊 Total events checked: ${maxToTest}`);
  console.log(`✅ Passed: ${pass}`);
  console.log(`❌ Failed: ${fail}`);
});


