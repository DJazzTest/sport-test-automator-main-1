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
  
  // Check if Today/Tomorrow tabs are available
  const todayVis = await page.getByRole('button', { name: 'Today' }).first().isVisible({ timeout: 1500 }).catch(() => false);
  const tomorrowVis = await page.getByRole('button', { name: 'Tomorrow' }).first().isVisible({ timeout: 1500 }).catch(() => false);
  
  let totalPassCount = 0;
  let totalFailCount = 0;
  const allPassedEvents: string[] = [];
  const allFailedEvents: string[] = [];
  
  // If no Today/Tomorrow tabs, scroll down and find NFL section directly
  if (!todayVis && !tomorrowVis) {
    console.log('ℹ️  No Today/Tomorrow tabs - scrolling to find NFL section...');
    
    // Scroll down to reveal content
    for (let s = 0; s < 5; s++) { 
      await page.mouse.wheel(0, 1000); 
      await page.waitForTimeout(300); 
    }
    
    // Look for NFL section title
    const nflSection = page.locator('h4[data-test="section-title"]').filter({ hasText: /NFL/i }).first();
    const nflSectionVisible = await nflSection.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (nflSectionVisible) {
      console.log('✅ Found NFL section');
      await nflSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      
      // Find events within this section's container
      const sectionContainer = nflSection.locator('xpath=ancestor::section[1]');
      const eventLinks = sectionContainer.locator('a[href*="/event/"]');
      const eventCount = await eventLinks.count();
      console.log(`📊 Found ${eventCount} NFL events`);
      
      // Test each event
      for (let i = 0; i < eventCount && i < 20; i++) {
        const event = eventLinks.nth(i);
        let eventTitle = `Event ${i + 1}`;
        
        try {
          eventTitle = ((await event.innerText().catch(() => '')) || `Event ${i + 1}`).trim();
          console.log(`\n🎯 Testing: ${eventTitle}`);
          
          await event.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await event.click();
          await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(800);
          
          // Check for animated widget
          const animatedWidget = page.locator('div.animated_widget iframe[src*="widgets"]');
          let hasAnimatedWidget = await animatedWidget.isVisible({ timeout: 2000 }).catch(() => false);
          
          if (!hasAnimatedWidget) {
            const liveTrackerSection = page.locator('div.css-1c8zwar-CollapseLabel').filter({ hasText: 'Live tracker' }).first();
            await liveTrackerSection.click({ timeout: 2000 }).catch(() => {});
            await page.waitForTimeout(1000);
            hasAnimatedWidget = await animatedWidget.isVisible({ timeout: 3000 }).catch(() => false);
          }
          
          if (hasAnimatedWidget) {
            console.log(`✅ PASS: ${eventTitle}`);
            totalPassCount++;
            allPassedEvents.push(eventTitle);
          } else {
            console.log(`❌ FAIL: ${eventTitle}`);
            totalFailCount++;
            allFailedEvents.push(eventTitle);
          }
          
        } catch (error) {
          console.log(`❌ FAIL: Error testing ${eventTitle}`);
          totalFailCount++;
          allFailedEvents.push(eventTitle);
        }
        
        // Go back to list
        await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(500);
        await nflSection.scrollIntoViewIfNeeded().catch(() => {});
      }
      
      // Print results and exit
      console.log('\n=== AMERICAN FOOTBALL LIVE TRACKER RESULTS ===');
      console.log(`📊 Total Events Tested: ${totalPassCount + totalFailCount}`);
      console.log(`✅ PASS: ${totalPassCount} events with live tracker animation`);
      console.log(`❌ FAIL: ${totalFailCount} events without live tracker animation`);
      
      if (allPassedEvents.length > 0) {
        console.log('\n✅ PASSED EVENTS:');
        allPassedEvents.forEach((e, i) => console.log(`${i + 1}. ${e}`));
      }
      if (allFailedEvents.length > 0) {
        console.log('\n❌ FAILED EVENTS:');
        allFailedEvents.forEach((e, i) => console.log(`${i + 1}. ${e}`));
      }
      
      return;
    } else {
      console.log('❌ NFL section not found');
      console.log('\n=== AMERICAN FOOTBALL LIVE TRACKER RESULTS ===');
      console.log(`📊 Total Events Tested: 0`);
      return;
    }
  }
  
  // Original tab-based logic for when Today/Tomorrow are available
  const timeTabs = todayVis ? ['Today'] : tomorrowVis ? ['Tomorrow'] : [];
  const missingTabs: string[] = [];
  
  for (const tabName of timeTabs) {
    console.log(`\n🔍 Testing ${tabName} tab...`);
    
    try {
      await page.getByRole('button', { name: tabName }).first().click();
      await page.waitForTimeout(2000);
      
      // Quick detection: either "no events" message; otherwise continue
      const noEventsQuick = await page.getByText(/Sorry,? we haven't found any events with such criteria/i).isVisible({ timeout: 1500 }).catch(() => false);
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

      // If tab button not present, record and continue
      const tabBtn = page.getByRole('button', { name: tabName }).first();
      const tabVisible = await tabBtn.isVisible({ timeout: 1500 }).catch(() => false);
      if (!tabVisible) {
        if (/today/i.test(tabName)) missingTabs.push('Today tab not available');
        if (/tomorrow/i.test(tabName)) missingTabs.push('Tomorrow tab not available');
        if (/weekend/i.test(tabName)) missingTabs.push('Weekend tab not available');
        console.log(`ℹ️  Tab not available: ${tabName}`);
        continue;
      }
      await tabBtn.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(500);

      // Ensure content is loaded and scroll to reveal sections
      for (let s = 0; s < 3; s++) { await page.mouse.wheel(0, 900); await page.waitForTimeout(200); }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);

      // Find events across all sections on page
      const main = page.locator('main, [role="main"], body');
      let eventLinks = main.locator('a[href*="/event/"]').first().page().locator('a[href*="/event/"]');
      // Prefer participant name containers to get titles
      let participantNames = main.locator('div.css-6ra27y-EventRowParticipantName');
      let eventCount = await eventLinks.count().catch(() => 0);
      if (eventCount === 0) {
        eventLinks = main.locator('[class*="EventRowWrapper"] a[href*="/event/"], [data-test*="EventRow"] a[href*="/event/"]');
        eventCount = await eventLinks.count().catch(() => 0);
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
      // Competition breakdown
      const compTotals: Record<string, { total: number; pass: number; fail: number }> = {};
      
      for (let i = 0; i < maxToTest; i++) {
        // Re-query links each iteration to avoid stale locators
        eventLinks = main.locator('a[href*="/event/"]');
        const freshCount = await eventLinks.count().catch(() => 0);
        if (freshCount === 0 || i >= freshCount) break;
        const event = eventLinks.nth(i);
        let eventTitle = `Event ${i + 1}`;
        let competitionName = 'Unknown Competition';
        
        try {
          // Get event title
          eventTitle = ((await event.innerText().catch(() => '')) || `Event ${i + 1}`).trim();
          // Try to infer competition/section name by nearest section title
          try {
            const handle = await event.elementHandle();
            if (handle) {
              const comp = await handle.evaluate((node) => {
                let el: HTMLElement | null = node as HTMLElement;
                // climb a few levels to reach a section/container with a header
                for (let depth = 0; el && depth < 8; depth++) {
                  const section = el.closest('section, [data-test-section], [data-test*="EventSection"], [class*="EventSection" ]');
                  if (section) {
                    const h = section.querySelector('h4[data-test="section-title"], h4, h3');
                    if (h && h.textContent) return h.textContent.trim();
                  }
                  el = el.parentElement;
                }
                // fallback: search upwards for any header
                let p: HTMLElement | null = (node as HTMLElement).parentElement;
                while (p) {
                  const h = p.querySelector('h4[data-test="section-title"], h4, h3');
                  if (h && h.textContent) return h.textContent.trim();
                  p = p.parentElement;
                }
                return 'Unknown Competition';
              });
              if (comp) competitionName = comp;
            }
          } catch {}
          console.log(`\n🔍 Testing: ${eventTitle} (${tabName})`);
          
          // Click into event
          await event.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
          
          await Promise.all([
            page.waitForURL(/\/event\//, { timeout: 8000 }).catch(() => {}),
            event.click().catch(() => {})
          ]);
          
          try { await page.waitForLoadState('domcontentloaded', { timeout: 8000 }); } catch {}
          await page.waitForTimeout(800);
          
          // Animated widget detection with watchdog (quick check before expanding)
          const animatedWidget = page.locator('div.animated_widget iframe[src*="widgets"]');
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
            compTotals[competitionName] = compTotals[competitionName] || { total: 0, pass: 0, fail: 0 };
            compTotals[competitionName].total++;
            compTotals[competitionName].pass++;
          } else {
            console.log(`❌ FAIL: No live tracker animation — ${eventTitle}`);
            tabFailCount++;
            allFailedEvents.push(`${eventTitle} (${tabName})`);
            compTotals[competitionName] = compTotals[competitionName] || { total: 0, pass: 0, fail: 0 };
            compTotals[competitionName].total++;
            compTotals[competitionName].fail++;
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
      // Print competition breakdown for this tab
      const comps = Object.keys(compTotals);
      if (comps.length) {
        console.log('\n🏷️  Competition breakdown:');
        for (const c of comps) {
          const row = compTotals[c];
          console.log(`- ${c}\n  events ${row.total}\n  PASS ${row.pass}\n  FAIL ${row.fail}`);
        }
      }
      totalPassCount += tabPassCount;
      totalFailCount += tabFailCount;
      
      // If we just finished the All tab, stop the test and print report
      if (/^All$/i.test(tabName)) {
        console.log(`\n=== AMERICAN FOOTBALL LIVE TRACKER RESULTS ===`);
        console.log(`📊 Total Events Tested: ${totalPassCount + totalFailCount}`);
        console.log(`✅ PASS: ${totalPassCount} events with live tracker animation`);
        console.log(`❌ FAIL: ${totalFailCount} events without live tracker animation`);
        return;
      }

      // Navigate back to planetsportbet.com then to American Football for next tab
      console.log(`🔄 Navigating back to planetsportbet.com then American Football for next tab...`);
      try {
        await page.goto('https://planetsportbet.com/sport/americanfootball');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log('❌ Navigation error, continuing with next tab...');
        console.log('   📋 Steps to recreate:');
        console.log(`      1. Navigate to: ${page.url()}`);
        console.log('      2. Try to navigate to the next tab');
        console.log('      3. Expected: Tab should switch successfully');
        console.log('      4. Actual: Navigation failed');
      }
      
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
  if (missingTabs.length) {
    console.log('\nℹ️  Missing tabs:');
    missingTabs.forEach((m, i) => console.log(`${i + 1}. ${m}`));
  }
  
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
