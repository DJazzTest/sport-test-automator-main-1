import { test, expect, Page } from '@playwright/test';
import { appendBetwrightEmailFailures, betwrightAnimationFailLinesForEmail } from '../../Utils/betwrightEmailReport';
import { missingAnimationsAssertMessage } from '../../Utils/animationEmailReport';
import { isAccessBlockedPage, isBrowserStackRun } from '../../lib/browserstack-env';
import { ANIMATION_EVENTS_PER_SPORT, pickRandomIndices } from '../../lib/animation-sample';

test('Betwright Football Animation/tests/specs/betwright/Betwright.Football.Animation.spec.ts', async ({ page }) => {
  // Scope: events and animations only; betting odds are excluded from testing.
  test.setTimeout(35 * 60_000);

  const expectedSports = ['American Football', 'Baseball', 'Basketball', 'Boxing', 'Cricket', 'Football'];
  const expectedTabs = ['All', 'Today', 'Tomorrow', 'UK List'];
  const requiredTabs: Array<'Today' | 'Tomorrow'> = ['Today', 'Tomorrow'];

  const acceptPopups = async (p: Page) => {
    try { await p.getByRole('button', { name: /Allow all/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
    try { await p.locator('[data-test=\"landing-page\"] [data-test=\"close-icon\"] path').click({ timeout: 1500 }); } catch {}
    try {
      const uni = p.locator('[id^=\"uniccmp\"], div:has-text(\"Accept & Continue\")');
      if (await uni.isVisible({ timeout: 1000 }).catch(() => false)) {
        await p.getByRole('button', { name: /Accept/i }).click({ timeout: 1500 }).catch(() => {});
      }
    } catch {}
  };

  const clickTabIfVisible = async (name: string): Promise<boolean> => {
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
    const widgetContainer = page.locator('.animated_widget, #the-football-sport-widget, #the-cricket-sport-widget');
    try { await widgetContainer.scrollIntoViewIfNeeded(); } catch {}

    const widget = page.locator('.animated_widget iframe, #the-football-sport-widget iframe, #the-cricket-sport-widget iframe');
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

    const youtubeIframe = page.locator('iframe[src*=\"youtube.com/embed\"]');
    const hasYouTube = await youtubeIframe.isVisible({ timeout: 1000 }).catch(() => false);
    if (hasYouTube) {
      console.log(`📺 YouTube iframe detected: ${await youtubeIframe.getAttribute('src').catch(() => 'unknown')}`);
      return true;
    }

    return false;
  };

  const gotoFootballHome = async () => {
    let footballLink = page.getByRole('link', { name: /^Football$/i });
    let linkVisible = await footballLink.isVisible({ timeout: 2000 }).catch(() => false);
    if (!linkVisible) {
      footballLink = page.locator('a[href*=\"football\"]').first();
      linkVisible = await footballLink.isVisible({ timeout: 2000 }).catch(() => false);
    }
    if (!linkVisible) {
      footballLink = page.locator('a:has-text(\"Football\")').first();
      linkVisible = await footballLink.isVisible({ timeout: 2000 }).catch(() => false);
    }
    if (!linkVisible) {
      // Fallback: direct navigation keeps test progressing even if side nav collapses.
      await page.goto('https://www.betwright.com/sport/football', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1000);
      return;
    }
    await footballLink.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
  };

  /** Event links/rows only. We test events and animations only; odds are excluded via isFootballEventRow and by clicking event links. */
  const getEventList = () => {
    return page.locator('[data-test=\"participant\"]')
      .or(page.locator('a[href*=\"/event/\"]'))
      .or(page.locator('[class*=\"event\"] a[href*=\"/event/\"]'))
      .or(page.locator('[class*=\"match\"] a[href*=\"/event/\"]'))
      .or(page.locator('[class*=\"EventRow\"]'))
      .or(page.locator('a[href*=\"/football/\"]'))
      .or(page.locator('a[href*=\"/sport/football/\"]'));
  };

  /** Skip text that is betting odds or non-event UI. Test events and animations only, not odds. */
  const isLikelyOddsOrNonEvent = (text: string): boolean => {
    const t = text.trim();
    if (!t || t.length < 4) return true;
    if (/^\d+\/\d+(\s*\d+\/\d+)*$/.test(t)) return true; // fractional odds
    if (/^[\d\/\s\-]+$/.test(t)) return true; // numbers/slashes/dashes only
    if (/^\d+\.\d{2}$/.test(t) || /^\d+\.\d{2}\s+\d+\.\d{2}/.test(t)) return true; // decimal odds
    if (/^EVS$/i.test(t) || /^\d+\s*\/\s*\d+$/.test(t)) return true;
    if (/^(In Play|Today|Tomorrow|Weekend|Anytime|All|UK List)$/i.test(t)) return true;
    if (/^Today\s+\d{1,2}:\d{2}$/i.test(t)) return true;
    if (/^\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}:\d{2}$/i.test(t)) return true;
    if (t === '-' || /^(Odds|Price|Bet)$/i.test(t)) return true;
    return false;
  };

  /** Extract event title only (match name), stripping trailing odds and time/date. Events and animations only. */
  const eventTitleOnly = (rawRowText: string): string => {
    const t = rawRowText.trim();
    const vsIdx = t.search(/\s+vs\s+|\s+v\s+/i);
    if (vsIdx === -1) return t;
    const afterVs = t.slice(vsIdx);
    const oddsStart = afterVs.search(/\s+\d+\/\d+(?=\s|$)|\s+\d+\.\d{2}(?=\s|$)|\s+EVS\b|\s+Today\s+\d{1,2}:\d{2}|\s+\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}:\d{2}/i);
    if (oddsStart === -1) return t.replace(/\s+/g, ' ').trim();
    return t.slice(0, vsIdx + oddsStart).replace(/\s+/g, ' ').trim();
  };

  /** True if text looks like a football match (e.g. "Team A vs Team B"). Excludes odds-only rows. */
  const isFootballEventRow = (text: string): boolean => {
    const t = text.trim();
    if (isLikelyOddsOrNonEvent(t)) return false;
    return /\s+vs\s+|\s+v\s+/i.test(t);
  };

  const openEventAndCheckAnimation = async (eventTitle: string) => {
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(700);
    await acceptPopups(page);

    const liveTracker = page.getByRole('heading', { name: /Live tracker/i }).or(
      page.locator('h4:has-text(\"Live tracker\")')
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

  const testTabEvents = async (tabName: 'Today' | 'Tomorrow', remainingBudget: number) => {
    if (remainingBudget <= 0) {
      console.log(`ℹ️ Sport-wide budget of ${ANIMATION_EVENTS_PER_SPORT} events reached — skipping ${tabName} tab`);
      return { tested: 0, passed: 0, failed: 0, results: [] as string[] };
    }

    console.log(`\n📋 === TESTING ${tabName.toUpperCase()} FOOTBALL EVENTS ===`);

    // Ensure we're on Football home and select the tab.
    await gotoFootballHome();
    const tabClicked = await clickTabIfVisible(tabName);
    expect(tabClicked, `${tabName} tab should be selectable`).toBeTruthy();
    console.log(`✅ ${tabName} tab selected`);

    // Wait for tab content to load
    await page.waitForTimeout(2000);

    // More aggressive scrolling for Today tab (may have fewer events or lazy loading)
    const scrollIterations = tabName === 'Today' ? 10 : 5;
    for (let i = 0; i < scrollIterations; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    // Additional wait for Today tab content
    if (tabName === 'Today') {
      await page.waitForTimeout(2000);
      // Try scrolling again
      for (let i = 0; i < 5; i++) {
        await page.mouse.wheel(0, 600);
        await page.waitForTimeout(300);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);
    }

    const results: string[] = [];
    let tested = 0;
    let passed = 0;
    let failed = 0;

    let count = await getEventList().count().catch(() => 0);

    // If no events found, try alternative detection methods
    if (count === 0 && tabName === 'Today') {
      console.log(`⚠️ No events found with primary selectors, trying alternative methods...`);
      await page.waitForTimeout(2000);
      for (let i = 0; i < 8; i++) {
        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(300);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1000);
      count = await getEventList().count().catch(() => 0);
      if (count === 0) {
        await page.screenshot({ path: `betwright-football-${tabName.toLowerCase()}-debug.png` });
        console.log(`📸 Screenshot saved: betwright-football-${tabName.toLowerCase()}-debug.png`);
      }
    }

    if (count === 0) {
      console.log(`❌ No football events found on ${tabName} tab`);
      return { tested, passed, failed, results };
    }

    const seenEventTitles = new Set<string>();
    const candidateIndices: number[] = [];
    let list = getEventList();
    for (let i = 0; i < count; i++) {
      const row = list.nth(i);
      let rawText = `Football Event ${i + 1}`;
      try { rawText = ((await row.innerText()) || rawText).trim() || rawText; } catch {}
      if (!isFootballEventRow(rawText)) continue;
      const title = eventTitleOnly(rawText);
      const normalizedTitle = title.replace(/\s+/g, ' ').trim();
      if (seenEventTitles.has(normalizedTitle)) continue;
      seenEventTitles.add(normalizedTitle);
      candidateIndices.push(i);
    }

    if (candidateIndices.length === 0) {
      console.log(`❌ No football events found on ${tabName} tab`);
      return { tested, passed, failed, results };
    }

    const indices = pickRandomIndices(candidateIndices.length, remainingBudget);
    console.log(`🎲 Sampling ${indices.length} of ${candidateIndices.length} football events on ${tabName}: [${indices.map(j => candidateIndices[j]).join(', ')}]`);

    for (let t = 0; t < indices.length; t++) {
      const i = candidateIndices[indices[t]];
      list = getEventList();
      count = await list.count().catch(() => 0);
      if (i >= count) break;

      const row = list.nth(i);
      let rawText = `Football Event ${i + 1}`;
      try { rawText = ((await row.innerText()) || rawText).trim() || rawText; } catch {}

      if (!isFootballEventRow(rawText)) continue;
      const title = eventTitleOnly(rawText);

      console.log(`\n🎯 ${tabName} ${t + 1}/${indices.length} (event only, no odds): ${title}`);

      await row.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(250);

      let clicked = false;
      const eventLink = row.locator('a[href*=\"/event/\"]').first();
      if (await eventLink.count().catch(() => 0) > 0 && await eventLink.isVisible({ timeout: 1000 }).catch(() => false)) {
        try {
          await eventLink.click({ timeout: 5000 });
          clicked = true;
        } catch {}
      }
      if (!clicked) {
        try {
          await row.click({ timeout: 5000 });
          clicked = true;
        } catch {
          const link = row.locator('a').first();
          if (await link.count().catch(() => 0) > 0) {
            await link.click({ timeout: 5000 }).catch(() => {});
            clicked = true;
          }
        }
      }

      if (!clicked) {
        console.log(`⚠️ SKIP: could not click — ${title}`);
        results.push(`SKIP: ${title} (could not click)`);
        continue;
      }

      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(800);

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
          results.push(`FAIL: ${title} | URL: ${page.url()}`);
        }
      }

      await gotoFootballHome();
      await clickTabIfVisible(tabName);
      await page.waitForTimeout(500);
    }

    console.log(`\n🧪 === FOOTBALL (${tabName}) RESULTS ===`);
    console.log(`📊 Total Football Events Tested: ${tested}`);
    console.log(`✅ Events with Animations (PASS): ${passed}`);
    console.log(`❌ Events without Animations (FAIL): ${failed}`);
    console.log(`📋 === DETAILED RESULTS (${tabName}) ===`);
    results.forEach(r => console.log(r));

    return { tested, passed, failed, results };
  };

  console.log('🚀 Starting BetWright Football Navigation & Animation Scenario...');

  // Given I navigate to homepage
  await page.goto('https://www.betwright.com/');
  if (await isAccessBlockedPage(page)) {
    test.skip(
      true,
      isBrowserStackRun()
        ? 'BetWright blocks BrowserStack IPs (Cloudflare) — cannot run animation checks remotely'
        : 'BetWright access blocked'
    );
  }
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
    'nav a, [class*=\"nav\"] a, [class*=\"menu\"] a, [class*=\"sidebar\"] a, [data-test*=\"nav\"] a',
    links => links
      .map(a => a.textContent?.trim() || '')
      .filter(Boolean)
  );
  expectedSports.forEach(sport => {
    const present = navTexts.some(txt => txt.toLowerCase() === sport.toLowerCase());
    expect(present, `${sport} should be listed in left navigation`).toBeTruthy();
  });
  console.log('✅ All expected sports present in left navigation');

  // Click Football from left nav
  console.log('📌 Navigating to Football from left navigation...');
  await gotoFootballHome();
  expect(page.url()).toContain('football');
  console.log('✅ Reached Football home page');

  // Verify Events header options
  console.log('📌 Verifying Football Events header tabs...');
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

  // Try to prioritise example event once (Today): Brighton and Hove Albion vs Bournemouth
  console.log('\\n📌 Looking for example event on Today tab (Brighton and Hove Albion vs Bournemouth)...');
  await gotoFootballHome();
  const todayClicked = await clickTabIfVisible('Today');
  if (todayClicked) {
    const list = getEventList();
    const count = await list.count().catch(() => 0);
    let foundIndex = -1;
    for (let i = 0; i < count; i++) {
      const text = (await list.nth(i).innerText().catch(() => '')).toLowerCase();
      if (text.includes('brighton') && text.includes('bournemouth')) {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex >= 0) {
      console.log('✅ Found example event "Brighton and Hove Albion vs Bournemouth" on Today tab');
      const row = list.nth(foundIndex);
      await row.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await row.click({ timeout: 5000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(800);
      if (/event/.test(page.url())) {
        await openEventAndCheckAnimation('Brighton and Hove Albion vs Bournemouth');
      } else {
        console.log('⚠️ Example event did not navigate to an event page');
      }
      // Go back to Football home for the main loops.
      await gotoFootballHome();
    } else {
      console.log('ℹ️ Example event not found on Today tab; continuing with full tab scans');
    }
  } else {
    console.log('ℹ️ Today tab not available when searching for example event');
  }

  // Full tab coverage: up to 2 random events across Today then Tomorrow
  let eventsTestedSoFar = 0;
  const todayResults = await testTabEvents('Today', ANIMATION_EVENTS_PER_SPORT - eventsTestedSoFar);
  eventsTestedSoFar += todayResults.tested;
  const tomorrowResults = await testTabEvents('Tomorrow', ANIMATION_EVENTS_PER_SPORT - eventsTestedSoFar);

  console.log(`\\n🏁 === FINAL FOOTBALL TEST SUMMARY ===`);
  console.log(`\\n📅 TODAY TAB:`);
  console.log(`   Total Events Tested: ${todayResults.tested}`);
  console.log(`   ✅ PASS: ${todayResults.passed}`);
  console.log(`   ❌ FAIL: ${todayResults.failed}`);
  console.log(`\\n📅 TOMORROW TAB:`);
  console.log(`   Total Events Tested: ${tomorrowResults.tested}`);
  console.log(`   ✅ PASS: ${tomorrowResults.passed}`);
  console.log(`   ❌ FAIL: ${tomorrowResults.failed}`);
  console.log(`\\n📊 OVERALL:`);
  const totalTested = todayResults.tested + tomorrowResults.tested;
  const totalPassed = todayResults.passed + tomorrowResults.passed;
  const totalFailed = todayResults.failed + tomorrowResults.failed;
  console.log(`   Total Events Tested: ${totalTested}`);
  console.log(`   Total PASS: ${totalPassed}`);
  console.log(`   Total FAIL: ${totalFailed}`);

  const animationFailLines = totalFailed > 0
    ? betwrightAnimationFailLinesForEmail('Football', todayResults, tomorrowResults)
    : [];
  appendBetwrightEmailFailures(animationFailLines);

  expect(totalTested, 'Should test at least one football event across Today+Tomorrow').toBeGreaterThan(0);
  expect(totalFailed, missingAnimationsAssertMessage(animationFailLines)).toBe(0);
});

