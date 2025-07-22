import { test, expect } from '@playwright/test';

test('PlanetSportBet – Football Tab Animation Check', async ({ page }) => {
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

  // 3) Get football events and count them
  const eventWrappers = page.locator('.css-f5hkhk-EventRowWrapper');
  await expect(eventWrappers.first()).toBeVisible({ timeout: 10_000 });

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
    try {
      title = await event.locator('.css-1qujoqs-EventRowTitle').innerText();
    } catch {}

    await event.scrollIntoViewIfNeeded();

    // 4) Click and wait for navigation into the event page
    await Promise.all([
      page.waitForURL(/\/event\//, { timeout: 10_000 }),
      event.click()
    ]);

    // 5) Wait for animated_widget elements (3D widgets in iframes)
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

    // 6) Click back to In Play at the top of the page
    console.log(`🔄 Clicking In Play at top for event ${i + 1}/${count}...`);
    await page.locator('[data-test="inplay-link"]').click();
    await page.waitForTimeout(2000);
    
    // 7) Confirm we're back on All Sports tab
    await expect(page.locator('[data-test-filter-key="empty"]')).toBeVisible({ timeout: 5000 });
    console.log('🏆 Confirmed back on All Sports tab');
    
    // 8) Re-locate and click Football tab
    const footballRelocated = await locateAndClickFootballTab();
    if (!footballRelocated) {
      console.log('⚠️  Could not re-locate Football tab, attempting to continue...');
    }
    
    // Ensure event wrappers are visible again
    await expect(eventWrappers.first()).toBeVisible({ timeout: 10_000 });
  }

  // 7) Generate comprehensive report
  console.log('\n🧪 === FOOTBALL ANIMATION TEST RESULTS ===');
  
  const passCount = results.filter(r => r.result === 'PASS').length;
  const failCount = results.filter(r => r.result === 'FAIL').length;
  const passRate = count > 0 ? Math.round((passCount / count) * 100) : 0;

  console.log(`📊 Total Football Events Tested: ${count}`);
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
    console.log(`\n📝 Summary: ${failedEvents.length} football events failed animation detection`);
    console.log('📝 Reason: These events do not contain .animated_widget elements (3D widgets in iframes)');
    console.log('📝 Impact: Users viewing these events will not see animated visualizations');
  } else {
    console.log('\n🎉 All football events passed animation detection!');
  }

  // Passed events report
  if (passedEvents.length > 0) {
    console.log('\n✅ === EVENTS WITH ANIMATIONS (PASSED) ===');
    passedEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event}`);
    });
    console.log(`\n🎯 Summary: ${passedEvents.length} football events successfully detected animations`);
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
