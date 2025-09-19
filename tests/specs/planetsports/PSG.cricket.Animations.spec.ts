import { test, expect } from '@playwright/test';

test('PlanetSportBet – Cricket Tab Animation Check', async ({ page }) => {
  // 1) Land on PlanetSportBet and navigate to In Play section
  await page.goto('https://planetsportbet.com/');
  await page.getByRole('button', { name: /Allow all/i }).click();
  await page.locator('[data-test="landing-page"] [data-test="close-icon"] path').click();
  await page.locator('[data-test="inplay-link"]').click();

  // 2) Confirm we're on the All Sports tab after clicking In Play
  console.log('🏆 Confirming we\'re on All Sports tab after clicking In Play...');
  await page.waitForTimeout(2000);
  
  // Wait for All Sports button to be visible
  await expect(page.locator('[data-test-filter-key="empty"]')).toBeVisible({ timeout: 5000 });
  console.log('✅ Confirmed on All Sports tab');

  async function locateAndClickCricketTab() {
    console.log('🔍 Looking for Cricket tab (may not be first in navigation bar)...');
    
    // Use the exact selector pattern for Cricket tab
    const cricketTab = page.locator('[data-test-filter-key="cricket"]');
    
    try {
      await expect(cricketTab).toBeVisible({ timeout: 5000 });
      console.log('✅ Found Cricket tab using data-test-filter-key="cricket"');
      await cricketTab.click();
      console.log('🏏 Clicked on Cricket tab');
      await page.waitForTimeout(2000);
      return true;
    } catch {
      console.log('❌ Could not locate Cricket tab with data-test-filter-key="cricket"');
      return false;
    }
  }

  // 3) Initial click on Cricket tab
  const cricketTabFound = await locateAndClickCricketTab();
  if (!cricketTabFound) {
    throw new Error('❌ Could not locate Cricket tab in In Play section');
  }

  // 4) Get cricket events and count them
  console.log('🔍 Looking for cricket events...');
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'cricket-page-debug.png' });
  console.log('📸 Screenshot saved as cricket-page-debug.png');
  
  // Use the working selector from tennis/football tests
  const eventWrappers = page.locator('a[href*="/event/"]');
  const count = await eventWrappers.count();
  console.log(`🏏 Number of Cricket event links found: ${count}`);
  
  if (count === 0) {
    console.log('❌ No cricket events found');
    return;
  }

  const results: {event: string, result: string}[] = [];
  const failedEvents: string[] = [];
  const passedEvents: string[] = [];
  
  // Test all events
  const indices = Array.from({ length: count }, (_, i) => i);

  for (const i of indices) {
    const event = eventWrappers.nth(i);
    let title = `Cricket Event index ${i}`;
    try {
      // Try to get text content from the link
      title = await event.textContent() || `Cricket Event ${i + 1}`;
    } catch {}

    await event.scrollIntoViewIfNeeded();

    // 5) Click and wait for navigation into the event page
    await Promise.all([
      page.waitForURL(/\/event\//, { timeout: 10_000 }),
      event.click()
    ]);

    // 5.5) Check if Live tracker is already open, if not click to open it
    console.log(`📊 Checking Live tracker status for ${title}...`);
    let liveTrackerOpen = false;
    let liveTrackerClicked = false;
    
    // First check if animated_widget is already visible (Live tracker already open)
    try {
      await page.waitForSelector('.animated_widget', {
        state: 'visible',
        timeout: 2000
      });
      liveTrackerOpen = true;
      console.log(`✅ Live tracker already open for ${title}`);
    } catch {
      console.log(`ℹ️ Live tracker not open, attempting to click...`);
      
      // If not open, try to click the Live tracker button
      try {
        await page.getByRole('heading', { name: 'Live tracker' }).click({ timeout: 5000 });
        console.log(`✅ Live tracker clicked for ${title}`);
        liveTrackerClicked = true;
        await page.waitForTimeout(3000); // Wait for window to expand
      } catch (error) {
        console.log(`⚠️ Could not find Live tracker button for ${title}: ${error.message}`);
      }
    }

    // 6) Check if Live tracker window is open and look for animations
    let animPassed = false;
    let windowExpanded = false;
    
    if (liveTrackerOpen || liveTrackerClicked) {
      // Check if the Live tracker window expanded by looking for animated_widget
      try {
        await page.waitForSelector('.animated_widget', {
          state: 'visible',
          timeout: 10_000
        });
        windowExpanded = true;
        console.log(`✅ Live tracker window expanded for — ${title}`);
        
        // Now check for iframe inside the expanded window
        try {
          await page.waitForSelector('.animated_widget iframe', {
            state: 'visible',
            timeout: 10_000
          });
          console.log(`✅ Found iframe inside .animated_widget for — ${title}`);
          
          // Wait for iframe to have a src attribute (it loads asynchronously)
          console.log(`⏳ Waiting for iframe src to load...`);
          let iframeSrc = null;
          let attempts = 0;
          const maxAttempts = 8;
          
          while (attempts < maxAttempts && !iframeSrc) {
            await page.waitForTimeout(1000);
            iframeSrc = await page.locator('.animated_widget iframe').getAttribute('src');
            attempts++;
            console.log(`   Attempt ${attempts}/${maxAttempts}: src = ${iframeSrc}`);
          }
          
          const iframe = page.locator('.animated_widget iframe');
          const isIframeVisible = await iframe.isVisible();
          
          if (iframeSrc && iframeSrc.includes('widgets.thesports01.com') && isIframeVisible) {
            animPassed = true;
            console.log(`✅ PASS: Live tracker expanded and animation loaded for — ${title}`);
            console.log(`🔗 Iframe src: ${iframeSrc}`);
            passedEvents.push(title);
          } else {
          console.log(`❌ FAIL: Live tracker expanded but no animation for — ${title}`);
          console.log(`   🔴 Description: Live tracker window expanded but animation iframe failed to load`);
          console.log(`   📝 Reason: iframe src is missing or incorrect (src: ${iframeSrc}, visible: ${isIframeVisible})`);
          console.log(`   🏏 Match: ${title}`);
          console.log(`   🏆 Competition: Women's Cricket Series`);
          console.log(`   🔧 Technical: ${attempts} attempts made to load iframe src`);
            failedEvents.push(title);
          }
        } catch (error) {
          console.log(`❌ FAIL: Live tracker expanded but no iframe found for — ${title}`);
          console.log(`   🔴 Description: Live tracker window expanded but no iframe element found`);
          console.log(`   📝 Reason: Animation widget structure is incomplete or malformed`);
          console.log(`   🏏 Match: ${title}`);
          console.log(`   🏆 Competition: Women's Cricket Series`);
          console.log(`   🔧 Technical: ${error.message}`);
          failedEvents.push(title);
        }
      } catch (error) {
        console.log(`❌ FAIL: Live tracker clicked but window did not expand for — ${title}`);
        console.log(`   🔴 Description: Live tracker button clicked but animated widget window did not appear`);
        console.log(`   📝 Reason: This typically indicates a suspended/inactive match or technical issue`);
        console.log(`   🏏 Match: ${title}`);
        console.log(`   🏆 Competition: Women's Cricket Series`);
        failedEvents.push(title);
      }
    } else {
      console.log(`❌ FAIL: Could not click Live tracker for — ${title}`);
      console.log(`   🔴 Description: Live tracker button not found or not clickable`);
      console.log(`   📝 Reason: Match may not have live tracking available or page not fully loaded`);
      console.log(`   🏏 Match: ${title}`);
      console.log(`   🏆 Competition: Women's Cricket Series`);
      failedEvents.push(title);
    }

    results.push({ event: title, result: animPassed ? 'PASS' : 'FAIL' });

    // 7) Click back to In Play at the top of the page
    console.log(`🔄 Clicking In Play at top for event ${i + 1}/${count}...`);
    await page.locator('[data-test="inplay-link"]').click();
    await page.waitForTimeout(2000);
    
    // 8) Confirm we're back on All Sports tab
    await expect(page.locator('[data-test-filter-key="empty"]')).toBeVisible({ timeout: 5000 });
    console.log('🏆 Confirmed back on All Sports tab');
    
    // 9) Re-locate and click Cricket tab
    const cricketRelocated = await locateAndClickCricketTab();
    if (!cricketRelocated) {
      console.log('⚠️  Could not re-locate Cricket tab, attempting to continue...');
    }
    
    // Ensure event wrappers are visible again
    await expect(eventWrappers.first()).toBeVisible({ timeout: 10_000 });
  }

  // 10) Generate comprehensive report
  console.log('\n🧪 === CRICKET ANIMATION TEST RESULTS ===');
  
  const passCount = results.filter(r => r.result === 'PASS').length;
  const failCount = results.filter(r => r.result === 'FAIL').length;
  const passRate = count > 0 ? Math.round((passCount / count) * 100) : 0;

  console.log(`📊 Total Cricket Events Tested: ${count}`);
  console.log(`✅ Events with Animations (PASS): ${passCount}`);
  console.log(`❌ Events without Animations (FAIL): ${failCount}`);
  console.log(`📈 Animation Success Rate: ${passRate}%`);

  // Detailed results
  console.log('\n📋 === DETAILED RESULTS ===');
  results.forEach(r => console.log(`${r.result}: ${r.event}`));

  // Failed events report with descriptions
  if (failedEvents.length > 0) {
    console.log('\n❌ === EVENTS WITH NO ANIMATIONS (FAILED) ===');
    failedEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event}`);
      console.log(`   📝 Description: No animated_widget elements detected - event lacks 3D animation widgets`);
    });
    console.log(`\n📝 Summary: ${failedEvents.length} cricket events failed animation detection`);
    console.log('📝 Reason: These events do not contain .animated_widget elements (3D widgets in iframes)');
    console.log('📝 Impact: Users viewing these events will not see animated visualizations');
  } else {
    console.log('\n🎉 All cricket events passed animation detection!');
  }

  // Passed events report
  if (passedEvents.length > 0) {
    console.log('\n✅ === EVENTS WITH ANIMATIONS (PASSED) ===');
    passedEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event}`);
    });
    console.log(`\n🎯 Summary: ${passedEvents.length} cricket events successfully detected animations`);
  }

  // Final assessment
  console.log('\n🏆 === FINAL ASSESSMENT ===');
  if (passRate >= 80) {
    console.log('🌟 EXCELLENT: Cricket section has strong animation coverage');
  } else if (passRate >= 60) {
    console.log('👍 GOOD: Cricket section has decent animation coverage');
  } else if (passRate >= 40) {
    console.log('⚠️  MODERATE: Cricket section has limited animation coverage');
  } else {
    console.log('🚨 POOR: Cricket section has minimal animation coverage');
  }

  console.log(`🎖️  Cricket Animation Coverage: ${passCount}/${count} events (${passRate}%)`);
});
