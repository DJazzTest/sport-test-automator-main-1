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
    
    // Scroll down to find the US NFL section (as you mentioned it's further down)
    console.log('📜 Scrolling down to find US NFL section...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    
    // Find the US NFL heading using the correct selector
    const usNflHeading = page.getByRole('heading', { name: 'US NFL' });
    const headingVisible = await usNflHeading.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!headingVisible) {
      console.log('ℹ️ US NFL heading not found after scrolling, no events to test');
      return {pass: 0, fail: 0, results: []};
    }
    
    console.log('✅ US NFL heading found after scrolling');

    // Click the US NFL heading twice to expand it (as per your steps)
    console.log('🖱️ Clicking US NFL heading to expand...');
    await usNflHeading.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await usNflHeading.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(1000);
    
    // Look for NFL team event links directly (like Pittsburgh Steelers, Atlanta Falcons, etc.)
    let eventLinks = page.locator('a[href*="/event/"]:has-text("Steelers"), a[href*="/event/"]:has-text("Falcons"), a[href*="/event/"]:has-text("Bills"), a[href*="/event/"]:has-text("Cowboys"), a[href*="/event/"]:has-text("Commanders"), a[href*="/event/"]:has-text("Saints"), a[href*="/event/"]:has-text("Lions"), a[href*="/event/"]:has-text("Browns"), a[href*="/event/"]:has-text("Texans"), a[href*="/event/"]:has-text("Titans"), a[href*="/event/"]:has-text("Patriots"), a[href*="/event/"]:has-text("Panthers"), a[href*="/event/"]:has-text("Giants"), a[href*="/event/"]:has-text("Chargers"), a[href*="/event/"]:has-text("Buccaneers"), a[href*="/event/"]:has-text("Eagles"), a[href*="/event/"]:has-text("Rams"), a[href*="/event/"]:has-text("Colts"), a[href*="/event/"]:has-text("49ers"), a[href*="/event/"]:has-text("Jaguars"), a[href*="/event/"]:has-text("Chiefs"), a[href*="/event/"]:has-text("Ravens"), a[href*="/event/"]:has-text("Raiders"), a[href*="/event/"]:has-text("Bears")');
    let total = await eventLinks.count().catch(() => 0);
    
    if (total === 0) {
      // Try broader NFL team patterns
      eventLinks = page.locator('a[href*="/event/"]').filter({ hasText: /(Steelers|Falcons|Bills|Cowboys|Commanders|Saints|Lions|Browns|Texans|Titans|Patriots|Panthers|Giants|Chargers|Buccaneers|Eagles|Rams|Colts|49ers|Jaguars|Chiefs|Ravens|Raiders|Bears)/i });
      total = await eventLinks.count().catch(() => 0);
      console.log(`🔍 After trying broader NFL team patterns: ${total} events found`);
    }
    
    console.log(`🔍 Found ${total} NFL team events`);

    // Test the NFL events we found
    console.log(`🔍 Found ${total} NFL team events to test`);

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
        const widgetContainer = page.locator('#the-americanfootball-sport-widget iframe');
        try { 
          await widgetContainer.scrollIntoViewIfNeeded(); 
          await widgetContainer.waitFor({ state: 'visible', timeout: 5000 });
          
          const start = Date.now();
          while (Date.now() - start < 8000) {
            const src = await widgetContainer.getAttribute('src').catch(() => null);
            const visible = await widgetContainer.isVisible().catch(() => false);
            if (src && src.includes('thesports01.com') && visible) {
              return true;
            }
            await page.waitForTimeout(400).catch(() => {});
          }
        } catch (error) {
          // Animation detection failed
        }
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
      console.log('❌ Navigation error, continuing with next tab...');
      console.log('   📋 Steps to recreate:');
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log('      2. Try to navigate to the next tab');
      console.log('      3. Expected: Tab should switch successfully');
      console.log('      4. Actual: Navigation failed');
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
      console.log('❌ Navigation error, continuing with next tab...');
      console.log('   📋 Steps to recreate:');
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log('      2. Try to navigate to the next tab');
      console.log('      3. Expected: Tab should switch successfully');
      console.log('      4. Actual: Navigation failed');
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
      console.log('❌ Navigation error, continuing with next tab...');
      console.log('   📋 Steps to recreate:');
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log('      2. Try to navigate to the next tab');
      console.log('      3. Expected: Tab should switch successfully');
      console.log('      4. Actual: Navigation failed');
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