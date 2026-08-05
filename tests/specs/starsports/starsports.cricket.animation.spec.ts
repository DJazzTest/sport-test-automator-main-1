import { test, expect } from '@playwright/test';
import { ANIMATION_EVENTS_PER_SPORT, pickRandomIndices } from '../../lib/animation-sample';
import {
  appendAnimationEmailFailures,
  formatAnimationFailLine,
  missingAnimationsAssertMessage,
} from '../../Utils/animationEmailReport';

test('StarSports Cricket Animation/tests/specs/starsports/starsports.cricket.animation.spec.ts', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);

  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
    try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
  };

  await page.goto('https://starsports.bet/', { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  
  console.log('🏏 Navigating to Cricket via left-hand side...');
  await page.getByRole('link', { name: 'Cricket' }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2000);

  // Take a screenshot for debugging
  await page.screenshot({ path: 'starsports-cricket-debug.png' });
  console.log('📸 Screenshot saved as starsports-cricket-debug.png');

  // Debug: Check what buttons are available
  const allButtons = await page.locator('button').all();
  console.log('🔍 Available buttons:', await Promise.all(allButtons.map(async btn => {
    const text = await btn.innerText().catch(() => '');
    return text.trim();
  })).then(texts => texts.filter(t => t && t.length > 0).slice(0, 20)));

  // Check for Today/Tomorrow tabs
  const checkTabVisibility = async (tabName: string): Promise<boolean> => {
    const btn = page.getByRole('button', { name: tabName });
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`✅ Tab visibility – ${tabName}: ${visible}`);
    return visible;
  };

  const todayVisible = await checkTabVisibility('Today');
  const tomorrowVisible = await checkTabVisibility('Tomorrow');

  // Test function for a specific tab
  const testTab = async (tabName: string, eventsTestedSoFar: number): Promise<{pass: number, fail: number, results: string[]}> => {
    const remaining = ANIMATION_EVENTS_PER_SPORT - eventsTestedSoFar;
    if (remaining <= 0) {
      console.log(`ℹ️ Sport-wide budget of ${ANIMATION_EVENTS_PER_SPORT} events reached — skipping ${tabName} tab`);
      return {pass: 0, fail: 0, results: []};
    }

    console.log(`\n🔍 Testing ${tabName} tab...`);
    
    // Click tab if not Anytime (which is already active by default)
    if (tabName !== 'Anytime') {
      const btn = page.getByRole('button', { name: tabName });
      const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) {
        console.log(`🖱️ Clicking ${tabName} tab...`);
        await btn.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(800);
      } else {
        console.log(`ℹ️ ${tabName} tab not visible, skipping...`);
        return {pass: 0, fail: 0, results: []};
      }
    }

    // Find event links using the correct selector
    const eventLinks = page.locator('[data-test="EventRowNameLink-link"]');
    const total = await eventLinks.count().catch(() => 0);

    // Debug: Check for other possible event selectors
    if (total === 0) {
      console.log(`🔍 No events found with [data-test="EventRowNameLink-link"], trying other selectors...`);
      
      const altSelectors = [
        'a[href*="/event/"]',
        '[data-test*="event"] a',
        'a:has-text(" vs ")',
        'a:has-text(" v ")'
      ];
      
      for (const selector of altSelectors) {
        const altLinks = page.locator(selector);
        const altCount = await altLinks.count().catch(() => 0);
        console.log(`🔍 Selector "${selector}": ${altCount} links found`);
        if (altCount > 0) {
          const sampleTexts = await Promise.all(Array.from({length: Math.min(3, altCount)}, (_, i) => 
            altLinks.nth(i).innerText().catch(() => '')
          ));
          console.log(`🔍 Sample texts:`, sampleTexts);
        }
      }
    }

    if (total === 0) {
      console.log(`ℹ️ No cricket events found on ${tabName} tab`);
      return {pass: 0, fail: 0, results: []};
    }

    console.log(`📊 StarSports Cricket events found on ${tabName}: ${total}`);

    const indices = pickRandomIndices(total, remaining);
    console.log(`🎲 Sampling ${indices.length} of ${total} cricket events on ${tabName}: [${indices.join(', ')}]`);
    let pass = 0, fail = 0;
    const results: string[] = [];

    for (let t = 0; t < indices.length; t++) {
      const i = indices[t];
      const link = eventLinks.nth(i);
      const title = (await link.innerText().catch(() => `Event ${i + 1}`)).trim() || `Event ${i + 1}`;
      console.log(`\n🎯 Testing ${tabName} ${t + 1}/${indices.length}: ${title}`);

      // Click the event link
      await link.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);

      // Look for Live tracker and click it
      const liveTracker = page.getByRole('heading', { name: 'Live tracker' });
      const trackerVisible = await liveTracker.isVisible({ timeout: 3000 }).catch(() => false);
      if (trackerVisible) {
        console.log('🖱️ Clicking Live tracker...');
        await liveTracker.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(1000);
      }

      // Check for animation widget
      const detect = async () => {
        const widgetContainer = page.locator('#the-cricket-sport-widget');
        try { 
          await widgetContainer.scrollIntoViewIfNeeded(); 
          await widgetContainer.waitFor({ state: 'visible', timeout: 5000 });
          
          const iframe = widgetContainer.locator('iframe');
          await iframe.waitFor({ state: 'visible', timeout: 5000 });
          
          const start = Date.now();
          while (Date.now() - start < 8000) {
            const src = await iframe.getAttribute('src').catch(() => null);
            const visible = await iframe.isVisible().catch(() => false);
            if (src && src.includes('widgets.thesports01.com') && visible) return true;
            await page.waitForTimeout(400).catch(() => {});
          }
        } catch {}
        return false;
      };

      let hasAnim = false;
      try {
        hasAnim = await Promise.race([
          detect(),
          new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('EVENT_TIMEOUT')), 15000))
        ]) as boolean;
      } catch { hasAnim = false; }

      if (hasAnim) { 
        console.log(`✅ PASS: animation detected — ${title}`); 
        pass++; 
        results.push(`PASS: ${title}`);
      } else { 
        const eventUrl = page.url();
        const failLine = formatAnimationFailLine({
          site: 'StarSports',
          sport: 'Cricket',
          title,
          url: eventUrl,
          tab: tabName,
        });
        console.log(`❌ ${failLine}`);
        fail++; 
        results.push(failLine);
      }

      // Navigate back to cricket page
      await page.getByRole('link', { name: 'Cricket' }).click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(500);
    }

    console.log(`\n🧪 === CRICKET (${tabName}) RESULTS ===`);
    console.log(`📊 Total Cricket Events Tested: ${pass + fail}`);
    console.log(`✅ Events with Animations (PASS): ${pass}`);
    console.log(`❌ Events without Animations (FAIL): ${fail}`);
    console.log(`\n📋 === DETAILED RESULTS (${tabName}) ===`);
    results.forEach(r => console.log(r));

    return {pass, fail, results};
  };

  // Test Today tab first if available, then later tabs until sport-wide budget is met
  let eventsTestedSoFar = 0;
  let todayResults = {pass: 0, fail: 0, results: [] as string[]};
  if (todayVisible) {
    todayResults = await testTab('Today', eventsTestedSoFar);
    eventsTestedSoFar += todayResults.pass + todayResults.fail;
  }

  let tomorrowResults = {pass: 0, fail: 0, results: [] as string[]};
  if (tomorrowVisible && eventsTestedSoFar < ANIMATION_EVENTS_PER_SPORT) {
    tomorrowResults = await testTab('Tomorrow', eventsTestedSoFar);
    eventsTestedSoFar += tomorrowResults.pass + tomorrowResults.fail;
  }

  let anytimeResults = {pass: 0, fail: 0, results: [] as string[]};
  if (!todayVisible && !tomorrowVisible && eventsTestedSoFar < ANIMATION_EVENTS_PER_SPORT) {
    console.log('ℹ️ No Today or Tomorrow tabs available, testing Anytime tab...');
    anytimeResults = await testTab('Anytime', eventsTestedSoFar);
  }

  // Final summary
  const totalPass = todayResults.pass + tomorrowResults.pass + anytimeResults.pass;
  const totalFail = todayResults.fail + tomorrowResults.fail + anytimeResults.fail;
  const totalEvents = totalPass + totalFail;

  console.log('\n🏁 === FINAL CRICKET ANIMATION TEST RESULTS ===');
  console.log(`📊 Total Events Tested: ${totalEvents}`);
  console.log(`✅ Total Passed: ${totalPass}`);
  console.log(`❌ Total Failed: ${totalFail}`);
  if (totalEvents > 0) {
    console.log(`📈 Success Rate: ${Math.round((totalPass / totalEvents) * 100)}%`);
  }

  const allFailLines = [
    ...todayResults.results,
    ...tomorrowResults.results,
    ...anytimeResults.results,
  ].filter((r) => r.includes('| FAIL:') || r.startsWith('FAIL:'));
  appendAnimationEmailFailures('StarSports', allFailLines);

  expect(totalEvents, 'Should test at least one cricket event').toBeGreaterThan(0);
  expect(totalFail, missingAnimationsAssertMessage(allFailLines)).toBe(0);
});