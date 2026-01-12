import { test, expect, Page } from '@playwright/test';

test('PlanetSportBet – Cricket Tab Animation Check', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);
  // 1) Land on PlanetSportBet and navigate via left-hand pane Cricket
  await page.goto('https://planetsportbet.com/');
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

  // Debug: Log available navigation links
  const allNavLinks = await page.$$eval('nav a, header a, [class*="nav"] a, [class*="menu"] a, a[href*="/sport/"]', links => 
    links.map(a => ({ text: a.textContent?.trim(), href: a.href })).filter(l => l.text && l.href)
  );
  console.log('🔍 Available navigation links:', allNavLinks.slice(0, 15));

  console.log('📌 Navigating to Cricket via left-hand pane...');
  // Try multiple navigation strategies
  let cricketLink = page.getByRole('link', { name: /^Cricket$/ });
  let linkVisible = await cricketLink.isVisible({ timeout: 2000 }).catch(() => false);
  
  // Fallback: try different selectors
  if (!linkVisible) {
    cricketLink = page.locator('a[href*="cricket"]').first();
    linkVisible = await cricketLink.isVisible({ timeout: 2000 }).catch(() => false);
  }
  
  if (!linkVisible) {
    cricketLink = page.locator('a:has-text("Cricket")').first();
    linkVisible = await cricketLink.isVisible({ timeout: 2000 }).catch(() => false);
  }
  
  // Try more specific selectors
  if (!linkVisible) {
    const specificSelectors = [
      'nav a[href*="cricket"]',
      'header a[href*="cricket"]',
      '[class*="nav"] a[href*="cricket"]',
      '[class*="menu"] a[href*="cricket"]',
      'a[href="/sport/cricket"]',
      'a[href="/cricket"]'
    ];
    
    for (const selector of specificSelectors) {
      cricketLink = page.locator(selector).first();
      linkVisible = await cricketLink.isVisible({ timeout: 1000 }).catch(() => false);
      if (linkVisible) break;
    }
  }
  
  if (!linkVisible) {
    console.log('❌ Cricket link not found in left-hand pane');
    return;
  }
  
  await cricketLink.click();
  await page.waitForLoadState('domcontentloaded');

  // 2) Check for Today/Tomorrow tabs, fallback to All
  const clickTabIfVisible = async (name: string): Promise<boolean> => {
    const btn = page.getByRole('button', { name });
    const visible = await btn.isVisible({ timeout: 1500 }).catch(() => false);
    if (!visible) return false;
    await btn.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(600);
    return true;
  };
  
  let activeTab: 'Today' | 'Tomorrow' | 'All' = 'All';
  let todayVisible = false;
  let tomorrowVisible = false;
  
  // Check tab visibility first
  todayVisible = await page.getByRole('button', { name: 'Today' }).isVisible({ timeout: 1500 }).catch(() => false);
  tomorrowVisible = await page.getByRole('button', { name: 'Tomorrow' }).isVisible({ timeout: 1500 }).catch(() => false);
  
  console.log(`✅ Tab visibility – Today: ${todayVisible}`);
  console.log(`✅ Tab visibility – Tomorrow: ${tomorrowVisible}`);
  
  // Try Today first if available
  if (todayVisible) {
    if (await clickTabIfVisible('Today')) {
      activeTab = 'Today';
      console.log(`📅 Cricket active tab: ${activeTab}`);
    }
  }
  
  // If Today not available or no events, try Tomorrow
  if (activeTab === 'All' && tomorrowVisible) {
    if (await clickTabIfVisible('Tomorrow')) {
      activeTab = 'Tomorrow';
      console.log(`📅 Cricket active tab: ${activeTab}`);
    }
  }
  
  // If neither Today nor Tomorrow available, stay on All
  if (activeTab === 'All') {
    console.log(`ℹ️ No Today or Tomorrow tabs available, testing All tab`);
    console.log(`📅 Cricket active tab: ${activeTab}`);
  }

  // 4) Get cricket events and count them
  console.log('🔍 Looking for cricket events...');
  
  // If on All tab, scroll down to find competitions
  if (activeTab === 'All') {
    console.log('📜 Scrolling down to find cricket competitions...');
    // Scroll down multiple times to reveal all content
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(500);
    }
    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
  }
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'cricket-page-debug.png' });
  console.log('📸 Screenshot saved as cricket-page-debug.png');
  
  // Use the working selector from tennis/football tests
  let eventWrappers = page.locator('a[href*="/event/"]');
  let count = await eventWrappers.count();
  console.log(`🏏 Number of Cricket event links found: ${count}`);
  
  // If no events found, try scrolling more and looking for different selectors
  if (count === 0) {
    console.log('🔍 No events found, trying additional scrolling and selectors...');
    
    // Scroll down more aggressively
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 1000);
      await page.waitForTimeout(300);
    }
    
    // Try different selectors
    const alternativeSelectors = [
      'a[href*="/event/"]',
      '[data-test*="event"] a[href*="/event/"]',
      '[class*="event"] a[href*="/event/"]',
      '[class*="match"] a[href*="/event/"]',
      'a[href*="/cricket/"]',
      'a[href*="/sport/cricket/"]'
    ];
    
    for (const selector of alternativeSelectors) {
      eventWrappers = page.locator(selector);
      count = await eventWrappers.count();
      if (count > 0) {
        console.log(`✅ Found ${count} events using selector: ${selector}`);
        break;
      }
    }
  }
  
  if (count === 0) {
    console.log('❌ No cricket events found');
    return;
  }

  // Test events on the active tab
  const maxEvents = Math.min(count, 20);
  let tested = 0;
  let passed = 0;
  let failed = 0;
  const results: string[] = [];

  console.log(`🎯 Testing ${activeTab} tab - Found ${count} events, testing up to ${maxEvents}`);

  for (let i = 0; i < count && tested < maxEvents; i++) {
    const event = eventWrappers.nth(i);
    
    // Scroll to the event to ensure it's visible
    try {
      await event.scrollIntoViewIfNeeded({ timeout: 3000 });
      await page.waitForTimeout(300);
    } catch (e) {
      console.log(`❌ Could not scroll to event ${i + 1}, continuing...`);
    }
    
    const title = (await event.innerText().catch(() => `Event ${i + 1}`)).trim() || `Event ${i + 1}`;
    tested++;
    
    console.log(`\n🎯 Testing ${activeTab} ${tested}/${maxEvents}: ${title}`);

    // Click the event link
    await event.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);

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
      const liveTracker = page.getByRole('heading', { name: 'Live tracker' });
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

    // Check for cricket animation widget using the correct selector
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
    await page.getByRole('link', { name: 'Cricket' }).click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(500);
  }

  console.log(`\n🧪 === CRICKET (${activeTab}) RESULTS ===`);
  console.log(`📊 Total Cricket Events Tested: ${tested}`);
  console.log(`✅ Events with Animations (PASS): ${passed}`);
  console.log(`❌ Events without Animations (FAIL): ${failed}`);
  console.log(`\n📋 === DETAILED RESULTS (${activeTab}) ===`);
  results.forEach(r => console.log(r));
});
