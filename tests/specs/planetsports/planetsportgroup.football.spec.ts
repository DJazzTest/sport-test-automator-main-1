import { test, expect } from '@playwright/test';

test('PlanetSportBet – Football Tab Animation Check', async ({ page }) => {
  // 1) Land on PlanetSportBet and navigate to In Play section
  await page.goto('https://planetsportbet.com/');
  await page.getByRole('button', { name: /Allow all/i }).click();
  // Close overlays robustly
  try { await page.locator('[data-test="notification-box"] [data-test="close-icon"]').first().click({ timeout: 1500 }); } catch {}
  try { await page.locator('[data-test="landing-page"] [data-test="close-icon"]').first().click({ timeout: 1500 }); } catch {}
  await page.evaluate(() => {
    const selectors = ['[data-component="AccountSidebar"]', '[data-test="notification-box"]'];
    selectors.forEach(sel => document.querySelectorAll(sel).forEach(el => {
      const e = el as HTMLElement; e.style.setProperty('display', 'none', 'important'); e.style.setProperty('pointer-events', 'none', 'important');
    }));
  });
  await page.locator('[data-test="inplay-link"]').click();

  // 2) Confirm we're on the All Sports tab after clicking In Play
  console.log('🏆 Confirming we\'re on All Sports tab after clicking In Play...');
  await page.waitForTimeout(2000);
  
  // Wait for All Sports button to be visible
  await expect(page.locator('[data-test-filter-key="empty"]')).toBeVisible({ timeout: 5000 });
  console.log('✅ Confirmed on All Sports tab');

  async function locateAndClickFootballTab() {
    console.log('🔍 Looking for Football tab (may not be first in navigation bar)...');
    
    // Use the exact selector from the HTML you provided
    const footballTab = page.locator('[data-test-filter-key="football"]');
    
    try {
      await expect(footballTab).toBeVisible({ timeout: 5000 });
      console.log('✅ Found Football tab using data-test-filter-key="football"');
      await footballTab.click();
      console.log('🏈 Clicked on Football tab');
      await page.waitForTimeout(2000);
      return true;
    } catch {
      console.log('❌ Could not locate Football tab with data-test-filter-key="football"');
      return false;
    }
  }

  // 3) Initial click on Football tab
  const footballTabFound = await locateAndClickFootballTab();
  if (!footballTabFound) {
    throw new Error('❌ Could not locate Football tab in In Play section');
  }

  // 3) Get football events and count them (robust load)
  let eventWrappers = page.locator('.css-f5hkhk-EventRowWrapper');
  try {
    await expect(eventWrappers.first()).toBeVisible({ timeout: 10000 });
  } catch {
    // Scroll to load lazy content and retry with broader selector
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    eventWrappers = page.locator('[class*="EventRowWrapper"]');
    const noEvents = await page.getByText(/Sorry we haven't found any events/i).isVisible({ timeout: 500 }).catch(() => false);
    if (!noEvents) {
      await expect(eventWrappers.first()).toBeVisible({ timeout: 10000 });
    } else {
      console.warn('No Football events available at this time. Exiting early.');
      return;
    }
  }

  const count = await eventWrappers.count();
  console.log(`🧠 Number of Football events: ${count}`);

  const results: {event: string, result: string}[] = [];
  const failedEvents: string[] = [];
  const passedEvents: string[] = [];
  
  // Test all events (not just a subset)
  const indices = Array.from({ length: count }, (_, i) => i);

  for (const i of indices) {
    const event = eventWrappers.nth(i);
    let title = `Football Event index ${i}`;
    
    // Get the event title from the participant element
    try {
      const titleElement = event.locator('[data-test="participant"]');
      title = await titleElement.innerText();
      console.log(`⚽ Testing event: ${title}`);
    } catch (e) {
      console.log(`⚠️  Could not get event title for index ${i}:`, e.message);
    }

    try {
      // Scroll the event into view
      await event.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000); // Give it a moment to render

      // Find and click the event link using the specific data-test attribute
      const eventLink = event.locator('[data-test="EventRowNameLink-link"]');
      
      console.log(`🖱️  Clicking on event: ${title}`);
      
      // Click and wait for navigation
      await Promise.all([
        page.waitForURL(/\/event\//, { timeout: 15_000 }),
        eventLink.click()
      ]);
      
      console.log(`✅ Successfully navigated to event: ${title}`);

      // 5) Wait for animated_widget elements (3D widgets in iframes)
      let animPassed = false;
      try {
        // First check if we're still on a valid page
        if (!(await page.title()).includes('PlanetSportBet')) {
          throw new Error('Page navigation failed - not on PlanetSportBet');
        }
        
        // Wait for the animation widget to appear
        await page.waitForSelector('.animated_widget', {
          state: 'visible',
          timeout: 15_000
        });
        
        // Additional check to ensure the widget is actually visible
        const isWidgetVisible = await page.locator('.animated_widget').isVisible();
        if (!isWidgetVisible) {
          throw new Error('Widget not visible');
        }
        
        animPassed = true;
        console.log(`✅ PASS: Animation found — ${title}`);
        passedEvents.push(title);
      } catch (e) {
        console.log(`❌ FAIL: No animation found — ${title} (${e.message})`);
        failedEvents.push(title);
      }

    results.push({ event: title, result: animPassed ? 'PASS' : 'FAIL' });

    } catch (e) {
      console.log(`❌ Error processing event ${i + 1}/${count}:`, e.message);
      failedEvents.push(`${title} (Error: ${e.message})`);
    } finally {
      try {
        // 6) Click back to In Play at the top of the page
        console.log(`🔄 Clicking In Play at top for event ${i + 1}/${count}...`);
        await page.locator('[data-test="inplay-link"]').click();
        await page.waitForTimeout(2000);
        
        // 7) Confirm we're back on All Sports tab
        await expect(page.locator('[data-test-filter-key="empty"]')).toBeVisible({ timeout: 10000 });
        console.log('🏆 Confirmed back on All Sports tab');
        
        // 8) Re-locate and click Football tab
        const footballRelocated = await locateAndClickFootballTab();
        if (!footballRelocated) {
          console.log('⚠️  Could not re-locate Football tab, attempting to continue...');
        }
        
        // Refresh the event wrappers reference
        eventWrappers = page.locator('[class*="EventRowWrapper"]');
        await expect(eventWrappers.first()).toBeVisible({ timeout: 10000 });
      } catch (e) {
        console.log('⚠️  Error during navigation back to events:', e.message);
        // If we can't navigate back, we need to restart the test
        throw e;
      }
    }
  }

  // 7) Generate comprehensive report
  console.log('\n=== FOOTBALL ANIMATION TEST RESULTS ===');
  
  const passCount = results.filter(r => r.result === 'PASS').length;
  const failCount = results.filter(r => r.result === 'FAIL').length;
  const passRate = count > 0 ? Math.round((passCount / count) * 100) : 0;

  console.log(`📊 Total Events: ${count}`);
  console.log(`✅ PASS: ${passCount} events with animations`);
  console.log(`❌ FAIL: ${failCount} events without animations`);
  console.log(`📈 Success Rate: ${passRate}%`);

  // Detailed results
  console.log('\n=== DETAILED RESULTS ===');
  results.forEach(r => console.log(`${r.result === 'PASS' ? '✅ PASS' : '❌ FAIL'}: ${r.event}`));

  // Failed events report
  if (failedEvents.length > 0) {
    console.log('\n=== FAILED EVENTS (NO ANIMATION) ===');
    failedEvents.forEach((event, index) => {
      console.log(`❌ FAIL: No animation found — ${event}`);
    });
  }

  // Passed events report
  if (passedEvents.length > 0) {
    console.log('\n=== PASSED EVENTS (ANIMATION FOUND) ===');
    passedEvents.forEach((event, index) => {
      console.log(`✅ PASS: Animation found — ${event}`);
    });
  }

  // Final assessment
  console.log('\n🏆 === FINAL ASSESSMENT ===');
  if (passRate >= 80) {
    console.log('🌟 EXCELLENT: Football section has strong animation coverage');
  } else if (passRate >= 60) {
    console.log('👍 GOOD: Football section has decent animation coverage');
  } else if (passRate >= 40) {
    console.log('⚠️  MODERATE: Football section has limited animation coverage');
  } else {
    console.log('🚨 POOR: Football section has minimal animation coverage');
  }

  console.log(`🎖️  Football Animation Coverage: ${passCount}/${count} events (${passRate}%)`);
});
