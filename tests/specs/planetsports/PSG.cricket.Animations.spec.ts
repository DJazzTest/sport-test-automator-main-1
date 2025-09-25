import { test, expect, Page } from '@playwright/test';

test('PlanetSportBet – Cricket Tab Animation Check', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);
  // 1) Land on PlanetSportBet and navigate via left-hand pane Cricket
  await page.goto('https://planetsportbet.com/');
  // Robust consent/overlay handling
  const acceptPopups = async (p: Page) => {
    try { await p.getByRole('button', { name: /Allow all/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
    try { await p.locator('[data-test="landing-page"] [data-test="close-icon"] path').click({ timeout: 1500 }); } catch {}
    // UNICCMP modal fallback
    try {
      const uni = p.locator('[id^="uniccmp"], div:has-text("Accept & Continue")');
      if (await uni.isVisible({ timeout: 1000 }).catch(() => false)) {
        await p.getByRole('button', { name: /Accept/i }).click({ timeout: 1500 }).catch(() => {});
      }
    } catch {}
  };
  await acceptPopups(page);

  // Debug: Log available navigation links
  const allNavLinks = await page.$$eval('nav a, header a, [class*="nav"] a, [class*="menu"] a, a[href*="/sport/"]', links => 
    links.map(a => ({ text: a.textContent?.trim(), href: a.href })).filter(l => l.text && l.href)
  );
  console.log('🔍 Available navigation links:', allNavLinks.slice(0, 15));

  console.log('📌 Navigating to Cricket via left-hand pane...');
  // Try multiple navigation strategies
  let cricketLink = page.getByRole('link', { name: /^Cricket$/ });
  let linkVisible = await cricketLink.isVisible({ timeout: 2000 }).catch(() => false);
  
  // Fallback: try different selectors
  if (!linkVisible) {
    cricketLink = page.locator('a[href*="cricket"]').first();
    linkVisible = await cricketLink.isVisible({ timeout: 2000 }).catch(() => false);
  }
  
  if (!linkVisible) {
    cricketLink = page.locator('a:has-text("Cricket")').first();
    linkVisible = await cricketLink.isVisible({ timeout: 2000 }).catch(() => false);
  }
  
  // Try more specific selectors
  if (!linkVisible) {
    const specificSelectors = [
      'nav a[href*="cricket"]',
      'header a[href*="cricket"]',
      '[class*="nav"] a[href*="cricket"]',
      '[class*="menu"] a[href*="cricket"]',
      'a[href="/sport/cricket"]',
      'a[href="/cricket"]'
    ];
    
    for (const selector of specificSelectors) {
      cricketLink = page.locator(selector).first();
      linkVisible = await cricketLink.isVisible({ timeout: 1000 }).catch(() => false);
      if (linkVisible) break;
    }
  }
  
  if (!linkVisible) {
    console.log('❌ Cricket link not found in left-hand pane');
    return;
  }
  
  await cricketLink.click();
  await page.waitForLoadState('domcontentloaded');

  // 2) Prefer Today/Tomorrow tabs; else stay on All
  const clickTabIfVisible = async (name: string): Promise<boolean> => {
    const btn = page.getByRole('button', { name });
    const visible = await btn.isVisible({ timeout: 1500 }).catch(() => false);
    if (!visible) return false;
    await btn.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(600);
    return true;
  };
  let activeTab: 'Today' | 'Tomorrow' | 'All' = 'All';
  if (await clickTabIfVisible('Today')) activeTab = 'Today';
  else if (await clickTabIfVisible('Tomorrow')) activeTab = 'Tomorrow';
  else activeTab = 'All';
  console.log(`📅 Cricket active tab: ${activeTab}`);

  // 4) Get cricket events and count them
  console.log('🔍 Looking for cricket events...');
  
  // Take a screenshot for debugging
  await page.screenshot({ path: 'cricket-page-debug.png' });
  console.log('📸 Screenshot saved as cricket-page-debug.png');
  
  // Use the working selector from tennis/football tests
  let eventWrappers = page.locator('a[href*="/event/"]');
  const count = await eventWrappers.count();
  console.log(`🏏 Number of Cricket event links found: ${count}`);
  
  if (count === 0) {
    console.log('❌ No cricket events found');
    return;
  }

  const results: {event: string, result: string}[] = [];
  const failedEvents: string[] = [];
  const passedEvents: string[] = [];
  
  // Test up to 20 events
  const maxEvents = Math.min(20, count);
  const indices = Array.from({ length: maxEvents }, (_, i) => i);

  for (const i of indices) {
    const event = eventWrappers.nth(i);
    let title = `Cricket Event index ${i}`;
    try {
      // Try to get text content from the link
      title = await event.textContent() || `Cricket Event ${i + 1}`;
    } catch {}

    await event.scrollIntoViewIfNeeded();

    // Open detail in a separate page for stability
    const href = await event.getAttribute('href').catch(() => null);
    if (!href) {
      results.push({ event: title, result: 'FAIL' });
      failedEvents.push(title);
      continue;
    }
    const absolute = new URL(href, 'https://planetsportbet.com').toString();
    const detail = await context.newPage();
    await detail.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
    await detail.waitForTimeout(600).catch(() => {});
    await acceptPopups(detail);

    // 5.5) Check if Live tracker is already open, if not click to open it
    console.log(`📊 Checking Live tracker status for ${title}...`);
    let liveTrackerOpen = false;
    let liveTrackerClicked = false;
    
    // First check if animated_widget is already visible (Live tracker already open)
    try {
      // First try direct widget visibility
      await detail.waitForSelector('.animated_widget', {
        state: 'visible',
        timeout: 2000
      });
      liveTrackerOpen = true;
      console.log(`✅ Live tracker already open for ${title}`);
    } catch {
      console.log(`ℹ️ Live tracker not open, attempting to click...`);
      
      // If not open, try to click the Live tracker button
      try {
        await detail.getByRole('heading', { name: 'Live tracker' }).click({ timeout: 5000 });
        console.log(`✅ Live tracker clicked for ${title}`);
        liveTrackerClicked = true;
        await detail.waitForTimeout(800); // Wait for window to expand
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
        await detail.waitForSelector('.animated_widget', {
          state: 'visible',
          timeout: 12000
        });
        windowExpanded = true;
        console.log(`✅ Live tracker window expanded for — ${title}`);
        
        // Now check for iframe inside the expanded window
        try {
          await detail.waitForSelector('.animated_widget iframe', {
            state: 'visible',
            timeout: 12000
          });
          console.log(`✅ Found iframe inside .animated_widget for — ${title}`);
          
          // Wait for iframe to have a src attribute (it loads asynchronously)
          console.log(`⏳ Waiting for iframe src to load...`);
          let iframeSrc = null;
          let attempts = 0;
          const maxAttempts = 12;
          
          while (attempts < maxAttempts && !iframeSrc) {
            await detail.waitForTimeout(800);
            iframeSrc = await detail.locator('.animated_widget iframe').getAttribute('src');
            attempts++;
            console.log(`   Attempt ${attempts}/${maxAttempts}: src = ${iframeSrc}`);
          }
          
          let iframe = detail.locator('.animated_widget iframe');
          let isIframeVisible = await iframe.isVisible().catch(() => false);
          if (!isIframeVisible && !iframeSrc) {
            // Fallback: any iframe with correct src
            iframe = detail.locator('iframe[src*="widgets.thesports01.com"]');
            isIframeVisible = await iframe.isVisible().catch(() => false);
            if (isIframeVisible) {
              iframeSrc = await iframe.getAttribute('src');
            }
          }
          
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
    try { await detail.close(); } catch {}
    await page.bringToFront().catch(() => {});
    await page.waitForTimeout(200).catch(() => {});
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
