import { test, expect } from '@playwright/test';

test('StarSports – NFL Animation Check', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);

  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
  };

  // Go to homepage and click American Football from left nav
  await page.goto('https://starsports.bet', { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  const leftNavAmFootball = page.locator('a[href="/sport/americanfootball"]');
  await leftNavAmFootball.first().scrollIntoViewIfNeeded().catch(() => {});
  await leftNavAmFootball.first().click({ timeout: 6000 }).catch(async () => {
    await page.getByRole('link', { name: /American Football/i }).first().click({ timeout: 6000 }).catch(() => {});
  });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(600);
  // Select Today; fallback to Tomorrow then Weekend
  const tryClickTab = async (key: string) => {
    const btn = page.locator(`[data-test-filter-key="${key}"]`).first();
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    if (visible) {
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(600);
      return true;
    }
    return false;
  };
  const main = page.locator('main, [role="main"]');
  const getEventRows = async () => {
    // Prefer explicit EventRowNameContainer per provided class
    let rows = main.locator('div.css-5ww5z5-EventRowNameContainer');
    let cnt = await rows.count().catch(() => 0);
    if (cnt === 0) {
      // Fallbacks: any EventRowNameContainer variant or generic EventRow containers
      rows = main.locator('[class*="EventRowNameContainer"], [class*="EventRow"]');
      cnt = await rows.count().catch(() => 0);
    }
    return { rows, cnt };
  };

  let totalTested = 0;
  let totalPass = 0;
  let totalFail = 0;

  const tabs = ['today', 'tomorrow', 'weekend'] as const;
  for (const key of tabs) {
    const btn = page.locator(`[data-test-filter-key="${key}"]`).first();
    const visible = await btn.isVisible({ timeout: 2500 }).catch(() => false);
    if (!visible) { console.log(`ℹ️  Tab not visible: ${key}`); continue; }
    await btn.click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(1200);
    // Attempt to load more rows by scrolling
    try { for (let s = 0; s < 6; s++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(180); } } catch {}
    // Skip if "no events" message shown
    const noEvents = await page.getByText(/Sorry,? we haven't found any events with such criteria/i).isVisible({ timeout: 1500 }).catch(() => false);
    if (noEvents) { console.log(`ℹ️  No events in ${key} tab; moving on.`); continue; }

    const { rows, cnt } = await getEventRows();
    console.log(`📊 StarSports NFL rows found in ${key}: ${cnt}`);
    const maxToTest = Math.min(cnt, 30);
    for (let i = 0; i < maxToTest; i++) {
      const row = rows.nth(i);
      const title = (await row.innerText().catch(() => `Event ${i + 1}`)).trim() || `Event ${i + 1}`;
      console.log(`\n🎯 Testing (${key}) ${i + 1}/${maxToTest}: ${title}`);

    // Open detail in a new page
      // Try to find a link inside the row; fallback to clicking the row and capturing resulting URL
      let href = await row.locator('a[href^="/event/"]').first().getAttribute('href').catch(() => null);
      if (!href) {
        // As a fallback, click the row in a new page by extracting link via evaluate
        try {
          href = await row.evaluate((el: HTMLElement) => {
            const a = el.querySelector('a[href^="/event/"]') as HTMLAnchorElement | null;
            return a ? a.getAttribute('href') : null;
          });
        } catch {}
      }
      if (!href) { console.log(`⚠️  Skip: no href for detail page — ${title}`); continue; }
      const absolute = new URL(href, 'https://starsports.bet').toString();
      const detail = await context.newPage();
      await detail.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {});
      await detail.waitForTimeout(600).catch(() => {});

    const detect = async () => {
      const container = detail.locator('.animated_widget');
      try { await container.scrollIntoViewIfNeeded(); } catch {}
      try {
        await container.waitFor({ state: 'visible', timeout: 8_000 });
        const iframe = container.locator('iframe');
        await iframe.waitFor({ state: 'visible', timeout: 10_000 });
        const start = Date.now();
        while (Date.now() - start < 8_000) {
          const src = await iframe.getAttribute('src').catch(() => null);
          const visible = await iframe.isVisible().catch(() => false);
          if (src && src.includes('widgets.thesports01.com') && visible) return true;
          await detail.waitForTimeout(400).catch(() => {});
        }
      } catch {}
      const sportWidget = detail.locator('[id*="sport-widget"] iframe, [id*="widget"] iframe');
      if (await sportWidget.isVisible({ timeout: 3000 }).catch(() => false)) return true;
      const liveTrackerHeading = detail.getByRole('heading', { name: /Live tracker/i }).first();
      await liveTrackerHeading.click({ timeout: 2000 }).catch(() => {});
      try {
        await container.waitFor({ state: 'visible', timeout: 4_000 });
        const iframe = container.locator('iframe');
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

      if (hasAnim) { console.log(`✅ PASS: animation detected — ${title}`); totalPass++; }
      else { console.log(`❌ FAIL: no animation detected — ${title}`); totalFail++; }
      totalTested++;

      try { await detail.close(); } catch {}
      try { await page.bringToFront(); } catch {}
      try { if (!page.isClosed()) await page.waitForTimeout(200); } catch {}
    }
  }

  console.log('\n🧪 === STARSPORTS – NFL ANIMATION RESULTS ===');
  console.log(`📊 Total events checked: ${totalTested}`);
  console.log(`✅ Passed: ${totalPass}`);
  console.log(`❌ Failed: ${totalFail}`);
});


