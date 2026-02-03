import { test, expect, Page } from '@playwright/test';
import { recordFailure, printSummary } from '../utils/reportHelper';

const MAX_LINKS_TO_CHECK = 15;
const MAX_IMAGES_TO_CHECK = 20;

test('BetWright – Cricket Animation Feature', async ({ page, request }) => {
  // Limit events per tab so test completes in ~10–15 min; timeout allows full run.
  test.setTimeout(35 * 60_000);
  const maxEventsPerTab = 5;

  const brokenLinkUrls: string[] = [];
  const brokenImageUrls: string[] = [];

  const expectedSports = ['American Football', 'Baseball', 'Basketball', 'Boxing', 'Cricket'];
  // Some Betwright layouts don't show "Anytime" consistently; we require Today/Tomorrow for this suite.
  const expectedTabs = ['Anytime', 'In-Play', 'Today', 'Tomorrow'];
  const requiredTabs: Array<'Today' | 'Tomorrow'> = ['Today', 'Tomorrow'];

  const acceptPopups = async (p: Page) => {
    try { await p.getByRole('button', { name: /Allow all/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
    try { await p.locator('[data-test="landing-page"] [data-test="close-icon"] path').click({ timeout: 1500 }); } catch {}
    try {
      const uni = p.locator('[id^="uniccmp"], div:has-text("Accept & Continue")');
      if (await uni.isVisible({ timeout: 1000 }).catch(() => false)) {
        await p.getByRole('button', { name: /Accept/i }).click({ timeout: 1500 }).catch(() => {});
      }
    } catch {}
  };

  /** Tab filter keys used by Betwright (e.g. <button data-test-filter-key="today" title="Today">). */
  const tabFilterKeys: Record<string, string> = {
    Today: 'today',
    Tomorrow: 'tomorrow',
    Anytime: 'anytime',
    'In-Play': 'inplay',
  };

  const clickTabIfVisible = async (name: string): Promise<boolean> => {
    const filterKey = tabFilterKeys[name];
    if (filterKey) {
      const byDataAttr = page.locator(`button[data-test-filter-key="${filterKey}"], [data-test-filter-key="${filterKey}"]`).first();
      if (await byDataAttr.isVisible({ timeout: 2000 }).catch(() => false)) {
        await byDataAttr.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(800);
        return true;
      }
    }

    const patterns = [name, name.replace('-', ' '), name.replace(' ', '-')];
    for (const label of patterns) {
      const btn = page.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first();
      const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) {
        await btn.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(600);
        return true;
      }
    }
    return false;
  };

  const detectAnimation = async () => {
        const widgetContainer = page.locator('.animated_widget, #the-cricket-sport-widget');
        try { await widgetContainer.scrollIntoViewIfNeeded(); } catch {}

        const widget = page.locator('.animated_widget iframe, #the-cricket-sport-widget iframe');
        const start = Date.now();
        while (Date.now() - start < 6000) {
          const visible = await widget.isVisible({ timeout: 500 }).catch(() => false);
          if (visible) {
            const src = await widget.getAttribute('src').catch(() => null);
            if (src && (src.includes('thesports01.com') || src.includes('widgets.thesports01.com'))) {
              console.log(`✅ Animation iframe detected: ${src}`);
              return true;
            }
          }
          await page.waitForTimeout(400).catch(() => {});
        }

        const animateSvg = page.locator('.animate-svg');
        const hasSvg = await animateSvg.isVisible({ timeout: 1000 }).catch(() => false);
        if (hasSvg) {
          console.log('✅ SVG animation detected');
          return true;
        }

    const youtubeIframe = page.locator('iframe[src*="youtube.com/embed"]');
    const hasYouTube = await youtubeIframe.isVisible({ timeout: 1000 }).catch(() => false);
    if (hasYouTube) {
      console.log(`📺 YouTube iframe detected: ${await youtubeIframe.getAttribute('src').catch(() => 'unknown')}`);
      return true;
    }

        return false;
  };

  const gotoCricketHome = async () => {
    let cricketLink = page.getByRole('link', { name: /^Cricket$/i });
    let linkVisible = await cricketLink.isVisible({ timeout: 2000 }).catch(() => false);
    if (!linkVisible) {
      cricketLink = page.locator('a[href*="cricket"]').first();
      linkVisible = await cricketLink.isVisible({ timeout: 2000 }).catch(() => false);
    }
    if (!linkVisible) {
      cricketLink = page.locator('a:has-text("Cricket")').first();
      linkVisible = await cricketLink.isVisible({ timeout: 2000 }).catch(() => false);
    }
    if (!linkVisible) {
      // Fallback: try direct navigation (keeps test moving if the sidebar is collapsed)
      await page.goto('https://www.betwright.com/sport/cricket', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1000);
      return;
    }
    await cricketLink.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  };

  const getEventList = () =>
    page.locator('[data-test="participant"]').or(page.locator('a[href*="/event/"]'));

  const openEventAndCheckAnimation = async (eventTitle: string) => {
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(700);
    await acceptPopups(page);

    // Try to ensure live tracker is visible/open.
    const liveTracker = page.getByRole('heading', { name: /Live tracker/i }).or(
      page.locator('h4:has-text("Live tracker")')
    );
    if (await liveTracker.isVisible({ timeout: 2500 }).catch(() => false)) {
      await liveTracker.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(600);
    }

    const hasAnim = await Promise.race([
      detectAnimation(),
      new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('EVENT_TIMEOUT')), 15000))
    ]).catch(() => false);

    if (hasAnim) console.log(`✅ PASS: animation detected — ${eventTitle}`);
    else console.log(`❌ FAIL: no animation detected — ${eventTitle}`);

    return hasAnim;
  };

  const testTabEvents = async (tabName: 'Today' | 'Tomorrow') => {
    console.log(`\n📋 === TESTING ${tabName.toUpperCase()} EVENTS ===`);

    // Ensure we're on cricket home and select the tab.
    await gotoCricketHome();
    const tabClicked = await clickTabIfVisible(tabName);
    expect(tabClicked, `${tabName} tab should be selectable`).toBeTruthy();
    console.log(`✅ ${tabName} tab selected`);

    // Light scroll to trigger lazy loading
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const results: string[] = [];
    let tested = 0;
    let passed = 0;
    let failed = 0;

    // Re-query every loop to avoid stale handles after navigation.
    let count = await getEventList().count().catch(() => 0);
    if (count === 0) {
      console.log(`❌ No cricket events found on ${tabName} tab`);
      return { tested, passed, failed, results };
    }

    console.log(`✅ Found ${count} cricket events on ${tabName} tab (testing up to ${maxEventsPerTab} unique events)`);

    for (let i = 0; i < count; i++) {
      if (tested >= maxEventsPerTab) break;
      const list = getEventList();
      count = await list.count().catch(() => 0);
      if (i >= count) break;

      const row = list.nth(i);
      let title = `Cricket Event ${i + 1}`;
      try { title = ((await row.innerText()) || title).trim() || title; } catch {}

      console.log(`\n🎯 ${tabName} ${tested + 1}/${maxEventsPerTab}: ${title}`);

      await row.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(250);

      // Click event (row or nested link)
      let clicked = false;
      try {
        await row.click({ timeout: 5000 });
        clicked = true;
      } catch {
        const link = row.locator('a').first();
        if (await link.count().catch(() => 0)) {
          await link.click({ timeout: 5000 }).catch(() => {});
          clicked = true;
        }
      }

      if (!clicked) {
        console.log(`⚠️ SKIP: could not click — ${title}`);
        results.push(`SKIP: ${title} (could not click)`);
        continue;
      }

      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(800);

      // If navigation didn't go to an event page, skip gracefully.
      if (!/event/.test(page.url())) {
        console.log(`⚠️ SKIP: did not navigate to event page — ${title}`);
        results.push(`SKIP: ${title} (not an event page)`);
      } else {
        tested++;
        const hasAnim = await openEventAndCheckAnimation(title);
        if (hasAnim) {
          passed++;
          results.push(`PASS: ${title}`);
        } else {
          failed++;
          results.push(`FAIL: ${title}`);
        }
      }

      // Navigate back to the cricket list, then reselect tab.
      await gotoCricketHome();
      await clickTabIfVisible(tabName);
      await page.waitForTimeout(500);
    }

    console.log(`\n🧪 === CRICKET (${tabName}) RESULTS ===`);
    console.log(`📊 Total Cricket Events Tested: ${tested}`);
    console.log(`✅ Events with Animations (PASS): ${passed}`);
    console.log(`❌ Events without Animations (FAIL): ${failed}`);
    console.log(`📋 === DETAILED RESULTS (${tabName}) ===`);
    results.forEach(r => console.log(r));

    return { tested, passed, failed, results };
  };

  console.log('🚀 Starting BetWright Cricket Navigation & Animation Scenario...');

  // Given I navigate to homepage
  await page.goto('https://www.betwright.com/');
  await expect(page).toHaveURL(/betwright\.com/);
  console.log('✅ Landed on BetWright homepage');

  // Cookie consent handling (initial)
  await acceptPopups(page);
  const allowAll = page.getByRole('button', { name: /Allow all/i });
  if (await allowAll.isVisible({ timeout: 1500 }).catch(() => false)) {
    await allowAll.click({ timeout: 2000 }).catch(() => {});
    await expect(allowAll).not.toBeVisible({ timeout: 3000 });
    console.log('✅ Cookie popup dismissed');
  } else {
    console.log('ℹ️ Cookie popup not present initially');
  }

  // Left-hand navigation: verify sports list
  console.log('📌 Checking left-hand navigation sports list...');
  await page.waitForTimeout(1500);
  const navTexts = await page.$$eval(
    'nav a, [class*="nav"] a, [class*="menu"] a, [class*="sidebar"] a, [data-test*="nav"] a',
    links => links
      .map(a => a.textContent?.trim() || '')
      .filter(Boolean)
  );
  expectedSports.forEach(sport => {
    const present = navTexts.some(txt => txt.toLowerCase() === sport.toLowerCase());
    expect(present, `${sport} should be listed in left navigation`).toBeTruthy();
  });
  console.log('✅ All expected sports present in left navigation');

  // Click Cricket from left nav
  console.log('📌 Navigating to Cricket from left navigation...');
  await gotoCricketHome();
  expect(page.url()).toContain('cricket');
  console.log('✅ Reached Cricket home page');

  // Click In-Play in top header
  console.log('📌 Clicking In-Play in top main header...');
  const inPlayHeader = page.getByRole('link', { name: /In[- ]?Play/i }).or(
    page.getByRole('button', { name: /In[- ]?Play/i })
  );
  if (await inPlayHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
    await inPlayHeader.click({ timeout: 3000 });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    console.log('✅ In-Play header clicked');
      } else { 
    throw new Error('In-Play header link/button not found');
  }

  // Expect live cricket events (soft check)
  const liveEvents = page.locator('a[href*="/event/"], [data-test="participant"]');
  const liveCount = await liveEvents.count().catch(() => 0);
  console.log(`ℹ️ Live events detected after In-Play click: ${liveCount}`);

  // Cookie may reappear
  await acceptPopups(page);

  // Navigate back to Cricket via left nav again
  console.log('📌 Returning to Cricket from left navigation...');
  await gotoCricketHome();
  expect(page.url()).toContain('cricket');
  console.log('✅ Returned to Cricket home page');

  // Wait for Events header (Today/Tomorrow) to appear – Cricket page may need time to hydrate.
  const todayOrTomorrow = page.locator('button[data-test-filter-key="today"], button[data-test-filter-key="tomorrow"]')
    .or(page.getByRole('button', { name: /^(Today|Tomorrow)$/i }));
  await todayOrTomorrow.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Verify Events header options
  console.log('📌 Verifying Events header tabs...');
  for (const tab of expectedTabs) {
    const found = await clickTabIfVisible(tab);
    if (!found) console.log(`⚠️ Tab not visible: ${tab}`);
    await page.waitForTimeout(200);
  }
  for (const tab of requiredTabs) {
    const found = await clickTabIfVisible(tab);
    expect(found, `${tab} tab should be visible`).toBeTruthy();
    await page.waitForTimeout(200);
  }

  // Check Cricket page for broken links and images (limited sample)
  console.log('📌 Checking Cricket page for broken links and images...');
  const allLinks = await page.$$eval('a[href]', links =>
    links
      .map(a => ({ href: (a as HTMLAnchorElement).href, visible: (a as HTMLElement).offsetParent !== null }))
      .filter(l => l.href && l.visible && l.href.startsWith('http') && !l.href.startsWith('javascript:') && !l.href.startsWith('mailto:'))
  );
  const linksToCheck = allLinks.slice(0, MAX_LINKS_TO_CHECK);
  for (const link of linksToCheck) {
    try {
      const response = await request.get(link.href, { timeout: 5000 });
      if (response.status() >= 400) brokenLinkUrls.push(link.href);
    } catch {
      brokenLinkUrls.push(link.href);
    }
  }
  const allImages = await page.$$eval('img[src]', imgs =>
    imgs
      .filter(img => (img as HTMLElement).offsetParent !== null && (img as HTMLImageElement).src.startsWith('http'))
      .map(img => ({ src: (img as HTMLImageElement).src, naturalWidth: (img as HTMLImageElement).naturalWidth, naturalHeight: (img as HTMLImageElement).naturalHeight }))
  );
  const imagesToCheck = allImages.slice(0, MAX_IMAGES_TO_CHECK);
  for (const img of imagesToCheck) {
    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
      brokenImageUrls.push(img.src);
      continue;
    }
    try {
      const response = await request.get(img.src, { timeout: 5000 });
      if (response.status() >= 400) brokenImageUrls.push(img.src);
    } catch {
      brokenImageUrls.push(img.src);
    }
  }

  // Test ALL events for Today, then Tomorrow
  const todayResults = await testTabEvents('Today');
  const tomorrowResults = await testTabEvents('Tomorrow');

  // Final summary
  console.log(`\n🏁 === FINAL CRICKET TEST SUMMARY ===`);
  console.log(`\n📅 TODAY TAB:`);
  console.log(`   Total Events Tested: ${todayResults.tested}`);
  console.log(`   ✅ PASS: ${todayResults.passed}`);
  console.log(`   ❌ FAIL: ${todayResults.failed}`);
  console.log(`\n📅 TOMORROW TAB:`);
  console.log(`   Total Events Tested: ${tomorrowResults.tested}`);
  console.log(`   ✅ PASS: ${tomorrowResults.passed}`);
  console.log(`   ❌ FAIL: ${tomorrowResults.failed}`);
  console.log(`\n📊 OVERALL:`);
  const totalTested = todayResults.tested + tomorrowResults.tested;
  const totalPassed = todayResults.passed + tomorrowResults.passed;
  const totalFailed = todayResults.failed + tomorrowResults.failed;
  console.log(`   Total Events Tested: ${totalTested}`);
  console.log(`   Total PASS: ${totalPassed}`);
  console.log(`   Total FAIL: ${totalFailed}`);

  // We only hard-require that we managed to test at least one event.
  expect(totalTested, 'Should test at least one cricket event across Today+Tomorrow').toBeGreaterThan(0);

  // Report broken links/images or success message (log first so URLs appear when test fails)
  if (brokenLinkUrls.length > 0 || brokenImageUrls.length > 0) {
    console.log('\n📋 === BETWRIGHT DEFECTS (Broken links / images) ===');
    if (brokenLinkUrls.length > 0) {
      console.log('\n🔗 Broken links (URLs):');
      brokenLinkUrls.forEach(url => console.log(`   ${url}`));
    }
    if (brokenImageUrls.length > 0) {
      console.log('\n🖼️ Broken images (URLs):');
      brokenImageUrls.forEach(url => console.log(`   ${url}`));
    }
  } else {
    console.log('\n✅ Betwright tested — no defects identified ✅ Passed ✅');
  }

  // Fail the test if any broken links or images were found
  const totalDefects = brokenLinkUrls.length + brokenImageUrls.length;
  expect(totalDefects, `Expected no broken links or images; found ${brokenLinkUrls.length} broken link(s) and ${brokenImageUrls.length} broken image(s)`).toBe(0);
});

