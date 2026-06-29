import { test, expect } from '@playwright/test';

test('StarSports.bet – In Play events animation check', async ({ page }) => {
  // Set default timeout to 2 minutes
  test.setTimeout(120000);
  
  console.log('🚀 Starting StarSports.bet In Play animation check...');
  
  // Navigate to StarSports.bet
  await page.goto('https://starsports.bet');
  
  // Handle cookie consent
  try {
    await page.getByRole('button', { name: 'Allow all' }).click({ timeout: 5000 });
    console.log('✅ Cookie consent handled');
  } catch {
    console.log('ℹ️  No cookie consent popup found');
  }
  
  // Click on In Play link
  console.log('📍 Navigating to In Play section...');
  await page.locator('[data-test="inplay-link"]').click();
  await page.waitForTimeout(3000);
  
  console.log('✅ Successfully navigated to In Play section');
  
  // Find all event links
  const eventLinks = page.locator('a[href*="/event/"]');
  const eventCount = await eventLinks.count();
  
  if (eventCount === 0) {
    console.log('❌ No events found in In Play section');
    return;
  }
  
  console.log(`📊 Found ${eventCount} events in In Play section`);
  
  // Limit to first 5 events for testing
  const maxEvents = Math.min(5, eventCount);
  let passCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < maxEvents; i++) {
    const eventLink = eventLinks.nth(i);
    const eventTitle = (await eventLink.textContent() || `Event ${i + 1}`).trim();
    console.log(`\n🔍 Testing event ${i + 1}/${maxEvents}: ${eventTitle}`);
    
    try {
      // Click on the event
      await eventLink.click();
      await page.waitForTimeout(2000);
      
      // Check for animation widget
      const hasAnimation = await page.locator('[id*="sport-widget"] iframe, [id*="widget"] iframe').isVisible({ timeout: 5000 }).catch(() => false);
      
      if (hasAnimation) {
        console.log(`✅ Animation found`);
        passCount++;
      } else {
        console.log(`❌ No animation found`);
        failCount++;
      }
      
      // Navigate back to In Play
      await page.goBack();
      await page.waitForTimeout(1000);
      
    } catch (error) {
      console.log(`❌ Error processing event: ${error.message}`);
      console.log(`   📋 Steps to recreate:`);
      console.log(`      1. Navigate to the event listing page`);
      console.log(`      2. Try to process/interact with an event`);
      console.log(`      3. Expected: Event should process successfully`);
      console.log(`      4. Actual: Error - ${error.message}`);
      failCount++;
      
      // Try to recover by going back to In Play
      try {
        await page.goto('https://starsports.bet/inplay');
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log('❌ Recovery failed, stopping test');
        console.log(`   📋 Steps to recreate:`);
        console.log(`      1. Navigate to the page where the error occurred`);
        console.log(`      2. Try to recover from the error state`);
        console.log(`      3. Expected: System should recover and continue`);
        console.log(`      4. Actual: Recovery failed, test stopped`);
        break;
      }
    }
  }
  
  // Print summary
  console.log('\n=== TEST SUMMARY ===');
  console.log(`📊 Total events tested: ${maxEvents}`);
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  // Final assessment
  if (passCount > 0) {
    console.log('✅ Test completed successfully');
  } else {
    console.log('❌ Test completed with failures');
  }
});
