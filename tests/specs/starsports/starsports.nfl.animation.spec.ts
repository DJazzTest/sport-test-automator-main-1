import { test, expect } from '@playwright/test';

test('StarSports – NFL Animation Check', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);

  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
    try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
  };

  await page.goto('https://starsports.bet/', { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  
  console.log('🏈 Navigating to American Football via left-hand side...');
  await page.getByRole('link', { name: 'American Football' }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2000);

  // Check for All/Today/Tomorrow/Weekend tabs (StarSports specific)
  const checkTabVisibility = async (tabName: string): Promise<boolean> => {
    const btn = page.getByRole('button', { name: tabName });
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`✅ Tab visibility – ${tabName}: ${visible}`);
    return visible;
  };

  const allVisible = await checkTabVisibility('All');
  const todayVisible = await checkTabVisibility('Today');
  const tomorrowVisible = await checkTabVisibility('Tomorrow');
  const weekendVisible = await checkTabVisibility('Weekend');

  // Test function for a specific tab
  const testTab = async (tabName: string): Promise<{pass: number, fail: number, results: string[]}> => {
    console.log(`\n🔍 Testing ${tabName} tab...`);
    
    // Click tab (StarSports specific)
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

    // STRICTLY only test events under "US NFL" section - nothing else
    console.log('🔍 Looking for events ONLY under "US NFL" section...');
    
    // Find the US NFL heading using the exact selector you specified
    const usNflHeading = page.locator('h4[data-test="section-title"][data-component="WithConfig"]').filter({ hasText: 'US NFL' });
    const headingVisible = await usNflHeading.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!headingVisible) {
      console.log('ℹ️ US NFL heading not found, no events to test');
      return {pass: 0, fail: 0, results: []};
    }

    // Get the parent container of the US NFL heading to find events within that section only
    const usNflSection = usNflHeading.locator('..');
    
    // Look for events that are specifically under the US NFL section only
    let eventLinks = usNflSection.locator('[data-test="EventRowNameLink-link"]');
    let total = await eventLinks.count().catch(() => 0);
    
    if (total === 0) {
      console.log('🖱️ US NFL section appears collapsed, trying to expand...');
      // Try clicking the US NFL heading to expand it
      await usNflHeading.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(1000);
      // Re-check for events after clicking
      eventLinks = usNflSection.locator('[data-test="EventRowNameLink-link"]');
      total = await eventLinks.count().catch(() => 0);
    } else {
      console.log('✅ US NFL section already expanded, events visible');
    }

    // CRITICAL: Only test events that are directly under the US NFL section
    // This ensures we exclude Canadian Football League, NCAA, and all other sections
    console.log(`🔍 Found ${total} events under US NFL section only`);
    
    // Double-check that we're only getting US NFL events by filtering out any non-NFL events
    if (total > 0) {
      const allEvents = await eventLinks.all();
      let validUsNflEvents = [];
      
      for (const eventLink of allEvents) {
        const eventText = await eventLink.innerText().catch(() => '');
        console.log(`🔍 Checking US NFL event: "${eventText}"`);
        
        // Only include events that are clearly US NFL teams (not CFL, NCAA, etc.)
        if (eventText && 
            eventText.includes(' vs ') &&
            !eventText.includes('Alouettes') && 
            !eventText.includes('Stampeders') &&
            !eventText.includes('Lions') &&
            !eventText.includes('Argonauts') &&
            !eventText.includes('CFL') &&
            !eventText.includes('NCAA') &&
            !eventText.includes('College') &&
            !eventText.includes('Division I') &&
            !eventText.includes('Super Bowl') &&
            !eventText.includes('Conference') &&
            !eventText.includes('Winner') &&
            !eventText.includes('Season Specials')) {
          validUsNflEvents.push(eventLink);
          console.log(`✅ Valid US NFL event: "${eventText}"`);
        } else {
          console.log(`❌ Excluded non-US NFL event: "${eventText}"`);
        }
      }
      
      total = validUsNflEvents.length;
      console.log(`📊 Final count: ${total} US NFL events only (excluded CFL/NCAA)`);
    }

    if (total === 0) {
      console.log(`ℹ️ No events found under US NFL section on ${tabName} tab`);
      return {pass: 0, fail: 0, results: []};
    }

    console.log(`📊 StarSports NFL events found under US NFL section on ${tabName}: ${total}`);
    
    const maxToTest = Math.min(total, 50); // Increased to match PSG NFL testing capacity
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

      // Check for NFL animation widget using the correct selector
      const detect = async () => {
        const widgetContainer = page.locator('#the-americanfootball-sport-widget');
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

      // Navigate back to American Football page
      await page.getByRole('link', { name: 'American Football' }).click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(500);
    }

    console.log(`\n🧪 === NFL (${tabName}) RESULTS ===`);
    console.log(`📊 Total NFL Events Tested: ${maxToTest}`);
    console.log(`✅ Events with Animations (PASS): ${pass}`);
    console.log(`❌ Events without Animations (FAIL): ${fail}`);
    console.log(`\n📋 === DETAILED RESULTS (${tabName}) ===`);
    results.forEach(r => console.log(r));

    return {pass, fail, results};
  };

  // Test All tab first if available (like PSG NFL)
  let allResults = {pass: 0, fail: 0, results: []};
  if (allVisible) {
    allResults = await testTab('All');
  }

  // Test Today tab if available
  let todayResults = {pass: 0, fail: 0, results: []};
  if (todayVisible) {
    // Navigate back to American Football page for next tab
    try {
      await page.goto('https://starsports.bet/');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
      await page.getByRole('link', { name: 'American Football' }).click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log('⚠️ Navigation error, continuing with next tab...');
    }
    todayResults = await testTab('Today');
  }

  // Test Tomorrow tab if available
  let tomorrowResults = {pass: 0, fail: 0, results: []};
  if (tomorrowVisible) {
    // Navigate back to American Football page for next tab
    try {
      await page.goto('https://starsports.bet/');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
      await page.getByRole('link', { name: 'American Football' }).click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log('⚠️ Navigation error, continuing with next tab...');
    }
    tomorrowResults = await testTab('Tomorrow');
  }

  // Test Weekend tab if available
  let weekendResults = {pass: 0, fail: 0, results: []};
  if (weekendVisible) {
    // Navigate back to American Football page for next tab
    try {
      await page.goto('https://starsports.bet/');
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
      await page.getByRole('link', { name: 'American Football' }).click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log('⚠️ Navigation error, continuing with next tab...');
    }
    weekendResults = await testTab('Weekend');
  }

  // Test Anytime tab only if no other tabs are available
  let anytimeResults = {pass: 0, fail: 0, results: []};
  if (!allVisible && !todayVisible && !tomorrowVisible && !weekendVisible) {
    console.log('ℹ️ No All, Today, Tomorrow, or Weekend tabs available, testing Anytime tab...');
    anytimeResults = await testTab('Anytime');
  }

  // Final summary
  const totalPass = allResults.pass + todayResults.pass + tomorrowResults.pass + weekendResults.pass + anytimeResults.pass;
  const totalFail = allResults.fail + todayResults.fail + tomorrowResults.fail + weekendResults.fail + anytimeResults.fail;
  const totalEvents = totalPass + totalFail;

  console.log('\n🏁 === FINAL NFL ANIMATION TEST RESULTS ===');
  console.log(`📊 Total Events Tested: ${totalEvents}`);
  console.log(`✅ Total Passed: ${totalPass}`);
  console.log(`❌ Total Failed: ${totalFail}`);
  if (totalEvents > 0) {
    console.log(`📈 Success Rate: ${Math.round((totalPass / totalEvents) * 100)}%`);
  }
});