import { test, expect } from '@playwright/test';

test('PlanetSportBet – Cricket Tab Animation Check', async ({ page }) => {
  // 1) Land on PlanetSportBet and navigate to In Play section
  await page.goto('https://planetsportbet.com/');
  await page.getByRole('button', { name: /Allow all/i }).click();
  await page.locator('[data-test="close-icon"] path').click();
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
  const eventWrappers = page.locator('.css-f5hkhk-EventRowWrapper');
  await expect(eventWrappers.first()).toBeVisible({ timeout: 10_000 });

  const count = await eventWrappers.count();
  console.log(`🧠 Number of Cricket events: ${count}`);

  const results: {event: string, result: string}[] = [];
  const failedEvents: string[] = [];
  const passedEvents: string[] = [];
  
  // Test all events
  const indices = Array.from({ length: count }, (_, i) => i);

  for (const i of indices) {
    const event = eventWrappers.nth(i);
    let title = `Cricket Event index ${i}`;
    try {
      title = await event.locator('.css-1qujoqs-EventRowTitle').innerText();
    } catch {}

    await event.scrollIntoViewIfNeeded();

    // 5) Click and wait for navigation into the event page
    await Promise.all([
      page.waitForURL(/\/event\//, { timeout: 10_000 }),
      event.click()
    ]);

    // 6) Wait for animated_widget elements (3D widgets in iframes)
    let animPassed = false;
    try {
      await page.waitForSelector('.animated_widget', {
        state: 'visible',
        timeout: 15_000
      });
      animPassed = true;
      console.log(`✅ PASS: animated_widget found for — ${title}`);
      passedEvents.push(title);
    } catch {
      console.log(`❌ FAIL: no animated_widget for — ${title}`);
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
