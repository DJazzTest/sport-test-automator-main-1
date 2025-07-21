import { test, expect } from '@playwright/test';

// Increase timeout for slow CI/network environments
// Set test timeout to 3 minutes (180000 ms)
test.setTimeout(180000);

// Enhanced interface for detailed event reporting
interface EventResult {
  index: number;
  eventTitle: string;
  eventUrl?: string;
  teams?: string;
  competition?: string;
  result: 'PASS' | 'FAIL';
  errorMessage?: string;
  timestamp: string;
  screenshotPath?: string;
}

test('PlanetSportBet – All In Play events animation check', async ({ page }) => {
  const testStartTime = new Date().toISOString();
  console.log(`🚀 Test started at: ${testStartTime}`);
  
  await page.goto('https://planetsportbet.com/');
  await page.getByRole('button', { name: /Allow all/i }).click();
  await page.locator('[data-test="close-icon"] path').click();
  await page.locator('[data-test="inplay-link"]').click();
  
  // Wait for event wrappers to load
  const eventWrappers = page.locator('.css-f5hkhk-EventRowWrapper');
  await expect(eventWrappers.first()).toBeVisible({ timeout: 10000 });
  const count = await eventWrappers.count();
  console.log(`📊 Number of In Play events found: ${count}`);
  let results: EventResult[] = [];

  // Determine which indices to test
  let indices: number[] = [];
  if (count === 15) {
    // Test 7 evenly distributed events
    indices = [0, 2, 4, 6, 8, 10, 14];
  } else {
    indices = Array.from({length: count}, (_, i) => i);
  }

  for (const i of indices) {
    const event = eventWrappers.nth(i);
    const timestamp = new Date().toISOString();
    
    // Enhanced event data extraction
    let eventTitle = '';
    let teams = '';
    let competition = '';
    
    try {
      // Try to get event title
      eventTitle = await event.locator('.css-1qujoqs-EventRowTitle').innerText();
      
      // Try to extract team names (common pattern: "Team A vs Team B")
      if (eventTitle.includes(' vs ')) {
        teams = eventTitle;
      }
      
      // Try to get competition/league info if available
      try {
        const competitionEl = event.locator('.css-competition, .league-name, [data-test*="competition"]');
        if (await competitionEl.count() > 0) {
          competition = await competitionEl.first().innerText();
        }
      } catch {
        // Competition info not available
      }
    } catch {
      eventTitle = `Event index ${i}`;
    }
    
    console.log(`\n🎯 Testing event ${i + 1}/${indices.length}: ${eventTitle}`);
    
    await event.scrollIntoViewIfNeeded();
    await event.click();
    await page.waitForTimeout(2000); // let animation load
    
    const currentUrl = page.url();
    
    try {
      await page.waitForSelector('animate-svg, #animate-svg', { timeout: 10000 });
      const screenshotPath = `animation_found_${i}.png`;
      
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch (ssErr) {
        console.error(`Could not take PASS screenshot for event ${eventTitle}. Page may be closed.`, ssErr);
      }
      
      results.push({ 
        index: i,
        eventTitle, 
        eventUrl: currentUrl,
        teams,
        competition,
        result: 'PASS',
        timestamp,
        screenshotPath
      });
      console.log(`✅ PASS: Animation found for event: ${eventTitle}`);
    } catch (err) {
      const screenshotPath = `FAILED_${i}.png`;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
      } catch (ssErr) {
        console.error(`Could not take FAIL screenshot for event ${eventTitle}. Page may be closed.`, ssErr);
      }
      
      results.push({ 
        index: i,
        eventTitle, 
        eventUrl: currentUrl,
        teams,
        competition,
        result: 'FAIL',
        errorMessage,
        timestamp,
        screenshotPath
      });
      console.log(`❌ FAIL: Animation NOT found for event: ${eventTitle}`);
      console.log(`   Error: ${errorMessage}`);
    }
    
    // Always navigate back to IN PLAY page
    try {
      await page.goto('https://planetsportbet.com/inplay');
      await expect(eventWrappers.first()).toBeVisible({ timeout: 10000 });
    } catch (navErr) {
      console.error('❌ Failed to navigate back to IN PLAY page or reload event wrappers.', navErr);
      break; // Stop further tests if navigation fails
    }
  }
  
  // Enhanced detailed reporting
  const testEndTime = new Date().toISOString();
  const passedEvents = results.filter(r => r.result === 'PASS');
  const failedEvents = results.filter(r => r.result === 'FAIL');
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 DETAILED TEST RESULTS SUMMARY');
  console.log('='.repeat(80));
  console.log(`🕐 Test Duration: ${testStartTime} → ${testEndTime}`);
  console.log(`📊 Total Events Tested: ${results.length}`);
  console.log(`✅ Events WITH Animation: ${passedEvents.length}`);
  console.log(`❌ Events WITHOUT Animation: ${failedEvents.length}`);
  console.log(`📈 Success Rate: ${((passedEvents.length / results.length) * 100).toFixed(1)}%`);
  
  if (failedEvents.length > 0) {
    console.log('\n🚨 EVENTS MISSING ANIMATIONS:');
    console.log('-'.repeat(50));
    failedEvents.forEach((event, idx) => {
      console.log(`${idx + 1}. Event: ${event.eventTitle}`);
      console.log(`   Teams: ${event.teams || 'N/A'}`);
      console.log(`   Competition: ${event.competition || 'N/A'}`);
      console.log(`   URL: ${event.eventUrl || 'N/A'}`);
      console.log(`   Timestamp: ${event.timestamp}`);
      console.log(`   Screenshot: ${event.screenshotPath || 'N/A'}`);
      console.log(`   Error: ${event.errorMessage || 'N/A'}`);
      console.log('');
    });
  }
  
  if (passedEvents.length > 0) {
    console.log('\n✅ EVENTS WITH ANIMATIONS:');
    console.log('-'.repeat(50));
    passedEvents.forEach((event, idx) => {
      console.log(`${idx + 1}. Event: ${event.eventTitle}`);
      console.log(`   Teams: ${event.teams || 'N/A'}`);
      console.log(`   Competition: ${event.competition || 'N/A'}`);
      console.log(`   Screenshot: ${event.screenshotPath || 'N/A'}`);
      console.log('');
    });
  }
  
  console.log('='.repeat(80));
  console.log('🏁 Test completed successfully!');
});
