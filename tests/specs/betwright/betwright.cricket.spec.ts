import { test, expect, Page } from '@playwright/test';

test('BetWright – Cricket Animation Check', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);
  console.log('🚀 Starting BetWright Cricket Animation Test...');
  
  // 1) Land on BetWright homepage
  await page.goto('https://www.betwright.com/');
  console.log('✅ Landed on BetWright homepage');
  
  // Robust consent/overlay handling
  const acceptPopups = async (p: Page) => {
    try { await p.getByRole('button', { name: /Allow all/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
    try { await p.locator('[data-test="landing-page"] [data-test="close-icon"] path').click({ timeout: 1500 }); } catch {}
    // UNICCMP modal fallback
    try {
      const uni = p.locator('[id^="uniccmp"], div:has-text("Accept & Continue")');
      if (await uni.isVisible({ timeout: 1000 }).catch(() => false)) {
        await p.getByRole('button', { name: /Accept/i }).click({ timeout: 1500 }).catch(() => {});
      }
    } catch {}
  };
  await acceptPopups(page);
  await page.waitForTimeout(1000);

  // 2) Navigate to Cricket via left-hand pane (under Boxing)
  console.log('📌 Looking for Cricket link in left-hand pane...');
  
  // Wait for the left-hand pane to load
  await page.waitForTimeout(2000);
  
  // Try to find Cricket link - it should be under Boxing in the left-hand pane
  let cricketLink = page.getByRole('link', { name: /^Cricket$/i });
  let linkVisible = await cricketLink.isVisible({ timeout: 3000 }).catch(() => false);
  
  // Fallback: try different selectors for left-hand navigation
  if (!linkVisible) {
    // Look for Cricket in navigation areas
    cricketLink = page.locator('a[href*="cricket"]').first();
    linkVisible = await cricketLink.isVisible({ timeout: 2000 }).catch(() => false);
  }
  
  if (!linkVisible) {
    cricketLink = page.locator('a:has-text("Cricket")').first();
    linkVisible = await cricketLink.isVisible({ timeout: 2000 }).catch(() => false);
  }
  
  // Try more specific selectors for left-hand pane
  if (!linkVisible) {
    const specificSelectors = [
      'nav a[href*="cricket"]',
      '[class*="nav"] a[href*="cricket"]',
      '[class*="menu"] a[href*="cricket"]',
      '[class*="sidebar"] a[href*="cricket"]',
      'a[href="/sport/cricket"]',
      'a[href="/cricket"]'
    ];
    
    for (const selector of specificSelectors) {
      cricketLink = page.locator(selector).first();
      linkVisible = await cricketLink.isVisible({ timeout: 1000 }).catch(() => false);
      if (linkVisible) {
        console.log(`✅ Found Cricket link using selector: ${selector}`);
        break;
      }
    }
  }
  
  if (!linkVisible) {
    console.log('❌ Cricket link not found in left-hand pane');
    // Take a screenshot for debugging
    await page.screenshot({ path: 'betwright-cricket-link-debug.png' });
    return;
  }
  
  await cricketLink.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  console.log('✅ Clicked on Cricket, landed on cricket home page');

  // 3) Helper function to click tabs
  const clickTabIfVisible = async (name: string): Promise<boolean> => {
    const btn = page.getByRole('button', { name }).first();
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) return false;
    await btn.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(600);
    // Light scroll to trigger lazy content
    for (let s = 0; s < 2; s++) { 
      await page.mouse.wheel(0, 500); 
      await page.waitForTimeout(200); 
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    return true;
  };
  
  // Check for tabs: Anytime, In Play, Today, Tomorrow
  const expectedTabs = ['Anytime', 'In Play', 'Today', 'Tomorrow'];
  for (const t of expectedTabs) {
    const visible = await page.getByRole('button', { name: t }).isVisible({ timeout: 1500 }).catch(() => false);
    console.log(`${visible ? '✅' : '❌'} Tab visibility – ${t}: ${visible}`);
  }

  // Helper function to test events on a specific tab
  const testTabEvents = async (tabName: string) => {
    console.log(`\n📋 === TESTING ${tabName.toUpperCase()} TAB ===`);
    
    // Navigate to the specified tab
    const tabClicked = await clickTabIfVisible(tabName);
    if (!tabClicked) {
      console.log(`❌ ${tabName} tab not available, skipping...`);
      console.log(`   📋 Steps to recreate:`);
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log(`      2. Look for the "${tabName}" tab`);
      console.log(`      3. Expected: Tab should be visible and accessible`);
      console.log(`      4. Actual: Tab not found or not available`);
      return { tested: 0, passed: 0, failed: 0, results: [] };
    }
    
    await page.waitForTimeout(1000);

    // Scroll down to find events
    console.log(`📜 Scrolling down to find cricket events on ${tabName}...`);
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(500);
    }
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Find cricket events using the participant selector
    console.log(`🔍 Looking for cricket events on ${tabName}...`);
    
    // Try the specific selector mentioned: data-test="participant"
    let eventWrappers = page.locator('[data-test="participant"]');
    let count = await eventWrappers.count().catch(() => 0);
    
    // Fallback to other selectors if the specific one doesn't work
    if (count === 0) {
      console.log(`❌ No events found with data-test="participant" on ${tabName}, trying alternative selectors...`);
      const alternativeSelectors = [
        'a[href*="/event/"]',
        '[data-test*="event"] a[href*="/event/"]',
        '[class*="EventRow"] a[href*="/event/"]',
        '[data-test="participant"] a',
        'a[href*="/cricket/"]',
        'a[href*="/sport/cricket/"]'
      ];
      
      for (const selector of alternativeSelectors) {
        eventWrappers = page.locator(selector);
        count = await eventWrappers.count().catch(() => 0);
        if (count > 0) {
          console.log(`✅ Found ${count} events using selector: ${selector}`);
          break;
        }
      }
    } else {
      console.log(`✅ Found ${count} events using data-test="participant" selector on ${tabName}`);
    }
    
    if (count === 0) {
      console.log(`❌ No cricket events found on ${tabName} tab`);
      return { tested: 0, passed: 0, failed: 0, results: [] };
    }

    // Test each event for animations
    const maxEvents = Math.min(count, 20);
    let tested = 0;
    let passed = 0;
    let failed = 0;
    const results: string[] = [];

    console.log(`🎯 Testing ${tabName} tab - Found ${count} events, testing up to ${maxEvents}`);

    for (let i = 0; i < count && tested < maxEvents; i++) {
      // Re-query to avoid staleness
      eventWrappers = page.locator('[data-test="participant"]').or(page.locator('a[href*="/event/"]'));
      const event = eventWrappers.nth(i);
      
      // Scroll to the event to ensure it's visible
      try {
        await event.scrollIntoViewIfNeeded({ timeout: 3000 });
        await page.waitForTimeout(300);
      } catch (e) {
        console.log(`❌ Could not scroll to event ${i + 1}, continuing...`);
      }
      
      let title = `Cricket Event ${i + 1}`;
      try {
        // Try to get text from the participant div
        title = (await event.textContent()) || title;
        // If it's a link, try to get text from it
        if (title === `Cricket Event ${i + 1}`) {
          const link = event.locator('a').first();
          if (await link.count() > 0) {
            title = (await link.textContent()) || title;
          }
        }
      } catch {}
      
      title = title.trim() || `Cricket Event ${i + 1}`;
      tested++;
      
      console.log(`\n🎯 Testing ${tabName} ${tested}/${maxEvents}: ${title}`);

      // Click the event - try clicking the participant div or the link inside it
      let clicked = false;
      try {
        await event.click({ timeout: 5000 });
        clicked = true;
      } catch {
        try {
          const link = event.locator('a').first();
          if (await link.count() > 0) {
            await link.click({ timeout: 5000 });
            clicked = true;
          }
        } catch {}
      }
      
      if (!clicked) {
        console.log(`❌ Could not click event ${i + 1}, skipping...`);
        console.log(`   📋 Steps to recreate:`);
        console.log(`      1. Navigate to: ${page.url()}`);
        console.log(`      2. Find event number ${i + 1} in the list`);
        console.log(`      3. Try to click on the event`);
        console.log(`      4. Expected: Event should be clickable and open`);
        console.log(`      5. Actual: Event could not be clicked`);
        results.push(`SKIP: ${title} (could not click)`);
        continue;
      }
      
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await acceptPopups(page);

      // Check if Live tracker is already open by looking for animation elements
      let hasAnimation = false;
      
      // First check for existing animation elements
      const existingWidget = page.locator('.animated_widget iframe, #the-cricket-sport-widget iframe, .animate-svg');
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
        const liveTracker = page.getByRole('heading', { name: 'Live tracker' }).or(
          page.locator('h4:has-text("Live tracker")')
        );
        const trackerVisible = await liveTracker.isVisible({ timeout: 3000 }).catch(() => false);
        if (trackerVisible) {
          await liveTracker.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(1000);
          console.log('✅ Live tracker clicked');
        } else {
          console.log('❌ Live tracker heading not found');
          console.log('   📋 Steps to recreate:');
          console.log(`      1. Navigate to: ${page.url()}`);
          console.log('      2. Look for a cricket event/match');
          console.log('      3. Click on the event to open the detail page');
          console.log('      4. Look for a "Live tracker" heading or button');
          console.log('      5. Expected: "Live tracker" should be visible and clickable');
          console.log('      6. Actual: "Live tracker" heading/button not found');
        }
      } else {
        console.log('✅ Live tracker already open');
      }

      // Check for cricket animation widget
      const detect = async () => {
        // Now check for animation elements after opening Live tracker
        const widgetContainer = page.locator('.animated_widget, #the-cricket-sport-widget');
        try { await widgetContainer.scrollIntoViewIfNeeded(); } catch {}

        // Look for iframe with sports widget
        const widget = page.locator('.animated_widget iframe, #the-cricket-sport-widget iframe');
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
        passed++; 
        results.push(`PASS: ${title}`);
      } else { 
        console.log(`❌ FAIL: no animation detected — ${title}`); 
        failed++; 
        results.push(`FAIL: ${title}`);
      }

      // Navigate back to cricket page
      try {
        await page.getByRole('link', { name: /Cricket/i }).click({ timeout: 3000 });
      } catch {
        // Fallback: navigate directly
        await page.goto('https://www.betwright.com/sport/cricket', { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(500);
      
      // Re-click the tab to return to the correct view
      await clickTabIfVisible(tabName);
      await page.waitForTimeout(500);
    }

    console.log(`\n🧪 === CRICKET (${tabName}) RESULTS ===`);
    console.log(`📊 Total Cricket Events Tested: ${tested}`);
    console.log(`✅ Events with Animations (PASS): ${passed}`);
    console.log(`❌ Events without Animations (FAIL): ${failed}`);
    console.log(`\n📋 === DETAILED RESULTS (${tabName}) ===`);
    results.forEach(r => console.log(r));
    
    return { tested, passed, failed, results };
  };

  // 6) Test Today tab
  const todayResults = await testTabEvents('Today');

  // 7) Test Tomorrow tab
  const tomorrowResults = await testTabEvents('Tomorrow');

  // Final summary
  console.log(`\n🏁 === FINAL CRICKET TEST SUMMARY ===`);
  console.log(`\n📅 TODAY TAB:`);
  console.log(`   Total Events: ${todayResults.tested}`);
  console.log(`   ✅ PASS: ${todayResults.passed}`);
  console.log(`   ❌ FAIL: ${todayResults.failed}`);
  console.log(`\n📅 TOMORROW TAB:`);
  console.log(`   Total Events: ${tomorrowResults.tested}`);
  console.log(`   ✅ PASS: ${tomorrowResults.passed}`);
  console.log(`   ❌ FAIL: ${tomorrowResults.failed}`);
  console.log(`\n📊 OVERALL:`);
  console.log(`   Total Events Tested: ${todayResults.tested + tomorrowResults.tested}`);
  console.log(`   Total PASS: ${todayResults.passed + tomorrowResults.passed}`);
  console.log(`   Total FAIL: ${todayResults.failed + tomorrowResults.failed}`);
});

