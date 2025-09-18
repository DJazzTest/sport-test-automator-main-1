import { test, expect } from '@playwright/test';

test('PlanetSportBet – American Football Live Tracker Check', async ({ page }) => {
  // Increase overall test timeout to avoid suite-level timeouts mid-iteration
  test.setTimeout(8 * 60_000);
  
  console.log('🚀 Starting American Football Live Tracker check...');
  
  // 1) Go to PlanetSportBet and dismiss popups
  await page.goto('https://planetsportbet.com/');
  await page.getByRole('button', { name: /Allow all/i }).click();
  try { await page.locator('[data-test="notification-box"] [data-test="close-icon"]').first().click({ timeout: 1500 }); } catch {}
  try { await page.locator('[data-test="landing-page"] [data-test="close-icon"]').first().click({ timeout: 1500 }); } catch {}
  
  // 2) Navigate to American Football sport page
  console.log('🏈 Navigating to American Football sport page...');
  await page.goto('https://planetsportbet.com/sport/americanfootball');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  
  // 3) Test each tab: navigate back to planetsportbet.com → American Football after each tab
  const timeTabs = ['In Play', 'Today', 'Tomorrow', 'Weekend', 'Current Week'];
  let totalPassCount = 0;
  let totalFailCount = 0;
  const allPassedEvents: string[] = [];
  const allFailedEvents: string[] = [];
  
  for (const tabName of timeTabs) {
    console.log(`\n🔍 Testing ${tabName} tab...`);
    
    try {
      // Click the time tab
      await page.getByRole('button', { name: tabName }).click();
      await page.waitForTimeout(2000);
      
      // Quick detection: either "no events" message or US NFL section; otherwise skip
      const noEventsPromise = page.getByText(/Sorry,? we haven't found any events with such criteria/i).isVisible({ timeout: 1500 }).catch(() => false);
      const usNflProbe = page.locator('h4[data-test="section-title"]').filter({ hasText: 'US NFL' }).first();
      const usNflVisiblePromise = usNflProbe.isVisible({ timeout: 2000 }).catch(() => false);
      const [noEventsQuick, usNflQuick] = await Promise.all([noEventsPromise, usNflVisiblePromise]);
      if (noEventsQuick) {
        console.log(`ℹ️  No events message shown in ${tabName} tab, navigating back...`);
        await page.goto('https://planetsportbet.com/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(400);
        await page.goto('https://planetsportbet.com/sport/americanfootball');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(400);
        continue;
      }
      if (!usNflQuick) {
        console.log(`ℹ️  US NFL not visible quickly in ${tabName} tab, skipping...`);
        continue;
      }

      // Ensure content is loaded and scroll to reveal sections
      for (let s = 0; s < 3; s++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(200); }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);

      // Find events ONLY under the US NFL section using a robust container query
      const usNflTitle = page.locator('h4[data-test="section-title"]:has-text("US NFL")').first();
      try { await usNflTitle.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); } catch {}
      const usNflExists = await usNflTitle.isVisible({ timeout: 2000 }).catch(() => false);
      if (!usNflExists) {
        console.log(`ℹ️  US NFL section not found after scroll in ${tabName}, skipping...`);
        continue;
      }
      const usNflContainer = page.locator('section:has(h4[data-test="section-title"]:has-text("US NFL")), div:has(h4[data-test="section-title"]:has-text("US NFL"))').first();
      // Prefer participant name nodes under US NFL section as canonical event count
      let participantNames = usNflContainer.locator('div.css-6ra27y-EventRowParticipantName');
      // Fallback to wrappers if needed
      let eventRows = usNflContainer.locator('[class*="EventRowWrapper"], [data-test*="EventRow"]');
      let eventCount = await participantNames.count().catch(() => 0);
      if (eventCount === 0) {
        eventCount = await eventRows.count().catch(() => 0);
      }
      console.log(`📊 ${tabName} US NFL events found: ${eventCount}`);
      
      if (eventCount === 0) {
        console.log(`ℹ️  No events in ${tabName} tab, navigating back...`);
        // Navigate back to planetsportbet.com then to American Football
        await page.goto('https://planetsportbet.com/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
        await page.goto('https://planetsportbet.com/sport/americanfootball');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
        continue;
      }
      
      // Test ALL events in this tab
      const maxToTest = eventCount;
      let tabPassCount = 0;
      let tabFailCount = 0;
      
      for (let i = 0; i < maxToTest; i++) {
        // Re-query rows each iteration to avoid stale locators
        // Recompute participants each iteration to avoid stale nodes
        participantNames = usNflContainer.locator('div.css-6ra27y-EventRowParticipantName');
        const freshCount = await participantNames.count().catch(() => 0);
        if (freshCount === 0 || i >= freshCount) {
          console.log('⚠️  No more events available in this tab.');
          break;
        }
        const participant = participantNames.nth(i);
        const event = participant.locator('xpath=ancestor::*[contains(@class, "EventRowWrapper") or @data-test][1]');
        let eventTitle = `Event ${i + 1}`;
        
        try {
          // Get event title
          const titleElement = participant.first();
          const titleExists = (await titleElement.count().catch(() => 0)) > 0;
          if (titleExists) {
            eventTitle = ((await titleElement.innerText().catch(() => '')) || `Event ${i + 1}`).trim();
          }
          console.log(`\n🔍 Testing: ${eventTitle} (${tabName})`);
          
          // Click into event
          await event.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
          // Click nearest anchor to participant or named link
          let eventLink = participant.locator('xpath=ancestor::a[1]');
          if ((await eventLink.count().catch(() => 0)) === 0) {
            eventLink = event.locator('[data-test="EventRowNameLink-link"]').first();
          }
          
          await Promise.all([
            page.waitForURL(/\/event\//, { timeout: 8000 }).catch(() => {}),
            eventLink.click().catch(() => {})
          ]);
          
          try { await page.waitForLoadState('domcontentloaded', { timeout: 8000 }); } catch {}
          await page.waitForTimeout(800);
          
          // Animated widget detection with watchdog (quick check before expanding)
          const animatedWidget = page.locator('div.animated_widget iframe[src*="widgets-v2.thesports01.com"]');
          let hasAnimatedWidget = await animatedWidget.isVisible({ timeout: 2000 }).catch(() => false);

          if (!hasAnimatedWidget) {
            // Click on live tracker section to expand it
            const liveTrackerSection = page.locator('div.css-1c8zwar-CollapseLabel').filter({ hasText: 'Live tracker' }).first();
            const liveTrackerClickable = page.locator('h4[data-test="section-title"]').filter({ hasText: 'Live tracker' }).first();
            try {
              await liveTrackerSection.click({ timeout: 2000 });
              console.log(`🖱️  Clicked live tracker section for ${eventTitle}`);
            } catch {
              try {
                await liveTrackerClickable.click({ timeout: 2000 });
                console.log(`🖱️  Clicked live tracker title for ${eventTitle}`);
              } catch {}
            }
            // Watchdog wait up to 6s for widget to show
            const start = Date.now();
            while (!hasAnimatedWidget && Date.now() - start < 6000) {
              hasAnimatedWidget = await animatedWidget.isVisible({ timeout: 500 }).catch(() => false);
            }
          }
          
          if (hasAnimatedWidget) {
            console.log(`✅ PASS: Live tracker animation found — ${eventTitle}`);
            tabPassCount++;
            allPassedEvents.push(`${eventTitle} (${tabName})`);
          } else {
            console.log(`❌ FAIL: No live tracker animation — ${eventTitle}`);
            tabFailCount++;
            allFailedEvents.push(`${eventTitle} (${tabName})`);
          }
          
        } catch (error) {
          console.log(`❌ FAIL: Error testing ${eventTitle} — ${error.message}`);
          tabFailCount++;
          allFailedEvents.push(`${eventTitle} (${tabName}) - Error: ${error.message}`);
        } finally {
          // Return to current tab list view to continue iterating
          try {
            await page.goBack({ waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(400);
            // Ensure the same tab is active and US NFL is visible again
            await page.getByRole('button', { name: tabName }).click({ timeout: 1500 }).catch(() => {});
            const usNflTitleAgain = page.locator('h4[data-test="section-title"]').filter({ hasText: 'US NFL' }).first();
            await usNflTitleAgain.scrollIntoViewIfNeeded().catch(() => {});
            await page.waitForTimeout(200);
          } catch {}
        }
      }
      
      console.log(`📊 ${tabName} results: ${tabPassCount} PASS, ${tabFailCount} FAIL`);
      totalPassCount += tabPassCount;
      totalFailCount += tabFailCount;
      
      // Navigate back to planetsportbet.com then to American Football for next tab
      console.log(`🔄 Navigating back to planetsportbet.com then American Football for next tab...`);
      await page.goto('https://planetsportbet.com/');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.goto('https://planetsportbet.com/sport/americanfootball');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      
    } catch (error) {
      console.log(`❌ Error testing ${tabName} tab: ${error.message}`);
      // Still navigate back for next tab, guard if page is closed
      try {
        await page.goto('https://planetsportbet.com/');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
        await page.goto('https://planetsportbet.com/sport/americanfootball');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
      } catch {}
    }
  }
  
  // 4) Report final results
  console.log('\n=== AMERICAN FOOTBALL LIVE TRACKER RESULTS ===');
  console.log(`📊 Total Events Tested: ${totalPassCount + totalFailCount}`);
  console.log(`✅ PASS: ${totalPassCount} events with live tracker animation`);
  console.log(`❌ FAIL: ${totalFailCount} events without live tracker animation`);
  
  if (allPassedEvents.length > 0) {
    console.log('\n✅ PASSED EVENTS (WITH LIVE TRACKER):');
    allPassedEvents.forEach((event, index) => {
      console.log(`${index + 1}. "${event}"`);
    });
  }
  
  if (allFailedEvents.length > 0) {
    console.log('\n❌ FAILED EVENTS (NO LIVE TRACKER):');
    allFailedEvents.forEach((event, index) => {
      console.log(`${index + 1}. "${event}"`);
    });
  }
  
  const totalTested = totalPassCount + totalFailCount;
  const successRate = totalTested > 0 ? Math.round((totalPassCount / totalTested) * 100) : 0;
  console.log(`\n🎖️  Live Tracker Coverage: ${totalPassCount}/${totalTested} events (${successRate}%)`);
});
