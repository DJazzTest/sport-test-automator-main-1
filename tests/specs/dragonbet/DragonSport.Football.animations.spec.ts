import { test, expect, Page } from '@playwright/test';

async function acceptConsent(page: Page): Promise<void> {
  try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 2500 }); } catch {}
  try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
}

async function detectFootballAnimation(page: Page): Promise<boolean> {
  const candidates = ['#the-football-sport-widget', '#the-soccer-sport-widget'];
  for (const selector of candidates) {
    const container = page.locator(selector);
    try { await container.scrollIntoViewIfNeeded(); } catch {}
    try {
      await container.waitFor({ state: 'visible', timeout: 6_000 });
      const iframe = container.locator('iframe');
      await iframe.waitFor({ state: 'visible', timeout: 6_000 });
      const start = Date.now();
      while (Date.now() - start < 8_000) {
        const src = await iframe.getAttribute('src').catch(() => null);
        const vis = await iframe.isVisible().catch(() => false);
        if (src && /widgets\.thesports01\.com/i.test(src) && vis) return true;
        await page.waitForTimeout(300);
      }
    } catch {}
  }
  return false;
}

test('DragonSport – Football Animation Check', async ({ page, context }) => {
  test.setTimeout(8 * 60_000);

  await page.goto('https://dragonbet.co.uk/', { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);

  // Navigate to Football (left-hand link or search)
  console.log('⚽ Navigating to Football...');
  const goToFootball = async () => {
    try {
      await page.getByRole('link', { name: 'Football' }).first().click({ timeout: 4000 });
    } catch {
      // Fallback: direct URL if present (best effort)
      try { await page.goto('https://dragonbet.co.uk/sport/football', { waitUntil: 'domcontentloaded' }); } catch {}
    }
    await page.waitForTimeout(1500);
  };
  await goToFootball();

  // Tabs prioritization similar to PSG: Today -> Tomorrow -> All
  const tabs = ['Today', 'Tomorrow', 'All'];
  const visibleTabs: string[] = [];
  for (const t of tabs) {
    const vis = await page.getByRole('button', { name: t }).first().isVisible({ timeout: 1200 }).catch(() => false);
    if (vis) visibleTabs.push(t);
  }
  if (!visibleTabs.length) console.log('ℹ️ No prioritized Football tabs visible.');

  let pass = 0, fail = 0;
  const results: string[] = [];

  const testTab = async (tab: string) => {
    console.log(`\n🔍 Testing Football – ${tab}`);
    try { await page.getByRole('button', { name: tab }).first().click({ timeout: 1500 }); } catch {}
    await page.waitForTimeout(600);

    // Event links (same approach as PSG)
    const candidates = [
      '[data-test="EventRowNameLink-link"]',
      'a[href*="/event/"]',
      'a:has-text(" vs ")',
      'a:has-text(" v ")'
    ];
    let eventLinks = page.locator(candidates.join(', '));
    const total = await eventLinks.count().catch(() => 0);
    if (!total) { console.log('ℹ️ No Football events found on this tab'); return; }
    const maxToTest = Math.min(total, 12);

    for (let i = 0; i < maxToTest; i++) {
      const link = eventLinks.nth(i);
      const title = (await link.innerText().catch(() => `Event ${i+1}`)).trim();
      const href = await link.getAttribute('href').catch(() => null);
      if (!href) { results.push(`FAIL: ${title}`); fail++; continue; }

      const detail = await context.newPage();
      await detail.goto(new URL(href, page.url()).toString(), { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
      await acceptConsent(detail);
      await detail.waitForTimeout(400);

      try { await detail.getByRole('heading', { name: /Live tracker/i }).first().click({ timeout: 1200 }); } catch {}
      const hasAnim = await detectFootballAnimation(detail);
      if (hasAnim) { pass++; results.push(`PASS: ${title}`); } else { fail++; results.push(`FAIL: ${title}`); }
      await detail.close().catch(() => {});
      await page.bringToFront().catch(() => {});
      await page.waitForTimeout(200);
    }
  };

  // Run through tabs
  for (const tab of (visibleTabs.length ? visibleTabs : tabs)) {
    await testTab(tab);
  }

  console.log(`\n🧪 FOOTBALL RESULTS — PASS: ${pass} | FAIL: ${fail}`);
  results.forEach(r => console.log(r));
});


