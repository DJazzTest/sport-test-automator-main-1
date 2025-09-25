import { test, expect } from '@playwright/test';

test('StarSports – Cricket Animation Check', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);

  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
    try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
  };

  await page.goto('https://starsports.bet/', { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  
  console.log('🏏 Navigating to Cricket via left-hand side...');
  await page.getByRole('link', { name: 'Cricket' }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2000);

  // Take a screenshot for debugging
  await page.screenshot({ path: 'starsports-cricket-debug.png' });
  console.log('📸 Screenshot saved as starsports-cricket-debug.png');

  // Debug: Check what buttons are available
  const allButtons = await page.locator('button').all();
  console.log('🔍 Available buttons:', await Promise.all(allButtons.map(async btn => {
    const text = await btn.innerText().catch(() => '');
    return text.trim();
  })).then(texts => texts.filter(t => t && t.length > 0).slice(0, 20)));

  // Check for Today/Tomorrow tabs
  const checkTabVisibility = async (tabName: string): Promise<boolean> => {
    const btn = page.getByRole('button', { name: tabName });
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`✅ Tab visibility – ${tabName}: ${visible}`);
    return visible;
  };

  const todayVisible = await checkTabVisibility('Today');
  const tomorrowVisible = await checkTabVisibility('Tomorrow');

  // Test function for a specific tab
  const testTab = async (tabName: string): Promise<{pass: number, fail: number, results: string[]}> => {
    console.log(`\n🔍 Testing ${tabName} tab...`);
    
    // Click tab if not Anytime (which is already active by default)
    if (tabName !== 'Anytime') {
      const btn = page.getByRole('button', { name: tabName });
      const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) {
        console.log(`🖱️ Clicking ${tabName} tab...`);
        await btn.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(800);
      } else {
        console.log(`ℹ️ ${tabName} tab not visible, skipping...`);
        return {pass: 0, fail: 0, results: []};
      }
    }

    // Find event links using the correct selector
    const eventLinks = page.locator('[data-test="EventRowNameLink-link"]');
    const total = await eventLinks.count().catch(() => 0);

    // Debug: Check for other possible event selectors
    if (total === 0) {
      console.log(`🔍 No events found with [data-test="EventRowNameLink-link"], trying other selectors...`);
      
      const altSelectors = [
        'a[href*="/event/"]',
        '[data-test*="event"] a',
        'a:has-text(" vs ")',
        'a:has-text(" v ")'
      ];
      
      for (const selector of altSelectors) {
        const altLinks = page.locator(selector);
        const altCount = await altLinks.count().catch(() => 0);
        console.log(`🔍 Selector "${selector}": ${altCount} links found`);
        if (altCount > 0) {
          const sampleTexts = await Promise.all(Array.from({length: Math.min(3, altCount)}, (_, i) => 
            altLinks.nth(i).innerText().catch(() => '')
          ));
          console.log(`🔍 Sample texts:`, sampleTexts);
        }
      }
    }

    if (total === 0) {
      console.log(`ℹ️ No cricket events found on ${tabName} tab`);
      return {pass: 0, fail: 0, results: []};
    }

    console.log(`📊 StarSports Cricket events found on ${tabName}: ${total}`);
    
    const maxToTest = Math.min(total, 20);
    let pass = 0, fail = 0;
    const results: string[] = [];

    for (let i = 0; i < maxToTest; i++) {
      const link = eventLinks.nth(i);
      const title = (await link.innerText().catch(() => `Event ${i + 1}`)).trim() || `Event ${i + 1}`;
      console.log(`\n🎯 Testing ${tabName} ${i + 1}/${maxToTest}: ${title}`);

      // Click the event link
      await link.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);

      // Look for Live tracker and click it
      const liveTracker = page.getByRole('heading', { name: 'Live tracker' });
      const trackerVisible = await liveTracker.isVisible({ timeout: 3000 }).catch(() => false);
      if (trackerVisible) {
        console.log('🖱️ Clicking Live tracker...');
        await liveTracker.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(1000);
      }

      // Check for animation widget
      const detect = async () => {
        const widgetContainer = page.locator('#the-cricket-sport-widget');
        try { 
          await widgetContainer.scrollIntoViewIfNeeded(); 
          await widgetContainer.waitFor({ state: 'visible', timeout: 5000 });
          
          const iframe = widgetContainer.locator('iframe');
          await iframe.waitFor({ state: 'visible', timeout: 5000 });
          
          const start = Date.now();
          while (Date.now() - start < 8000) {
            const src = await iframe.getAttribute('src').catch(() => null);
            const visible = await iframe.isVisible().catch(() => false);
            if (src && src.includes('widgets.thesports01.com') && visible) return true;
            await page.waitForTimeout(400).catch(() => {});
          }
        } catch {}
        return false;
      };

      let hasAnim = false;
      try {
        hasAnim = await Promise.race([
          detect(),
          new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('EVENT_TIMEOUT')), 15000))
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

      // Navigate back to cricket page
      await page.getByRole('link', { name: 'Cricket' }).click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(500);
    }

    console.log(`\n🧪 === CRICKET (${tabName}) RESULTS ===`);
    console.log(`📊 Total Cricket Events Tested: ${maxToTest}`);
    console.log(`✅ Events with Animations (PASS): ${pass}`);
    console.log(`❌ Events without Animations (FAIL): ${fail}`);
    console.log(`\n📋 === DETAILED RESULTS (${tabName}) ===`);
    results.forEach(r => console.log(r));

    return {pass, fail, results};
  };

  // Test Today tab first if available
  let todayResults = {pass: 0, fail: 0, results: []};
  if (todayVisible) {
    todayResults = await testTab('Today');
  }

  // Test Tomorrow tab if available
  let tomorrowResults = {pass: 0, fail: 0, results: []};
  if (tomorrowVisible) {
    tomorrowResults = await testTab('Tomorrow');
  }

  // Test Anytime tab only if no Today/Tomorrow tabs are available
  let anytimeResults = {pass: 0, fail: 0, results: []};
  if (!todayVisible && !tomorrowVisible) {
    console.log('ℹ️ No Today or Tomorrow tabs available, testing Anytime tab...');
    anytimeResults = await testTab('Anytime');
  }

  // Final summary
  const totalPass = todayResults.pass + tomorrowResults.pass + anytimeResults.pass;
  const totalFail = todayResults.fail + tomorrowResults.fail + anytimeResults.fail;
  const totalEvents = totalPass + totalFail;

  console.log('\n🏁 === FINAL CRICKET ANIMATION TEST RESULTS ===');
  console.log(`📊 Total Events Tested: ${totalEvents}`);
  console.log(`✅ Total Passed: ${totalPass}`);
  console.log(`❌ Total Failed: ${totalFail}`);
  if (totalEvents > 0) {
    console.log(`📈 Success Rate: ${Math.round((totalPass / totalEvents) * 100)}%`);
  }
});