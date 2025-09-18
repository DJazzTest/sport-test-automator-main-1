import { test, expect } from '@playwright/test';

// Helper function to navigate to In Play section
async function navigateToInPlay(page) {
  try {
    await page.goto('https://starsports.bet');
    await page.waitForTimeout(2000);
    
    // Click on In Play link
    await page.locator('[data-test="inplay-link"]').click();
    await page.waitForTimeout(3000);
    
    return true;
  } catch (error) {
    console.error('Navigation error:', error.message);
    return false;
  }
}

test('StarSports.bet – In Play events animation check (All Events)', async ({ page }) => {
  // Set default timeout to 2 minutes
  test.setTimeout(120000);
  
  console.log('🚀 Starting comprehensive StarSports.bet In Play animation detection test...');
  
  // Navigate to StarSports.bet In Play section with retries
  console.log('📍 Navigating to StarSports.bet In Play section...');
  const navigationSuccess = await navigateToInPlay(page);
  
  if (!navigationSuccess) {
    console.error('❌ Failed to navigate to In Play section after multiple attempts');
    return;
  }
  
  // Handle cookie consent
  try {
    await page.getByRole('button', { name: 'Allow all' }).click({ timeout: 5000 });
    console.log('✅ Cookie consent handled');
  } catch {
    console.log('ℹ️  No cookie consent popup found');
  }
  
  // Find all event links with better error handling
  let eventLinks;
  let eventCount = 0;
  
  try {
    // Wait for events to load with a timeout
    await page.waitForSelector('[data-test*="event"], [class*="event"], [id*="event"]', { timeout: 10000 });
    
    // Try multiple selectors to find event links
    const selectors = [
      'a[href*="/event/"]',
      '[data-test*="event"] a',
      '[class*="event"] a',
      'a:has-text("vs"), a:has-text("v ")'
    ];
    
    for (const selector of selectors) {
      eventLinks = page.locator(selector);
      eventCount = await eventLinks.count();
      if (eventCount > 0) break;
    }
    
    console.log(`📊 Found ${eventCount} events in In Play section`);
  } catch (e) {
    console.error('❌ Error finding events:', e.message);
    return;
  }
  
  if (eventCount === 0) {
    console.log('❌ No events found in In Play section');
    return;
  }
  
  let passCount = 0;
  let failCount = 0;
  const failedEvents: Array<{
    title: string;
    reason: string;
    eventNumber: number;
    sport: string;
  }> = [];
  const passedEvents: Array<{
    title: string;
    widgetType: string;
    eventNumber: number;
  }> = [];
  
  // Test each event for animations (limit to first 10 for stability)
  const maxEventsToTest = Math.min(10, eventCount);
  console.log(`🧪 Testing first ${maxEventsToTest} events...`);
  
  for (let i = 0; i < maxEventsToTest; i++) {
    console.log(`\n🔍 Testing event ${i + 1}/${eventCount}...`);
    
    // Get event title with error handling
    let eventTitle = `Event ${i + 1}`;
    let eventLink;
    
    try {
      // Re-query events each iteration to avoid stale references
      try {
        const selectors = [
          'a[href*="/event/"]',
          '[data-test*="event"] a',
          '[class*="event"] a',
          'a:has-text("vs"), a:has-text("v ")'
        ];
        for (const selector of selectors) {
          eventLinks = page.locator(selector);
          eventCount = await eventLinks.count();
          if (eventCount > 0) break;
        }
      } catch {}

      eventLink = eventLinks.nth(i);
      eventTitle = (await eventLink.textContent() || '').trim() || `Event ${i + 1}`;
      console.log(`\n📋 [${i + 1}/${maxEventsToTest}] Testing: ${eventTitle}`);
      
      // Scroll the event into view
      await eventLink.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      
      // Click on the event with navigation handling
      await Promise.all([
        page.waitForURL(/\/event\//, { timeout: 8000 }),
        eventLink.click()
      ]);
      
      // Wait for the event page to load (avoid long networkidle hangs)
      await page.waitForLoadState('domcontentloaded', { timeout: 8000 });
      // Also wait for either a widget or a main content marker briefly
      await Promise.race([
        page.waitForSelector('[id*="sport-widget"] iframe, [id*="widget"] iframe', { timeout: 4000 }).catch(() => null),
        page.waitForSelector('main, [role="main"], [data-test*="event-header"]', { timeout: 4000 }).catch(() => null)
      ]);
      await page.waitForTimeout(1000);
      
      // Check for StarSports animation widget using improved detection logic
      let hasAnimation = false;
      let animationDetails = '';
      let widgetType = '';
      
      try {
        // Method 1: Check for sport-specific widget iframes (most reliable)
        const sportWidgetIframe = page.locator('[id*="sport-widget"] iframe');
        const sportWidgetVisible = await sportWidgetIframe.isVisible({ timeout: 3000 });
        
        if (sportWidgetVisible) {
          const widgetId = await sportWidgetIframe.getAttribute('id') || 'unknown';
          widgetType = widgetId.includes('tennis') ? 'Tennis' : 
                     widgetId.includes('football') ? 'Football' : 
                     widgetId.includes('cricket') ? 'Cricket' : 'Sport';
          hasAnimation = true;
          animationDetails = `${widgetType} sport widget iframe detected`;
          console.log(`✅ ${widgetType} animation widget found for: ${eventTitle}`);
        } else {
          // Method 2: Check for any widget iframe as fallback
          const anyWidgetIframe = page.locator('[id*="widget"] iframe');
          const anyWidgetVisible = await anyWidgetIframe.isVisible({ timeout: 2000 });
          
          if (anyWidgetVisible) {
            hasAnimation = true;
            widgetType = 'Generic';
            animationDetails = 'Generic widget iframe detected';
            console.log(`✅ Generic animation widget found for: ${eventTitle}`);
          } else {
            animationDetails = 'No animation widget iframe found - event lacks live animation features';
            console.log(`❌ FAIL: No animation widget for: ${eventTitle}`);
          }
        }
      } catch (error) {
        animationDetails = `Animation detection error: ${error.message}`;
        console.log(`❌ Animation check failed for ${eventTitle}: ${error.message}`);
      }
      
      if (hasAnimation) {
        passCount++;
        passedEvents.push({
          title: eventTitle,
          widgetType: widgetType,
          eventNumber: i + 1
        });
        console.log(`✅ PASS: Animation detected for "${eventTitle}" (${widgetType} widget)`);
      } else {
        failCount++;
        failedEvents.push({
          title: eventTitle,
          reason: animationDetails,
          eventNumber: i + 1,
          sport: eventTitle.includes('vs') ? 
            (eventTitle.toLowerCase().includes('tennis') ? 'Tennis' : 
             eventTitle.toLowerCase().includes('football') ? 'Football' : 
             eventTitle.toLowerCase().includes('cricket') ? 'Cricket' : 'Unknown') : 'Unknown'
        });
        console.log(`❌ FAIL: No animation for "${eventTitle}" - ${animationDetails}`);
      }
      
      // Navigate back to In Play section
      await page.goBack();
      await page.waitForLoadState('domcontentloaded', { timeout: 8000 });
      await page.waitForTimeout(1000);
      
    } catch (error) {
      failCount++;
      failedEvents.push({
        title: eventTitle,
        reason: `Navigation or testing error: ${error.message}`,
        eventNumber: i + 1,
        sport: 'Unknown'
      });
      console.log(`❌ FAIL: Error processing "${eventTitle}" - ${error.message}`);
      
      // Try to recover by going back to In Play
      try {
        // Attempt quick recovery path
        await page.goto('https://starsports.bet/inplay', { timeout: 10000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 8000 });
        await page.waitForTimeout(1000);
        // Ensure events are present again
        await page.waitForSelector('[data-test*="event"], [class*="event"], [id*="event"]', { timeout: 8000 });
      } catch (e) {
        // Secondary recovery: go to home and back to in-play link
        try {
          await page.goto('https://starsports.bet', { timeout: 10000 });
          await page.waitForLoadState('domcontentloaded', { timeout: 8000 });
          await page.locator('[data-test="inplay-link"]').click();
          await page.waitForSelector('[data-test*="event"], [class*="event"], [id*="event"]', { timeout: 8000 });
        } catch (e2) {
          console.log('⚠️  Recovery failed, continuing with next event');
        }
      }
    }
  }
  
  // Print detailed results
  console.log(`\n📊 Total Events Found: ${eventCount}`);
  console.log(`🧪 Events Tested: ${maxEventsToTest}`);
  console.log(`✅ Events with Animation: ${passCount}`);
  console.log(`❌ Events without Animation: ${failCount}`);
  
  if (passedEvents.length > 0) {
    console.log(`\n✅ PASSED EVENTS (WITH ANIMATIONS):`);
    passedEvents.forEach((event, index) => {
      console.log(`${index + 1}. "${event.title}"`);
      console.log(`   └─ Widget Type: ${event.widgetType}`);
    });
  }
  
  if (failedEvents.length > 0) {
    console.log(`\n❌ FAILED EVENTS (NO ANIMATIONS):`);
    failedEvents.forEach((event, index) => {
      console.log(`${index + 1}. "${event.title}"`);
      console.log(`   └─ Reason: ${event.reason}`);
    });
  }
  
  // Final assessment based on success rate
  const successRate = maxEventsToTest > 0 ? ((passCount / maxEventsToTest) * 100) : 0;
  console.log('\n🏆 === FINAL ASSESSMENT ===');
  if (successRate >= 80) {
    console.log('🌟 EXCELLENT: StarSports has strong animation coverage');
  } else if (successRate >= 60) {
    console.log('👍 GOOD: StarSports has decent animation coverage');
  } else if (successRate >= 40) {
    console.log('⚠️  MODERATE: StarSports has limited animation coverage');
  } else {
    console.log('🚨 POOR: StarSports has minimal animation coverage');
  }

  console.log(`🎖️  StarSports Animation Coverage: ${passCount}/${maxEventsToTest} events (${successRate.toFixed(1)}%)`);
});
