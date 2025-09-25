import { test, expect, Page } from '@playwright/test';

test('PlanetSportBet – Football Animation Check', async ({ page, context }) => {
  // Extend overall timeout to accommodate up to 20 events with navigation
  test.setTimeout(10 * 60_000);
  console.log('🚀 Starting Football Animation Test...');
  
  // 1) Land on PlanetSportBet and handle initial setup (robust like Tennis/Cricket)
  await page.goto('https://planetsportbet.com/');
  const acceptPopups = async (p: Page) => {
    try { await p.getByRole('button', { name: /Allow all/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
    try { await p.locator('[data-test="landing-page"] [data-test="close-icon"] path').click({ timeout: 1500 }); } catch {}
    try {
      const uni = p.locator('[id^="uniccmp"], div:has-text("Accept & Continue")');
      if (await uni.isVisible({ timeout: 1000 }).catch(() => false)) {
        await p.getByRole('button', { name: /Accept/i }).click({ timeout: 1500 }).catch(() => {});
      }
    } catch {}
  };
  await acceptPopups(page);
  
  // 2) Navigate to Football section
  console.log('🏈 Navigating to Football section...');
  // Use left-hand pane navigation under Popular
  await page.locator('[data-test="popular"]').getByRole('link', { name: 'Football' }).click();
  await page.waitForTimeout(2000);
  
  // Verify expected tabs are visible on the Football home (All is usually default)
  const expectedTabs = ['Today', 'Tomorrow', 'UK List', 'European Elite'];
  for (const t of expectedTabs) {
    const visible = await page.getByRole('button', { name: t }).isVisible({ timeout: 1500 }).catch(() => false);
    console.log(`${visible ? '✅' : '⚠️'} Tab visibility – ${t}: ${visible}`);
  }

  // No date filtering: we test events under the active tab only

  // Helper to click a tab if present
  const clickTabIfVisible = async (name: string): Promise<boolean> => {
    const btn = page.getByRole('button', { name }).first();
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) return false;
    await btn.click({ timeout: 2000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    // Scroll to reveal sections/content similar to NFL
    for (let s = 0; s < 3; s++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(200); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    return true;
  };

  // Try Today then Tomorrow; if both tabs are missing or have zero events, fallback to All
  let testedTabs: string[] = [];
  const tryTabsInOrder = ['Today', 'Tomorrow'];
  const tabEventCounts: Record<string, number> = {};
  const ensureFootball = async () => {
    await page.goto('https://planetsportbet.com/sport/football', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
  };

  const testTab = async (tabName: string): Promise<boolean> => {
    await ensureFootball();
    const ok = await clickTabIfVisible(tabName);
    if (!ok) {
      console.log(`ℹ️ ${tabName} tab not available`);
      return false;
    }
    console.log(`🔍 Looking for football events on ${tabName}...`);
    await page.screenshot({ path: `football-page-debug-${tabName}.png` });
    // Robust event selection across sections like NFL
    const main = page.locator('main, [role="main"], body');
    let eventWrappers = main.locator('a[href*="/event/"]:visible');
    let count = await eventWrappers.count().catch(() => 0);
    if (count === 0) {
      eventWrappers = main.locator('[class*="EventRowWrapper"] a[href*="/event/"], [data-test*="EventRow"] a[href*="/event/"]');
      count = await eventWrappers.count().catch(() => 0);
    }
    tabEventCounts[tabName] = count;
    console.log(`⚽ Found ${count} football event links on ${tabName}`);
    if (count === 0) return true; // tab present but no events; continue so caller can decide fallback

    const results: { event: string; result: string }[] = [];
    let tested = 0;
    const maxEvents = 20;

    // Date token filter for Today/Tomorrow to avoid pulling other dates
    const now = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const formatToken = (d: Date) => `${d.getDate()} ${months[d.getMonth()]}`;
    const token = tabName === 'Today'
      ? formatToken(now)
      : tabName === 'Tomorrow'
        ? formatToken(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
        : null;

    for (let i = 0; i < count && tested < maxEvents; i++) {
      // re-query to avoid staleness
      eventWrappers = page.locator('a[href*="/event/"]:visible');
      const event = eventWrappers.nth(i);
      let title = `Football Event ${i + 1}`;
      try { title = (await event.textContent()) || title; } catch {}
      // If Today/Tomorrow, filter by date token present near the link
      if (token) {
        try {
          const nearText = await event.evaluate((el) => {
            const container = el.closest('li,div,article,section');
            return (container ? container.textContent : el.textContent) || '';
          });
          if (!nearText || !nearText.includes(token)) {
            continue;
          }
        } catch {}
      }
      tested++;
      console.log(`\n🎯 Testing ${tabName} ${tested}/${maxEvents}: ${title}`);

      // Open detail in a separate page for stability
      const href = await event.getAttribute('href').catch(() => null);
      if (!href) { results.push({ event: title, result: 'ERROR' }); continue; }
      const absolute = new URL(href, 'https://planetsportbet.com').toString();
      const detail = await context.newPage();
      await detail.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 9000 }).catch(() => {});
      await detail.waitForTimeout(400).catch(() => {});
      await acceptPopups(detail);

      let animPassed = false;
      try {
        const detect = async () => {
          // Ensure content loaded and give network a moment
          await detail.waitForLoadState('domcontentloaded').catch(() => {});
          await detail.waitForTimeout(300).catch(() => {});

          // Try to find the iframe directly first
          let widget = detail.locator('.animated_widget iframe');
          let hasWidget = await widget.isVisible({ timeout: 1200 }).catch(() => false);

          // If not visible, try expanding Live tracker
          if (!hasWidget) {
            const trackerHeading = detail.getByRole('heading', { name: /Live tracker/i }).first();
            await trackerHeading.click({ timeout: 2000 }).catch(() => {});
            await detail.waitForTimeout(400).catch(() => {});
          }

          // Scroll and wait longer for the iframe
          const widgetContainer = detail.locator('.animated_widget');
          try { await widgetContainer.scrollIntoViewIfNeeded(); } catch {}

          // Retry strategy up to ~8s total
          const start = Date.now();
          while (!hasWidget && Date.now() - start < 8000) {
            hasWidget = await widget.isVisible({ timeout: 400 }).catch(() => false);
            if (!hasWidget) {
              // Fallback: look for any matching src directly
              const anyIframe = detail.locator('iframe[src*="widgets.thesports01.com"]');
              if (await anyIframe.isVisible({ timeout: 400 }).catch(() => false)) {
                widget = anyIframe;
                hasWidget = true;
                break;
              }
            }
          }

          if (!hasWidget) return false;

          const src = await widget.getAttribute('src').catch(() => null);
          return !!src && src.includes('widgets.thesports01.com');
        };
        animPassed = await Promise.race([
          detect(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 10000))
        ]);
      } catch {}

      results.push({ event: title, result: animPassed ? 'PASS' : 'FAIL' });
      try { await detail.close(); } catch {}
      await page.bringToFront().catch(() => {});
      await page.waitForTimeout(200).catch(() => {});
    }

    // Report for this tab
    console.log(`\n🧪 === FOOTBALL (${tabName}) RESULTS ===`);
    const passCount = results.filter(r => r.result === 'PASS').length;
    const failCount = results.filter(r => r.result === 'FAIL').length;
    const errorCount = results.filter(r => r.result === 'ERROR').length;
    console.log(`📊 Total Football Events Tested: ${tested}`);
    console.log(`✅ Events with Animations (PASS): ${passCount}`);
    console.log(`❌ Events without Animations (FAIL): ${failCount}`);
    console.log(`🚨 Events with Errors (ERROR): ${errorCount}`);
    console.log(`\n📋 === DETAILED RESULTS (${tabName}) ===`);
    results.forEach(r => console.log(`${r.result}: ${r.event}`));
    return true;
  };

  let anyTabTested = false;
  for (const t of tryTabsInOrder) {
    const did = await testTab(t);
    if (did) { testedTabs.push(t); anyTabTested = true; }
  }

  // Fallback to All if both Today and Tomorrow had zero events (even if tabs existed)
  const todayCount = tabEventCounts['Today'] ?? 0;
  const tomorrowCount = tabEventCounts['Tomorrow'] ?? 0;
  if (!anyTabTested || (todayCount === 0 && tomorrowCount === 0)) {
    console.log('ℹ️ No events on Today/Tomorrow or tabs missing, testing All...');
    await ensureFootball();
    await clickTabIfVisible('All');
    await testTab('All');
  }
  
  console.log('\n🏁 Football Animation Test completed!');
});
