import { test, expect } from '@playwright/test';

// Dragonsport Football Animation Check
// Configure base URL via env DRAGONSPORT_BASE; defaults to dragonbet.co.uk
const DRAGONSPORT_BASE = process.env.DRAGONSPORT_BASE?.replace(/\/$/, '') || 'https://dragonbet.co.uk';

test('Dragonsport – Football Animation Check', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);

  // No skip by default; uses dragonbet.co.uk if env not provided

  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all|Accept all|Accept All/i }).click({ timeout: 3000 }); } catch {}
  };

  // 1) Go to homepage and click Football in left navigation (fallback to direct URL)
  await page.goto(`${DRAGONSPORT_BASE}/`, { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  const leftNavFootball = page.locator('a[href="/sport/football"], a:has-text("Football")');
  const hasLeftNav = await leftNavFootball.first().isVisible({ timeout: 3000 }).catch(() => false);
  if (hasLeftNav) {
    await leftNavFootball.first().scrollIntoViewIfNeeded().catch(() => {});
    await leftNavFootball.first().click({ timeout: 6000 }).catch(() => {});
  } else {
    await page.goto(`${DRAGONSPORT_BASE}/sport/football`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  }
  await page.waitForTimeout(800);

  // 2) Ensure Today tab is selected (fallback to Tomorrow/Weekend)
  const tryClickTab = async (key: string) => {
    const btn = page.locator(`[data-test-filter-key="${key}"]`).first();
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    if (visible) {
      await btn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(600);
      return true;
    }
    // ARIA fallback
    const byRole = page.getByRole('button', { name: new RegExp(`^${key.replace(/-/g, ' ')}$`, 'i') });
    try { await byRole.click({ timeout: 1500 }); await page.waitForTimeout(600); return true; } catch {}
    return false;
  };
  // Only test Today and Tomorrow per requirement
  await tryClickTab('today') || await tryClickTab('tomorrow');

  // 3) Locate football events (rows) and iterate
  const main = page.locator('main, [role="main"], body');
  const getEventRows = async () => {
    // Prefer explicit EventRow containers; links may be nested
    let rows = main.locator('div.css-5ww5z5-EventRowNameContainer');
    let cnt = await rows.count().catch(() => 0);
    if (cnt === 0) {
      rows = main.locator('[class*="EventRow"]');
      cnt = await rows.count().catch(() => 0);
    }
    return { rows, cnt };
  };

  const { rows, cnt } = await getEventRows();
  console.log(`📊 Dragonsport Football rows found (Today): ${cnt}`);
  if (cnt === 0) {
    console.log('ℹ️  No events found on Today tab.');
    return;
  }

  // Cap to at most 30 events to keep runtime fast per requirement
  const maxToTest = Math.min(cnt, 30);
  let pass = 0, fail = 0;

  for (let i = 0; i < maxToTest; i++) {
    // Re-query rows to avoid staleness as DOM updates after navigation
    const { rows: freshRows } = await getEventRows();
    const row = freshRows.nth(i);
    // Prefer anchor text (team names), avoid odds and metadata
    let title = await row.locator('a[href*="/event/"]').first().innerText().catch(() => '');
    if (!title) {
      title = (await row.innerText().catch(() => `Event ${i + 1}`)).trim() || `Event ${i + 1}`;
    }
    console.log(`\n🎯 Testing event ${i + 1}/${maxToTest}: ${title}`);

    // Resolve link to detail
    let href = await row.locator('a[href*="/event/"]').first().getAttribute('href').catch(() => null);
    if (!href) { console.log(`❌ Skip: no href — ${title}`); continue; }

    const absolute = href.startsWith('http') ? href : `${DRAGONSPORT_BASE}${href}`;
    // Click into the event and wait for navigation (faster timeouts)
    await Promise.all([
      page.waitForURL(/\/event\//, { timeout: 6000 }).catch(() => {}),
      row.locator(`a[href="${href}"]`).first().click({ timeout: 4000 }).catch(async () => {
        await page.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 8000 });
      })
    ]);
    try { await page.waitForLoadState('domcontentloaded', { timeout: 4000 }); } catch {}

    // Animation detection on same page
    const detect = async () => {
      const widgetContainer = page.locator('.animated_widget');
      try { await widgetContainer.scrollIntoViewIfNeeded(); } catch {}
      try {
        await widgetContainer.waitFor({ state: 'visible', timeout: 5_000 });
        const iframe = widgetContainer.locator('iframe');
        await iframe.waitFor({ state: 'visible', timeout: 5_000 });
        const start = Date.now();
        while (Date.now() - start < 5_000) {
          const src = await iframe.getAttribute('src').catch(() => null);
          const visible = await iframe.isVisible().catch(() => false);
          if (src && src.includes('widgets.thesports01.com') && visible) return true;
          await page.waitForTimeout(250).catch(() => {});
        }
      } catch {}
      // Generic widget fallback
      const sportWidget = page.locator('[id*="sport-widget"] iframe, [id*="widget"] iframe');
      if (await sportWidget.isVisible({ timeout: 1500 }).catch(() => false)) return true;
      // Try expanding live tracker
      const liveTrackerH4Exact = page.locator('h4[data-test="section-title"][data-test-market-name="market-name"]:has-text("Live tracker")').first();
      const liveTrackerHeading = page.getByRole('heading', { name: /Live tracker/i }).first();
      try {
        await liveTrackerH4Exact.scrollIntoViewIfNeeded();
        await liveTrackerH4Exact.click({ timeout: 1500 });
      } catch {
        await liveTrackerHeading.click({ timeout: 1500 }).catch(() => {});
      }
      try {
        await widgetContainer.waitFor({ state: 'visible', timeout: 3_000 });
        const iframe = widgetContainer.locator('iframe');
        const start2 = Date.now();
        while (Date.now() - start2 < 4_000) {
          const src = await iframe.getAttribute('src').catch(() => null);
          const visible = await iframe.isVisible().catch(() => false);
          if (src && src.includes('widgets.thesports01.com') && visible) return true;
          await page.waitForTimeout(250).catch(() => {});
        }
      } catch {}
      return false;
    };

    let hasAnim = false;
    try {
      hasAnim = await Promise.race([
        detect(),
        new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('EVENT_TIMEOUT')), 10_000))
      ]) as boolean;
    } catch { hasAnim = false; }

    if (hasAnim) { console.log(`✅ PASS: animation detected — ${title}`); pass++; }
    else { console.log(`❌ FAIL: no animation detected — ${title}`); fail++; }

    // Navigate back efficiently and ensure Today tab is active
    try { await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }); } catch {}
    // Ensure we're on Football Today again
    try {
      const todayBtn = page.locator('[data-test-filter-key="today"]').first();
      if (await todayBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await todayBtn.click({ timeout: 1500 }).catch(() => {});
      }
    } catch {}
    try { await page.waitForTimeout(200); } catch {}
  }

  console.log('\n🧪 === DRAGONSPORT – FOOTBALL ANIMATION RESULTS ===');
  console.log(`📊 Total events checked: ${maxToTest}`);
  console.log(`✅ Passed: ${pass}`);
  console.log(`❌ Failed: ${fail}`);
});


