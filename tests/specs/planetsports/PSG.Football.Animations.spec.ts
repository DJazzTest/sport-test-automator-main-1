import { test, expect, Page } from '@playwright/test';

test('PlanetSportBet – Football Animation Check', async ({ page, context }) => {
  // Extend overall timeout to accommodate up to 20 events with navigation
  const isCI = !!process.env.CI;
  test.setTimeout(isCI ? 8 * 60_000 : 10 * 60_000);
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
    console.log(`${visible ? '✅' : '❌'} Tab visibility – ${t}: ${visible}`);
  }

  // No date filtering: we test events under the active tab only

  // Helper to click a tab if present
  const clickTabIfVisible = async (name: string): Promise<boolean> => {
    const btn = page.getByRole('button', { name }).first();
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) return false;
    await btn.click({ timeout: 2000 }).catch(() => {});
    // Prefer an active state if present
    try { await btn.waitFor({ state: 'visible', timeout: 1000 }); } catch {}
    try { await expect(btn).toHaveAttribute('aria-selected', /true|selected/i, { timeout: 1500 }); } catch {}
    await page.waitForTimeout(600);
    // Light scroll to trigger lazy content then back to top
    for (let s = 0; s < 3; s++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(150); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    return true;
  };

  // Try Today then Tomorrow; if both tabs are missing or have zero events, fallback to All
  let testedTabs: string[] = [];
  const tryTabsInOrder = ['Today', 'Tomorrow'];
  const tabEventCounts: Record<string, number> = {};
  const ensureFootball = async () => {
    if (page.isClosed()) {
      console.log('⚠️ Page is already closed, skipping ensureFootball()');
      return false;
    }
    try {
      await page.goto('https://planetsportbet.com/sport/football', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      return true;
    } catch (e) {
      console.log(`⚠️ ensureFootball() navigation failed: ${(e as Error).message}`);
      return false;
    }
  };

  const testTab = async (tabName: string): Promise<boolean> => {
    const onFootball = await ensureFootball();
    if (!onFootball) {
      console.log(`ℹ️ Could not navigate to Football page for tab ${tabName}, skipping tab.`);
      return false;
    }
    const ok = await clickTabIfVisible(tabName);
    if (!ok) {
      console.log(`ℹ️ ${tabName} tab not available`);
      return false;
    }
    console.log(`🔍 Looking for football events on ${tabName}...`);
    // Speed: skip per-tab screenshots to reduce I/O
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
    const envMax = parseInt(process.env.MAX_EVENTS || '', 10);
    const defaultMax = isCI ? 8 : 20;
    const maxEvents = Math.min(count, isNaN(envMax) ? defaultMax : envMax); // Test up to MAX_EVENTS or default

    // Filter events to ensure we only take items belonging to the selected tab
    // Heuristic: titles for Today typically include the word "Today", while Tomorrow contains an explicit date (e.g., "01 Oct")
    const monthRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
    const candidateIndices: number[] = [];
    for (let i = 0; i < count; i++) {
      const event = eventWrappers.nth(i);
      let title = `Football Event ${i + 1}`;
      try { title = (await event.textContent()) || title; } catch {}
      const normalized = title.replace(/\s+/g, ' ').trim();
      if (tabName === 'Today') {
        if (/\bToday\b/i.test(normalized)) candidateIndices.push(i);
      } else if (tabName === 'Tomorrow') {
        if (!/\bToday\b/i.test(normalized) && (monthRegex.test(normalized) || /\bTomorrow\b/i.test(normalized))) candidateIndices.push(i);
      } else {
        candidateIndices.push(i);
      }
      if (candidateIndices.length >= maxEvents) break;
    }
    // Fallback: if heuristic matched nothing, just take the first N events from this tab's view
    if (candidateIndices.length === 0) {
      const fallbackCount = Math.min(count, maxEvents);
      for (let i = 0; i < fallbackCount; i++) candidateIndices.push(i);
      console.log(`ℹ️ No labeled entries found for ${tabName}; falling back to first ${fallbackCount} events`);
    }
    console.log(`ℹ️ Using ${candidateIndices.length} filtered events for ${tabName} (max ${maxEvents})`);

    // Test all events on the active tab - no date filtering
    for (const idx of candidateIndices) {
      // re-query to avoid staleness
      eventWrappers = main.locator('a[href*="/event/"]:visible');
      const event = eventWrappers.nth(idx);
      let title = `Football Event ${tested + 1}`;
      try { title = (await event.textContent()) || title; } catch {}
      
      tested++;
      console.log(`\n🎯 Testing ${tabName} ${tested}/${maxEvents}: ${title}`);

      // Open detail in a separate page for stability
      const href = await event.getAttribute('href').catch(() => null);
      if (!href) { results.push({ event: title, result: 'ERROR' }); continue; }
      const absolute = new URL(href, 'https://planetsportbet.com').toString();
      const detail = await context.newPage();
      await detail.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 10_000 }).catch(() => {});
      await detail.waitForTimeout(250).catch(() => {});
      await acceptPopups(detail);

      let animPassed = false;
      try {
        const detect = async () => {
          if (detail.isClosed()) return false;
          if (!detail.url().includes('/event/')) return false;
          // Ensure content loaded and give network a moment
          await detail.waitForLoadState('domcontentloaded').catch(() => {});
          await detail.waitForTimeout(200).catch(() => {});

          // Check if Live tracker is already open by looking for animation elements
          let hasAnimation = false;
          
          // First check for existing animation elements
          const existingWidget = detail.locator('.animated_widget iframe, #the-football-sport-widget iframe, .animate-svg');
          hasAnimation = await existingWidget.isVisible({ timeout: 1000 }).catch(() => false);
          
          // Also log any YouTube iframes, but do NOT count them as animations
          const youtubeIframe = detail.locator('iframe[src*="youtube.com/embed"]');
          const hasYouTube = await youtubeIframe.isVisible({ timeout: 1000 }).catch(() => false);
          if (hasYouTube) {
            const ytSrc = await youtubeIframe.getAttribute('src').catch(() => 'unknown');
            console.log(`📺 YouTube iframe detected (ignored for PASS): ${ytSrc}`);
          }

          // If no animation found, try to open Live tracker
          if (!hasAnimation) {
            console.log('🖱️ Live tracker not open, clicking to open...');
            const trackerHeading = detail.locator('h4[data-test-market-name="market-name"][data-test="section-title"]:has-text("Live tracker")');
            const trackerVisible = await trackerHeading.isVisible({ timeout: 2000 }).catch(() => false);
            
            if (trackerVisible) {
              await trackerHeading.click({ timeout: 2000 }).catch(() => {});
              await detail.waitForTimeout(1000).catch(() => {});
              console.log('✅ Live tracker clicked');
            } else {
              console.log('❌ Live tracker heading not found');
              console.log('   📋 Steps to recreate:');
              console.log(`      1. Navigate to: ${page.url()}`);
              console.log('      2. Look for a football event/match');
              console.log('      3. Click on the event to open the detail page');
              console.log('      4. Look for a "Live tracker" heading or button');
              console.log('      5. Expected: "Live tracker" should be visible and clickable');
              console.log('      6. Actual: "Live tracker" heading/button not found');
            }
          } else {
            console.log('✅ Live tracker already open');
          }

          // Now check for animation elements after opening Live tracker
          const widgetContainer = detail.locator('.animated_widget, #the-football-sport-widget');
          try { await widgetContainer.scrollIntoViewIfNeeded(); } catch {}

          // Look for iframe with sports widget
          const widget = detail.locator('.animated_widget iframe, #the-football-sport-widget iframe');
          const start = Date.now();
          const maxWait = isCI ? 4_000 : 6_000;
          while (Date.now() - start < maxWait) {
            const visible = await widget.isVisible({ timeout: 500 }).catch(() => false);
            if (visible) {
              const src = await widget.getAttribute('src').catch(() => null);
              if (src && (src.includes('thesports01.com') || src.includes('widgets.thesports01.com'))) {
                console.log(`✅ Animation iframe detected: ${src}`);
                return true;
              }
            }
            await detail.waitForTimeout(400).catch(() => {});
          }

          // Also check for animate-svg elements
          const animateSvg = detail.locator('.animate-svg');
          const hasSvg = await animateSvg.isVisible({ timeout: 1000 }).catch(() => false);
          if (hasSvg) {
            console.log('✅ SVG animation detected');
            return true;
          }

          return false;
        };
        const detection = detect();
        animPassed = await Promise.race([
          detection,
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), isCI ? 6_000 : 8_000))
        ]);
      } catch (error) {
        console.log(`❌ Animation detection error: ${error.message}`);
      }

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
    const passedEvents = results.filter(r => r.result === 'PASS');
    const failedEvents = results.filter(r => r.result === 'FAIL');
    const errorEvents = results.filter(r => r.result === 'ERROR');
    
    if (passedEvents.length > 0) {
      console.log(`\n✅ PASSED EVENTS (${passedEvents.length}):`);
      passedEvents.forEach((r, i) => console.log(`${i + 1}. ${r.event}`));
    }
    
    if (failedEvents.length > 0) {
      console.log(`\n❌ FAILED EVENTS (${failedEvents.length}):`);
      failedEvents.forEach((r, i) => console.log(`${i + 1}. ${r.event}`));
    }
    
    if (errorEvents.length > 0) {
      console.log(`\n🚨 ERROR EVENTS (${errorEvents.length}):`);
      errorEvents.forEach((r, i) => console.log(`${i + 1}. ${r.event}`));
    }
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
  console.log('📋 PlanetSportBet Animation Test (Football): events on Today/Tomorrow/All; PASS = animation found, FAIL = no animation, ERROR = error during check.');
});
