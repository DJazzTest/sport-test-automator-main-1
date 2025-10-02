import { test, expect } from '@playwright/test';

test('PlanetSportBet – Tennis Animation Check', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);

  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
    try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
    try { await page.locator('[data-test="landing-page"] [data-test="close-icon"]').click({ timeout: 1500 }); } catch {}
  };

  await page.goto('https://planetsportbet.com/', { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  
  console.log('🎾 Navigating to Tennis via left-hand side...');
  await page.getByRole('link', { name: 'Tennis', exact: true }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2000);

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
    
    // Click tab if not All (which is already active by default)
    if (tabName !== 'All') {
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

    // Find event links using the same pattern as StarSports
    const eventLinks = page.locator('a[href*="/event/"]');
    const total = await eventLinks.count().catch(() => 0);

    if (total === 0) {
      console.log(`ℹ️ No tennis events found on ${tabName} tab`);
      return {pass: 0, fail: 0, results: []};
    }

    console.log(`📊 PSG Tennis events found on ${tabName}: ${total}`);
    
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

      // Check if Live tracker is already open by looking for animation elements
      let hasAnimation = false;
      
      // First check for existing animation elements
      const existingWidget = page.locator('.animated_widget iframe, #the-tennis-sport-widget iframe, .animate-svg');
      hasAnimation = await existingWidget.isVisible({ timeout: 1000 }).catch(() => false);
      
      // Also check for YouTube iframes
      const youtubeIframe = page.locator('iframe[src*="youtube.com/embed"]');
      const hasYouTube = await youtubeIframe.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (hasYouTube) {
        console.log(`📺 YouTube iframe detected: ${await youtubeIframe.getAttribute('src').catch(() => 'unknown')}`);
        hasAnimation = true;
      }

      // If no animation found, try to open Live tracker
      if (!hasAnimation) {
        console.log('🖱️ Live tracker not open, clicking to open...');
        const liveTracker = page.getByRole('heading', { name: 'Live tracker' });
        const trackerVisible = await liveTracker.isVisible({ timeout: 3000 }).catch(() => false);
        if (trackerVisible) {
          await liveTracker.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(1000);
          console.log('✅ Live tracker clicked');
        } else {
          console.log('⚠️ Live tracker heading not found');
        }
      } else {
        console.log('✅ Live tracker already open');
      }

      // Check for tennis animation widget using the correct selector
      const detect = async () => {
        // Now check for animation elements after opening Live tracker
        const widgetContainer = page.locator('.animated_widget, #the-tennis-sport-widget');
        try { await widgetContainer.scrollIntoViewIfNeeded(); } catch {}

        // Look for iframe with sports widget
        const widget = page.locator('.animated_widget iframe, #the-tennis-sport-widget iframe');
        const start = Date.now();
        while (Date.now() - start < 6000) {
          const visible = await widget.isVisible({ timeout: 500 }).catch(() => false);
          if (visible) {
            const src = await widget.getAttribute('src').catch(() => null);
            if (src && (src.includes('thesports01.com') || src.includes('widgets.thesports01.com'))) {
              console.log(`✅ Animation iframe detected: ${src}`);
              return true;
            }
          }
          await page.waitForTimeout(400).catch(() => {});
        }

        // Also check for animate-svg elements
        const animateSvg = page.locator('.animate-svg');
        const hasSvg = await animateSvg.isVisible({ timeout: 1000 }).catch(() => false);
        if (hasSvg) {
          console.log('✅ SVG animation detected');
          return true;
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

      // Navigate back to tennis page
      await page.getByRole('link', { name: 'Tennis', exact: true }).click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(500);
    }

    console.log(`\n🧪 === TENNIS (${tabName}) RESULTS ===`);
    console.log(`📊 Total Tennis Events Tested: ${maxToTest}`);
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

  // Test All tab only if no Today/Tomorrow tabs are available
  let allResults = {pass: 0, fail: 0, results: []};
  if (!todayVisible && !tomorrowVisible) {
    console.log('ℹ️ No Today or Tomorrow tabs available, testing All tab...');
    allResults = await testTab('All');
  }

  // Final summary
  const totalPass = todayResults.pass + tomorrowResults.pass + allResults.pass;
  const totalFail = todayResults.fail + tomorrowResults.fail + allResults.fail;
  const totalEvents = totalPass + totalFail;

  // Collect all results for final lists
  const allPassedEvents: string[] = [];
  const allFailedEvents: string[] = [];
  
  if (todayResults.results.length > 0) {
    todayResults.results.forEach(r => {
      if (r.startsWith('PASS:')) allPassedEvents.push(r.replace('PASS: ', ''));
      else if (r.startsWith('FAIL:')) allFailedEvents.push(r.replace('FAIL: ', ''));
    });
  }
  
  if (tomorrowResults.results.length > 0) {
    tomorrowResults.results.forEach(r => {
      if (r.startsWith('PASS:')) allPassedEvents.push(r.replace('PASS: ', ''));
      else if (r.startsWith('FAIL:')) allFailedEvents.push(r.replace('FAIL: ', ''));
    });
  }
  
  if (allResults.results.length > 0) {
    allResults.results.forEach(r => {
      if (r.startsWith('PASS:')) allPassedEvents.push(r.replace('PASS: ', ''));
      else if (r.startsWith('FAIL:')) allFailedEvents.push(r.replace('FAIL: ', ''));
    });
  }

  console.log('\n🏁 === FINAL TENNIS ANIMATION TEST RESULTS ===');
  console.log(`📊 Total Events Tested: ${totalEvents}`);
  console.log(`✅ Total Passed: ${totalPass}`);
  console.log(`❌ Total Failed: ${totalFail}`);
  if (totalEvents > 0) {
    console.log(`📈 Success Rate: ${Math.round((totalPass / totalEvents) * 100)}%`);
  }

  // Detailed lists
  if (allPassedEvents.length > 0) {
    console.log('\n✅ === PASSED EVENTS ===');
    allPassedEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event}`);
    });
  }

  if (allFailedEvents.length > 0) {
    console.log('\n❌ === FAILED EVENTS ===');
    allFailedEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event}`);
    });
  }
});