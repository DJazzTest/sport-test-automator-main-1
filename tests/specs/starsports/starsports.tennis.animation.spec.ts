import { test, expect } from '@playwright/test';

test('StarSports – Tennis Animation Check', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);

  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
    try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
  };

  await page.goto('https://starsports.bet', { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  
  console.log('🎾 Navigating to Tennis via left-hand side...');
  // Left nav Tennis - try multiple selectors
  const leftNavTennis = page.locator('a[href="/sport/tennis"]');
  await leftNavTennis.first().scrollIntoViewIfNeeded().catch(() => {});
  await leftNavTennis.first().click({ timeout: 6000 }).catch(async () => {
    await page.getByRole('link', { name: /^Tennis$/i }).first().click({ timeout: 6000 }).catch(() => {});
  });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(600);

  // Check for Today/Tomorrow tabs first
  const checkTabVisibility = async (tabName: string): Promise<boolean> => {
    const btn = page.locator(`[data-test-filter-key="${tabName}"]`).first();
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`✅ Tab visibility – ${tabName}: ${visible}`);
    return visible;
  };

  const todayVisible = await checkTabVisibility('today');
  const tomorrowVisible = await checkTabVisibility('tomorrow');
  const weekendVisible = await checkTabVisibility('weekend');

  // Test function for a specific tab
  const testTab = async (tabName: string): Promise<{pass: number, fail: number, results: string[]}> => {
    console.log(`\n🔍 Testing ${tabName} tab...`);
    
    // Click tab if visible
    if (tabName !== 'All') {
      const btn = page.locator(`[data-test-filter-key="${tabName}"]`).first();
      const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) {
        await btn.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(600);
      } else {
        console.log(`ℹ️ ${tabName} tab not visible, skipping...`);
        return {pass: 0, fail: 0, results: []};
      }
    }

    // Find event links - filter out CMP/privacy links
    const main = page.locator('main, [role="main"], body');
    let eventLinks = main.locator('a[href*="/event/"]');
    let total = await eventLinks.count().catch(() => 0);
    
    // Filter out non-event links
    if (total > 0) {
      const filteredLinks = [];
      for (let i = 0; i < total; i++) {
        const link = eventLinks.nth(i);
        const text = await link.innerText().catch(() => '');
        const href = await link.getAttribute('href').catch(() => '');
        
        // Skip CMP/privacy links
        if (text.includes('#IAB') || text.includes('Privacy') || text.includes('Learn more') || 
            text.includes('Settings') || !href.includes('/event/')) {
          continue;
        }
        filteredLinks.push(link);
      }
      eventLinks = page.locator('a[href*="/event/"]').filter(async (el) => {
        const text = await el.innerText().catch(() => '');
        return !text.includes('#IAB') && !text.includes('Privacy') && !text.includes('Learn more') && !text.includes('Settings');
      });
      total = await eventLinks.count().catch(() => 0);
    }

    if (total === 0) {
      console.log(`ℹ️ No tennis events found on ${tabName} tab`);
      return {pass: 0, fail: 0, results: []};
    }

    console.log(`📊 StarSports Tennis events found on ${tabName}: ${total}`);
    
    const maxToTest = Math.min(total, 20);
    let pass = 0, fail = 0;
    const results: string[] = [];

    for (let i = 0; i < maxToTest; i++) {
      const link = eventLinks.nth(i);
      const title = (await link.innerText().catch(() => `Event ${i + 1}`)).trim() || `Event ${i + 1}`;
      console.log(`\n🎯 Testing ${tabName} ${i + 1}/${maxToTest}: ${title}`);

      const href = await link.getAttribute('href').catch(() => null);
      if (!href) { 
        console.log(`⚠️ Skip: no href — ${title}`); 
        results.push(`FAIL: ${title}`);
        fail++;
        continue; 
      }
      
      const absolute = new URL(href, 'https://starsports.bet').toString();
      const detail = await context.newPage();
      await detail.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {});
      await detail.waitForTimeout(600).catch(() => {});
      await acceptCookies();

      const detect = async () => {
        const widgetContainer = detail.locator('.animated_widget');
        try { await widgetContainer.scrollIntoViewIfNeeded(); } catch {}
        try {
          await widgetContainer.waitFor({ state: 'visible', timeout: 8_000 });
          const iframe = widgetContainer.locator('iframe');
          await iframe.waitFor({ state: 'visible', timeout: 10_000 });
          const start = Date.now();
          while (Date.now() - start < 8_000) {
            const src = await iframe.getAttribute('src').catch(() => null);
            const visible = await iframe.isVisible().catch(() => false);
            if (src && src.includes('widgets.thesports01.com') && visible) return true;
            await detail.waitForTimeout(400).catch(() => {});
          }
        } catch {}
        
        // Try Live tracker if not found
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

      if (hasAnim) { 
        console.log(`✅ PASS: animation detected — ${title}`); 
        pass++; 
        results.push(`PASS: ${title}`);
      } else { 
        console.log(`❌ FAIL: no animation detected — ${title}`); 
        fail++; 
        results.push(`FAIL: ${title}`);
      }

      try { await detail.close(); } catch {}
      try { await page.bringToFront(); } catch {}
      try { if (!page.isClosed()) await page.waitForTimeout(200); } catch {}
    }

    console.log(`\n🧪 === TENNIS (${tabName}) RESULTS ===`);
    console.log(`📊 Total Tennis Events Tested: ${maxToTest}`);
    console.log(`✅ Events with Animations (PASS): ${pass}`);
    console.log(`❌ Events without Animations (FAIL): ${fail}`);
    console.log(`\n📋 === DETAILED RESULTS (${tabName}) ===`);
    results.forEach(r => console.log(r));

    return {pass, fail, results};
  };

  // Test Today tab if available
  let todayResults = {pass: 0, fail: 0, results: []};
  if (todayVisible) {
    todayResults = await testTab('Today');
  }

  // Test Tomorrow tab if available
  let tomorrowResults = {pass: 0, fail: 0, results: []};
  if (tomorrowVisible) {
    tomorrowResults = await testTab('Tomorrow');
  }

  // Test All tab if no Today/Tomorrow or if both had no events
  let allResults = {pass: 0, fail: 0, results: []};
  if ((!todayVisible && !tomorrowVisible) || (todayResults.pass + todayResults.fail === 0 && tomorrowResults.pass + tomorrowResults.fail === 0)) {
    allResults = await testTab('All');
  }

  // Final summary
  const totalPass = todayResults.pass + tomorrowResults.pass + allResults.pass;
  const totalFail = todayResults.fail + tomorrowResults.fail + allResults.fail;
  const totalEvents = totalPass + totalFail;

  console.log('\n🏁 === FINAL TENNIS ANIMATION TEST RESULTS ===');
  console.log(`📊 Total Events Tested: ${totalEvents}`);
  console.log(`✅ Total Passed: ${totalPass}`);
  console.log(`❌ Total Failed: ${totalFail}`);
  if (totalEvents > 0) {
    console.log(`📈 Success Rate: ${Math.round((totalPass / totalEvents) * 100)}%`);
  }
});


