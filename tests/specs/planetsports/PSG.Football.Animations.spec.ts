import { test, expect } from '@playwright/test';

test('PlanetSportBet – Football Animation Check', async ({ page }) => {
  console.log('🚀 Starting Football Animation Test...');
  
  // 1) Land on PlanetSportBet and handle initial setup
  await page.goto('https://planetsportbet.com/');
  await page.getByRole('button', { name: /Allow all/i }).click();
  
  // Handle close icon with error handling
  try {
    await page.locator('[data-test="landing-page"] [data-test="close-icon"] path').click({ timeout: 3000 });
    console.log('✅ Popup closed');
  } catch (error) {
    console.log('ℹ️ No popup to close');
  }
  
  // 2) Navigate to Football section
  console.log('🏈 Navigating to Football section...');
  await page.locator('[data-test="popular"]').getByRole('link', { name: 'Football' }).click();
  await page.waitForTimeout(2000);
  
  // 3) Click on Today tab
  console.log('📅 Clicking Today tab...');
  await page.getByRole('button', { name: 'Today' }).click();
  await page.waitForTimeout(2000);
  
  // 4) Get football events and count them
  console.log('🔍 Looking for football events...');
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'football-page-debug.png' });
  console.log('📸 Screenshot saved as football-page-debug.png');
  
  // Use the working selector from tennis test
  const eventWrappers = page.locator('a[href*="/event/"]');
  const count = await eventWrappers.count();
  console.log(`⚽ Found ${count} football event links`);
  
  if (count === 0) {
    console.log('❌ No football events found on Today tab');
    return;
  }
  
  try {
    // Test first few events (max 3 to avoid timeout)
    const maxEvents = Math.min(3, count);
    const results: {event: string, result: string}[] = [];
    
    for (let i = 0; i < maxEvents; i++) {
      const event = eventWrappers.nth(i);
      let title = `Football Event ${i + 1}`;
      
      try {
        // Get text content from the link
        title = await event.textContent() || `Football Event ${i + 1}`;
      } catch {}
      
      console.log(`\n🎯 Testing event ${i + 1}/${maxEvents}: ${title}`);
      
      await event.scrollIntoViewIfNeeded();
      
      // Click on the event
      try {
        await Promise.all([
          page.waitForURL(/\/event\//, { timeout: 10000 }),
          event.click()
        ]);
        console.log(`✅ Successfully clicked on: ${title}`);
        
        // Wait for page to load after clicking event
        console.log(`⏳ Waiting 3 seconds for page to load...`);
        await page.waitForTimeout(3000);
        
        // Check if Live tracker is already open, if not click to open it
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
            await page.waitForTimeout(2000);
          } catch (error) {
          console.log(`❌ FAIL: Could not find Live tracker button for — ${title}`);
          console.log(`   🔴 Description: Live tracker button not found or not clickable`);
          console.log(`   📝 Reason: Match may not have live tracking available or page not fully loaded`);
          console.log(`   ⚽ Match: ${title}`);
          console.log(`   🏆 Competition: Various Football Leagues`);
          console.log(`   🔧 Technical: ${error.message}`);
          }
        }
        
        // Wait for animated widget with longer delay to see animations
        let animPassed = false;
        
        if (liveTrackerOpen || liveTrackerClicked) {
          try {
            console.log(`🎬 Looking for animated_widget iframe for ${title}...`);
            
            // Wait for the specific animated widget div to appear
            await page.waitForSelector('.animated_widget', {
              state: 'visible',
              timeout: 15000
            });
            console.log(`✅ Found .animated_widget div`);
            
            // Wait for the iframe inside the animated_widget
            await page.waitForSelector('.animated_widget iframe', {
              state: 'visible',
              timeout: 10000
            });
            console.log(`✅ Found iframe inside .animated_widget`);
          
          // Verify the iframe has the correct src pattern
          const iframe = page.locator('.animated_widget iframe');
          const iframeSrc = await iframe.getAttribute('src');
          console.log(`🔗 Iframe src: ${iframeSrc}`);
          
          // Check if the iframe is actually visible and has content
          const isIframeVisible = await iframe.isVisible();
          const iframeContent = await iframe.contentFrame();
          
          if (iframeSrc && iframeSrc.includes('widgets.thesports01.com') && isIframeVisible) {
            animPassed = true;
            console.log(`✅ PASS: animated_widget iframe found with correct src and is visible for — ${title}`);
            
            // Additional verification - check if iframe has content
            if (iframeContent) {
              console.log(`✅ PASS: iframe content frame is accessible`);
            } else {
              console.log(`⚠️ WARNING: iframe content frame not accessible (may be cross-origin)`);
            }
          } else {
            console.log(`❌ FAIL: Live tracker expanded but no animation for — ${title}`);
            console.log(`   🔴 Description: Live tracker window expanded but animation iframe failed to load`);
            console.log(`   📝 Reason: iframe src is missing or incorrect (src: ${iframeSrc}, visible: ${isIframeVisible})`);
            console.log(`   ⚽ Match: ${title}`);
            console.log(`   🏆 Competition: Various Football Leagues`);
            console.log(`   🔧 Technical: Src contains widgets.thesports01.com: ${iframeSrc?.includes('widgets.thesports01.com')}`);
          }
          
          // Wait longer to see the animation load and play
          console.log(`⏳ Waiting 10 seconds to observe 3D football animation...`);
          await page.waitForTimeout(10000);
          
          } catch (error) {
            console.log(`❌ FAIL: no animated_widget iframe found for — ${title}`);
            console.log(`   🔴 Description: Live tracker open but animated widget window not accessible`);
            console.log(`   📝 Reason: This typically indicates a suspended/inactive match or technical issue`);
            console.log(`   ⚽ Match: ${title}`);
            console.log(`   🏆 Competition: Various Football Leagues`);
            console.log(`   🔧 Technical: ${error.message}`);
          }
        } else {
          console.log(`❌ FAIL: Live tracker not accessible for — ${title}`);
          console.log(`   🔴 Description: Live tracker not found or not clickable`);
          console.log(`   📝 Reason: Match may not have live tracking available`);
          console.log(`   ⚽ Match: ${title}`);
          console.log(`   🏆 Competition: Various Football Leagues`);
        }
        
        results.push({ event: title, result: animPassed ? 'PASS' : 'FAIL' });
        
        // Go back to football page
        console.log(`🔄 Going back to Football page...`);
        await page.locator('[data-test="popular"]').getByRole('link', { name: 'Football' }).click();
        await page.waitForTimeout(3000);
        
        // Click Today tab again
        console.log(`📅 Clicking Today tab again...`);
        await page.getByRole('button', { name: 'Today' }).click();
        await page.waitForTimeout(3000);
        
        // Ensure events are visible again
        await expect(eventWrappers.first()).toBeVisible({ timeout: 10000 });
        
      } catch (error) {
        console.log(`❌ Failed to test event: ${title} - ${error.message}`);
        results.push({ event: title, result: 'ERROR' });
      }
    }
    
    // Generate report
    console.log('\n🧪 === FOOTBALL ANIMATION TEST RESULTS ===');
    const passCount = results.filter(r => r.result === 'PASS').length;
    const failCount = results.filter(r => r.result === 'FAIL').length;
    const errorCount = results.filter(r => r.result === 'ERROR').length;
    const passRate = maxEvents > 0 ? Math.round((passCount / maxEvents) * 100) : 0;
    
    console.log(`📊 Total Football Events Tested: ${maxEvents}`);
    console.log(`✅ Events with Animations (PASS): ${passCount}`);
    console.log(`❌ Events without Animations (FAIL): ${failCount}`);
    console.log(`🚨 Events with Errors (ERROR): ${errorCount}`);
    console.log(`📈 Animation Success Rate: ${passRate}%`);
    
    console.log('\n📋 === DETAILED RESULTS ===');
    results.forEach(r => console.log(`${r.result}: ${r.event}`));
    
  } catch (error) {
    console.log('❌ Could not find football events or navigate properly');
    console.log('Error:', error.message);
  }
  
  console.log('\n🏁 Football Animation Test completed!');
});
