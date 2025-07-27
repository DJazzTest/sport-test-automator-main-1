import { test, expect } from '@playwright/test';

// Configure test with retries and timeout
test.describe.configure({ mode: 'serial', retries: 2 });

test('PlanetSportBet – In Play events animation check (v4)', async ({ page }) => {
  // Increase default timeout for all actions in this test
  test.setTimeout(300000); // 5 minutes

  // Helper function to wait for network to be idle
  const waitForNetworkIdle = async () => {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
  };

  // 1) Land on In Play list with retries
  let retries = 3;
  while (retries > 0) {
    try {
      await page.goto('https://planetsportbet.com/', { waitUntil: 'domcontentloaded' });
      
      // Handle cookie consent if present
      const allowAllButton = page.getByRole('button', { name: /Allow all/i }).first();
      if (await allowAllButton.isVisible({ timeout: 10000 })) {
        await allowAllButton.click();
      }

      // Close any popups
      const closeIcon = page.locator('[data-test="close-icon"] path').first();
      if (await closeIcon.isVisible({ timeout: 5000 })) {
        await closeIcon.click();
      }

      // Navigate to In Play
      const inPlayLink = page.locator('[data-test="inplay-link"]').first();
      await inPlayLink.click({ timeout: 15000 });
      
      // Wait for events to load
      await page.waitForSelector('.css-f5hkhk-EventRowWrapper', { state: 'visible', timeout: 30000 });
      break; // Success, exit retry loop
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      console.log(`Retrying navigation (${retries} attempts left)...`);
      await page.waitForTimeout(2000);
    }
  }

  const eventWrappers = page.locator('.css-f5hkhk-EventRowWrapper');
  await expect(eventWrappers.first()).toBeVisible({ timeout: 30000 });

  const count = await eventWrappers.count();
  console.log(`🧠 Number of In Play events: ${count}`);

  // Limit to first 5 events for CI
  const maxEvents = process.env.CI ? Math.min(5, count) : count;
  const results: {event: string, result: string}[] = [];
  
  for (let i = 0; i < maxEvents; i++) {
    const event = eventWrappers.nth(i);
    let title = `Event index ${i}`;
    
    try {
      // Get event title with retry
      const titleElement = event.locator('.css-1qujoqs-EventRowTitle').first();
      if (await titleElement.isVisible({ timeout: 5000 })) {
        title = (await titleElement.innerText()).trim();
      }
      console.log(`\n🔍 Testing event: ${title}`);
      
      // Scroll to element with retry
      await event.scrollIntoViewIfNeeded({ timeout: 10000 });
      await page.waitForTimeout(1000); // Small delay for any animations

      // 2) Click and wait for navigation into the event page
      console.log('  ↳ Navigating to event page...');
      await Promise.all([
        page.waitForURL(/\/event\//, { timeout: 30000 }),
        event.click({ timeout: 15000 })
      ]);

      // Wait for page to fully load
      await waitForNetworkIdle();

      // 3) Check for animated_widget with retry logic
      console.log('  ↳ Checking for animations...');
      let animPassed = false;
      
      // Try multiple selectors that might indicate animation
      const animationSelectors = [
        '.animated_widget',
        'iframe[id*="widget"]',
        'iframe[src*="3d"]',
        'iframe[src*="animation"]'
      ];

      for (const selector of animationSelectors) {
        try {
          await page.waitForSelector(selector, {
            state: 'visible',
            timeout: 10000
          });
          animPassed = true;
          console.log(`✅ PASS: Found animation element with selector: ${selector}`);
          break;
        } catch (e) {
          // Continue to next selector
        }
      }

      if (!animPassed) {
        console.log('❌ FAIL: No animation elements found with any selector');
      }

      results.push({ event: title, result: animPassed ? 'PASS' : 'FAIL' });

      // 4) Go back to the In Play list with retry
      console.log('  ↳ Returning to event list...');
      await page.goBack({ timeout: 30000 });
      
      // Wait for event list to be visible again
      await expect(eventWrappers.first()).toBeVisible({ timeout: 30000 });
      await waitForNetworkIdle();
      
    } catch (error) {
      console.error(`❌ Error processing event ${i}:`, error);
      results.push({ event: title, result: 'ERROR' });
      
      // Try to recover by going back to the event list
      try {
        await page.goto('https://planetsportbet.com/inplay', { waitUntil: 'domcontentloaded' });
        await waitForNetworkIdle();
      } catch (recoveryError) {
        console.error('Failed to recover to event list:', recoveryError);
        // If we can't recover, fail the test
        throw error;
      }
    }
  }

  // Print final results
  console.log('\n🧪 --- Test Results ---');
  results.forEach(r => console.log(`${r.result.padEnd(5)}: ${r.event}`));
  
  // Calculate and log pass rate
  const passed = results.filter(r => r.result === 'PASS').length;
  const passRate = (passed / results.length) * 100;
  console.log(`\n📊 ${passed}/${results.length} tests passed (${passRate.toFixed(1)}%)`);
  
  // Fail the test if pass rate is below 50% (adjust threshold as needed)
  if (passRate < 50) {
    throw new Error(`Test failed: Pass rate (${passRate.toFixed(1)}%) is below threshold`);
  }
});
