import { test, expect, Page } from '@playwright/test';

async function acceptConsent(page: Page): Promise<void> {
  try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 2500 }); } catch {}
  try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
}

async function detectTennisAnimation(page: Page): Promise<boolean> {
  const container = page.locator('#the-tennis-sport-widget');
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
  return false;
}

test('DragonSport – Tennis Animation Check', async ({ page, context }) => {
  test.setTimeout(8 * 60_000);

  await page.goto('https://dragonbet.co.uk/', { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);

  // Navigate to Tennis
  console.log('🎾 Navigating to Tennis...');
  try { await page.getByRole('link', { name: 'Tennis' }).first().click({ timeout: 4000 }); } catch {}
  await page.waitForTimeout(1500);

  // Tabs prioritization: Today -> Tomorrow -> Anytime -> All
  const tabs = ['Today', 'Tomorrow', 'Anytime', 'All'];
  const visibleTabs: string[] = [];
  for (const t of tabs) {
    const vis = await page.getByRole('button', { name: t }).first().isVisible({ timeout: 1200 }).catch(() => false);
    if (vis) visibleTabs.push(t);
  }

  let pass = 0, fail = 0; const results: string[] = [];

  const testTab = async (tab: string) => {
    console.log(`\n🔍 Testing Tennis – ${tab}`);
    try { await page.getByRole('button', { name: tab }).first().click({ timeout: 1500 }); } catch {}
    await page.waitForTimeout(600);

    const eventLinks = page.locator('[data-test="EventRowNameLink-link"]');
    const total = await eventLinks.count().catch(() => 0);
    if (!total) { console.log('ℹ️ No Tennis events found on this tab'); return; }
    const maxToTest = Math.min(total, 20);

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
      const hasAnim = await detectTennisAnimation(detail);
      if (hasAnim) { pass++; results.push(`PASS: ${title}`); } else { fail++; results.push(`FAIL: ${title}`); }
      await detail.close().catch(() => {});
      await page.bringToFront().catch(() => {});
      await page.waitForTimeout(200);
    }
  };

  for (const tab of (visibleTabs.length ? visibleTabs : tabs)) {
    await testTab(tab);
  }

  console.log(`\n🧪 TENNIS RESULTS — PASS: ${pass} | FAIL: ${fail}`);
  results.forEach(r => console.log(r));
});


