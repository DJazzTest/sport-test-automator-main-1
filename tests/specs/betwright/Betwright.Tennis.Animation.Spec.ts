import { writeFile } from 'node:fs/promises';
import { test, expect, Page } from '@playwright/test';
import { appendBetwrightEmailFailures, betwrightAnimationFailLinesForEmail } from '../../Utils/betwrightEmailReport';
import { missingAnimationsAssertMessage } from '../../Utils/animationEmailReport';
import { isAccessBlockedPage, isBrowserStackRun } from '../../lib/browserstack-env';
import { ANIMATION_EVENTS_PER_SPORT, pickRandomIndices } from '../../lib/animation-sample';

/**
 * To avoid npm "Unknown env config devdir" and Node "NO_COLOR is ignored" warnings when running
 * from the terminal, use: npm run test:betwright:tennis
 * Or: npm_config_devdir= NO_COLOR= npx playwright test tests/specs/betwright/Betwright.Tennis.Animation.Spec.ts
 */
test('Betwright Tennis Animation/tests/specs/betwright/Betwright.Tennis.Animation.Spec.ts', async ({ page }) => {
  // Scope: events and animations only; betting odds are excluded from testing.
  // Timeout set to 35 min so full run (Today + Tomorrow events) can complete; max events per tab limited to avoid hitting it.
  test.setTimeout(35 * 60_000);

  /**
   * BDD: tests/gherkin/betwright-tennis-animation.feature
   *
   * Given I navigate to "https://www.betwright.com"
   * Then I should land on the Betwright home page
   * And a cookie consent popup should be displayed
   * When I click the "Allow all" button
   * Then the cookie consent popup should be dismissed
   *
   * When I view the left-hand navigation panel
   * Then I should see the following sports listed: American Football, Baseball, Basketball, Boxing, Cricket, Football, Tennis
   * When I click on "Tennis"
   * Then I should be redirected to the Tennis home page
   *
   * When I navigate to the "In-Play" section from the site header
   * And I return to the left-hand navigation panel
   * And I click on "Tennis" again
   * Then I should return to the Tennis home page successfully
   *
   * And I should see the Events header with the following options: Anytime, In-Play, Today, Tomorrow, Weekend
   * When I navigate to the "Today" tab (button: data-test-filter-key="today")
   * When I select the "Today" tab
   * And I scroll through the list of available Tennis events
   * And then test for animation
   *
   * If no Tennis events are available under the "Today" tab
   * Then I should automatically move to the "Tomorrow" tab (button: data-test-filter-key="tomorrow")
   * And I scroll through the list of available Tennis events
   *
   * When I open a Tennis event
   * Then the event page should load successfully
   * And a live animation should be displayed if available
   * And I should be able to validate Tennis live animations for events under both "Today" and "Tomorrow" tabs
   * And I should confirm that the animation behavior matches
   */

  const expectedSports = ['American Football', 'Baseball', 'Basketball', 'Boxing', 'Cricket', 'Football', 'Tennis'];
  /** Alternative labels the site may use (e.g. "NFL" for "American Football"). */
  const sportAlternatives: Record<string, string[]> = {
    'American Football': ['American Football', 'NFL', 'American football'],
  };
  // Tennis page sometimes uses "In Play" (space) rather than "In-Play" (hyphen).
  const expectedTabs = ['Anytime', 'In-Play', 'Today', 'Tomorrow', 'Weekend'];
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
    Weekend: 'weekend',
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
      const re = new RegExp(`^${label}$`, 'i');

      const candidates = [
        page.getByRole('button', { name: re }).first(),
        page.getByRole('tab', { name: re }).first(),
        page.getByRole('link', { name: re }).first(),
        page.locator('button:has-text("' + label.replace(/"/g, '\\"') + '")').first(),
        page.locator('[role="tab"]:has-text("' + label + '")').first(),
        page.getByText(re).first(),
      ];

      for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
        const el = candidates[cIdx];
        const visible = await el.isVisible({ timeout: 2000 }).catch(() => false);
        if (!visible) continue;
        await el.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(800);
        return true;
      }
    }
    return false;
  };

  const debugTennisPage = async (label: string) => {
    try {
      await page.screenshot({ path: `betwright-tennis-${label}.png`, fullPage: true });
      const html = await page.content().catch(() => '');
      // Keep the dump small-ish.
      await writeFile(`betwright-tennis-${label}.html`, html.slice(0, 2_000_000));
      console.log(`📸 Debug saved: betwright-tennis-${label}.png and betwright-tennis-${label}.html`);
    } catch {}
  };

  const detectAnimation = async () => {
    const widgetContainer = page.locator('.animated_widget, #the-tennis-sport-widget, #the-cricket-sport-widget');
    try { await widgetContainer.scrollIntoViewIfNeeded(); } catch {}

    const widget = page.locator('.animated_widget iframe, #the-tennis-sport-widget iframe, #the-cricket-sport-widget iframe');
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

  const TENNIS_URL = 'https://www.betwright.com/sport/tennis';

  const gotoTennisHome = async () => {
    let tennisLink = page.getByRole('link', { name: /^Tennis$/i });
    let linkVisible = await tennisLink.isVisible({ timeout: 2000 }).catch(() => false);
    if (!linkVisible) {
      tennisLink = page.locator('a[href*="tennis"]').first();
      linkVisible = await tennisLink.isVisible({ timeout: 2000 }).catch(() => false);
    }
    if (!linkVisible) {
      tennisLink = page.locator('a:has-text("Tennis")').first();
      linkVisible = await tennisLink.isVisible({ timeout: 2000 }).catch(() => false);
    }
    if (!linkVisible) {
      await page.goto(TENNIS_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(1500);
      return;
    }
    try { await tennisLink.scrollIntoViewIfNeeded({ timeout: 2000 }); } catch {}
    await tennisLink.click();
    // Wait for navigation to Tennis page (SPA); avoid networkidle which can hang on busy pages.
    await page.waitForURL(/\/tennis|betwright\.com\/sport\/tennis/, { timeout: 15000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');
    try { await page.waitForTimeout(2000); } catch { /* page may be closed (e.g. test timeout) */ }
  };

  /** Navigate directly to Tennis events page and wait for Today/Tomorrow tabs. Use when link click does not show events. */
  const gotoTennisEventsPage = async () => {
    await page.goto(TENNIS_URL, { waitUntil: 'load', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2000);
    await acceptPopups(page);
    // Wait for Events header (Today/Tomorrow) to be visible – SPAs often need extra time on Chrome/Firefox.
    const todayOrTomorrow = page.getByRole('button', { name: /^(Today|Tomorrow)$/i })
      .or(page.getByRole('tab', { name: /^(Today|Tomorrow)$/i }))
      .or(page.getByText(/^(Today|Tomorrow)$/i));
    await todayOrTomorrow.first().waitFor({ state: 'visible', timeout: 25000 });
    await page.waitForTimeout(1000);
  };

  const waitForTennisTabsOrEvents = async () => {
    const tabText = page.locator('text=Today, text=Tomorrow, text=Weekend, text=Anytime, text=In Play');
    const tabButtons = page.getByRole('button', { name: /^(Today|Tomorrow|Anytime|In-?Play|Weekend)$/i });
    const events = getEventList();
    const start = Date.now();
    while (Date.now() - start < 15_000) {
      const tabsVisible = await tabText.first().isVisible({ timeout: 500 }).catch(() => false)
        || await tabButtons.first().isVisible({ timeout: 500 }).catch(() => false);
      const eventsCount = await events.count().catch(() => 0);
      if (tabsVisible) return true;
      if (eventsCount > 0) return true;
      await page.waitForTimeout(500);
    }
    return false;
  };

  /** Event links/rows only. We test events and animations only; odds are excluded via isTennisEventRow and by clicking event links. */
  const getEventList = () => {
    return page.locator('[data-test="participant"]')
      .or(page.locator('a[href*="/event/"]'))
      .or(page.locator('[class*="event"] a[href*="/event/"]'))
      .or(page.locator('[class*="match"] a[href*="/event/"]'))
      .or(page.locator('[class*="EventRow"]'))
      .or(page.locator('a[href*="/tennis/"]'))
      .or(page.locator('a[href*="/sport/tennis/"]'));
  };

  /** Skip text that is betting odds or non-event UI. Test events and animations only, not odds. */
  const isLikelyOddsOrNonEvent = (text: string): boolean => {
    const t = text.trim();
    if (!t || t.length < 4) return true;
    if (/^\d+\/\d+(\s*\d+\/\d+)*$/.test(t)) return true; // fractional odds
    if (/^[\d\/\s\-]+$/.test(t)) return true; // numbers/slashes/dashes only
    if (/^\d+\.\d{2}$/.test(t) || /^\d+\.\d{2}\s+\d+\.\d{2}/.test(t)) return true; // decimal odds
    if (/^EVS$/i.test(t) || /^\d+\s*\/\s*\d+$/.test(t)) return true;
    if (/^(In Play|Today|Tomorrow|Weekend|Anytime)$/i.test(t)) return true;
    if (/^Today\s+\d{1,2}:\d{2}$/i.test(t)) return true;
    if (t === '-' || /^(Odds|Price|Bet)$/i.test(t)) return true;
    return false;
  };

  /** Extract event title only (match name), stripping trailing odds. Events and animations only. */
  const eventTitleOnly = (rawRowText: string): string => {
    const t = rawRowText.trim();
    const vsIdx = t.search(/\s+vs\s+/i);
    if (vsIdx === -1) return t;
    const afterVs = t.slice(vsIdx);
    const oddsStart = afterVs.search(/\s+\d+\/\d+(?=\s|$)|\s+\d+\.\d{2}(?=\s|$)|\s+EVS\b/i);
    if (oddsStart === -1) return t.replace(/\s+/g, ' ').trim();
    return t.slice(0, vsIdx + oddsStart).replace(/\s+/g, ' ').trim();
  };

  /** True if text looks like a tennis match (e.g. "Player A vs Player B"). Excludes odds-only rows. */
  const isTennisEventRow = (text: string): boolean => {
    const t = text.trim();
    if (isLikelyOddsOrNonEvent(t)) return false;
    return /\s+vs\s+/i.test(t);
  };

  const openEventAndCheckAnimation = async (eventTitle: string) => {
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(700);
    await acceptPopups(page);

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

  const testTabEvents = async (tabName: 'Today' | 'Tomorrow', remainingBudget: number) => {
    if (remainingBudget <= 0) {
      console.log(`ℹ️ Sport-wide budget of ${ANIMATION_EVENTS_PER_SPORT} events reached — skipping ${tabName} tab`);
      return { tested: 0, passed: 0, failed: 0, results: [] as string[] };
    }

    console.log(`\n📋 === TESTING ${tabName.toUpperCase()} TENNIS EVENTS ===`);
    console.log(`When I select the "${tabName}" tab`);
    console.log('And I scroll through the list of available tennis events');

    await gotoTennisHome();
    const tabClicked = await clickTabIfVisible(tabName);
    if (!tabClicked && tabName === 'Today') {
      // If Today tab not available, don't fail - just return empty results
      console.log(`⚠️ ${tabName} tab not available`);
      return { tested: 0, passed: 0, failed: 0, results: [] };
    }
    expect(tabClicked, `${tabName} tab should be selectable`).toBeTruthy();
    console.log(`✅ ${tabName} tab selected`);

    await page.waitForTimeout(2000);

    const scrollIterations = tabName === 'Today' ? 10 : 5;
    for (let i = 0; i < scrollIterations; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    if (tabName === 'Today') {
      await page.waitForTimeout(2000);
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
        await page.screenshot({ path: `betwright-tennis-${tabName.toLowerCase()}-debug.png` });
        console.log(`📸 Screenshot saved: betwright-tennis-${tabName.toLowerCase()}-debug.png`);
      }
    }

    if (count === 0) {
      console.log(`❌ No tennis events found on ${tabName} tab`);
      return { tested, passed, failed, results };
    }

    const seenEventTitles = new Set<string>();
    const candidateIndices: number[] = [];
    let list = getEventList();
    for (let i = 0; i < count; i++) {
      const row = list.nth(i);
      let rawText = `Tennis Event ${i + 1}`;
      try { rawText = ((await row.innerText()) || rawText).trim() || rawText; } catch {}
      if (!isTennisEventRow(rawText)) continue;
      const title = eventTitleOnly(rawText);
      const normalizedTitle = title.replace(/\s+/g, ' ').trim();
      if (seenEventTitles.has(normalizedTitle)) continue;
      seenEventTitles.add(normalizedTitle);
      candidateIndices.push(i);
    }

    if (candidateIndices.length === 0) {
      console.log(`❌ No tennis events found on ${tabName} tab`);
      return { tested, passed, failed, results };
    }

    const indices = pickRandomIndices(candidateIndices.length, remainingBudget);
    console.log(`🎲 Sampling ${indices.length} of ${candidateIndices.length} tennis events on ${tabName}: [${indices.map(j => candidateIndices[j]).join(', ')}]`);

    for (let t = 0; t < indices.length; t++) {
      const i = candidateIndices[indices[t]];
      list = getEventList();
      count = await list.count().catch(() => 0);
      if (i >= count) break;

      const row = list.nth(i);
      let rawText = `Tennis Event ${i + 1}`;
      try { rawText = ((await row.innerText()) || rawText).trim() || rawText; } catch {}

      if (!isTennisEventRow(rawText)) continue;
      const title = eventTitleOnly(rawText);

      console.log(`\n🎯 ${tabName} ${t + 1}/${indices.length} (event only, no odds): ${title}`);

      await row.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(250);

      // Click the event link only (not odds buttons). Events and animations only.
      let clicked = false;
      const eventLink = row.locator('a[href*="/event/"]').first();
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
        console.log('When I open an available tennis event');
        console.log('Then the event page should load successfully');
        tested++;
        const hasAnim = await openEventAndCheckAnimation(title);
        if (hasAnim) {
          console.log('And a live animation should be displayed if available ✅');
          passed++;
          results.push(`PASS: ${title}`);
        } else {
          console.log('And a live animation should be displayed if available ⚠️ (not available for this event)');
          failed++;
          results.push(`FAIL: ${title} | URL: ${page.url()}`);
        }
      }

      try {
        await gotoTennisHome();
        await clickTabIfVisible(tabName);
        await page.waitForTimeout(500);
      } catch {
        // Page/browser may be closed (e.g. test timeout); stop iterating and return results.
        break;
      }
    }

    console.log(`\n🧪 === TENNIS (${tabName}) RESULTS ===`);
    console.log(`📊 Total Tennis Events Tested: ${tested}`);
    console.log(`✅ Events with Animations (PASS): ${passed}`);
    console.log(`❌ Events without Animations (FAIL): ${failed}`);
    console.log(`📋 === DETAILED RESULTS (${tabName}) ===`);
    results.forEach(r => console.log(r));

    return { tested, passed, failed, results };
  };

  console.log('🚀 Feature: Tennis page navigation and live animation validation');
  console.log('🧭 Scenario: User navigates to Tennis events and verifies live animations');

  console.log('Given I navigate to "https://www.betwright.com"');
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
  console.log('Then I should land on the Betwright home page ✅');

  console.log('And a cookie consent popup should be displayed');
  await acceptPopups(page);
  const allowAll = page.getByRole('button', { name: /Allow all/i });
  if (await allowAll.isVisible({ timeout: 1500 }).catch(() => false)) {
    console.log('When I click the "Allow all" button');
    await allowAll.click({ timeout: 2000 }).catch(() => {});
    await expect(allowAll).not.toBeVisible({ timeout: 3000 });
    console.log('Then the cookie consent popup should be dismissed ✅');
  } else {
    console.log('ℹ️ Cookie consent popup not displayed (already accepted or not present)');
  }

  console.log('When I view the left-hand navigation panel');
  await page.waitForTimeout(1500);
  const navTexts = await page.$$eval(
    'nav a, nav button, [class*="nav"] a, [class*="nav"] button, [class*="menu"] a, [class*="sidebar"] a, [data-test*="nav"] a',
    links => links
      .map(el => (el.textContent || '').trim())
      .filter(Boolean)
  );
  const navTextsLower = navTexts.map(t => t.toLowerCase());
  const sportMatches = (sport: string): boolean => {
    const alternatives = sportAlternatives[sport];
    const toMatch = alternatives ? alternatives : [sport];
    const exactOrPartial = toMatch.some(alt => navTextsLower.some(txt => txt === alt.toLowerCase() || txt.includes(alt.toLowerCase())));
    if (exactOrPartial) return true;
    if (sport === 'American Football') {
      return navTextsLower.some(txt => txt.includes('american') && txt.includes('football')) || navTextsLower.some(txt => txt.includes('nfl'));
    }
    return navTextsLower.some(txt => txt.includes(sport.toLowerCase()));
  };
  expectedSports.forEach(sport => {
    const present = sportMatches(sport);
    expect(present, `${sport} should be listed in left navigation (found: ${navTexts.slice(0, 15).join(', ')})`).toBeTruthy();
  });
  console.log('Then I should see the following sports listed:');
  expectedSports.forEach(s => console.log(`  | ${s} |`));

  console.log('When I click on "Tennis"');
  await gotoTennisHome();
  expect(page.url()).toContain('tennis');
  console.log('Then I should be redirected to the Tennis home page ✅');

  // In-Play from header → return to left nav → click Tennis again → back to Tennis home
  console.log('When I navigate to the "In-Play" section from the site header');
  const inPlayHeader = page.getByRole('link', { name: /In[- ]?Play/i }).or(page.getByRole('button', { name: /In[- ]?Play/i }))
    .or(page.locator('header a:has-text("In-Play"), header a:has-text("In Play")').first());
  if (await inPlayHeader.first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await inPlayHeader.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(1500);
  }
  console.log('And I return to the left-hand navigation panel');
  await page.waitForTimeout(500);
  console.log('And I click on "Tennis" again');
  await gotoTennisHome();
  expect(page.url()).toContain('tennis');
  console.log('Then I should return to the Tennis home page successfully ✅');

  // Ensure we reach the events page where Today/Tomorrow are visible. Wait for tabs to hydrate (Chrome/Firefox need time).
  let tabsOrEventsReady = await waitForTennisTabsOrEvents();
  if (!tabsOrEventsReady) {
    // Optional: try activating Events view (In-Play/Anytime) if present (like Cricket).
    const inPlayOrAnytime = page.getByRole('link', { name: /In[- ]?Play/i }).or(page.getByRole('button', { name: /In[- ]?Play/i }))
      .or(page.getByRole('link', { name: /^Anytime$/i })).or(page.getByRole('button', { name: /^Anytime$/i }));
    if (await inPlayOrAnytime.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await inPlayOrAnytime.first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1500);
      await gotoTennisHome();
      await page.waitForTimeout(1000);
      tabsOrEventsReady = await waitForTennisTabsOrEvents();
    }
  }
  if (!tabsOrEventsReady) {
    console.log('⚠️ Tennis events tabs not visible; navigating directly to Tennis events page...');
    await gotoTennisEventsPage();
  }

  console.log('And I should see the Events header with the following options:');
  expectedTabs.forEach(t => console.log(`  | ${t} |`));
  // Give the Tennis page time to fully render its events header.
  await page.waitForTimeout(2500);
  for (const tab of expectedTabs) {
    const found = await clickTabIfVisible(tab);
    if (!found) console.log(`⚠️ Tab not visible: ${tab}`);
    await page.waitForTimeout(200);
  }
  for (const tab of requiredTabs) {
    const found = await clickTabIfVisible(tab);
    if (!found) await debugTennisPage(`missing-${tab.toLowerCase().replace(/\s+/g, '-')}`);
    expect(found, `${tab} tab should be visible`).toBeTruthy();
    await page.waitForTimeout(200);
  }

  // Example event from BDD (optional: open when available on Today tab)
  const exampleEventName = 'Jessica Pegula vs Elena Rybakina';

  const tryOpenSpecificEvent = async (eventName: string): Promise<boolean> => {
    const list = getEventList();
    const count = await list.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const row = list.nth(i);
      const text = await row.innerText().catch(() => '');
      if (text && text.includes('Pegula') && text.includes('Rybakina')) {
        console.log(`When I open a Tennis event`);
        console.log(`  | ${eventName} |`);
        await row.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
        await row.click({ timeout: 5000 }).catch(() => row.locator('a').first().click({ timeout: 5000 }));
        await page.waitForLoadState('domcontentloaded').catch(() => {});
        await page.waitForTimeout(1000);
        if (/event/.test(page.url())) {
          console.log('Then the Tennis event page should load successfully');
          await openEventAndCheckAnimation(eventName);
          console.log('And a live animation should be displayed if available');
          await gotoTennisHome();
          await clickTabIfVisible('Today');
          await page.waitForTimeout(500);
          return true;
        }
        await gotoTennisHome();
        await clickTabIfVisible('Today');
        return false;
      }
    }
    return false;
  };

  console.log('When I select the "Today" tab');
  console.log('And I scroll through the list of available Tennis events');
  await gotoTennisHome();
  const todayClicked = await clickTabIfVisible('Today');

  let todayHasEvents = false;
  if (todayClicked) {
    await page.waitForTimeout(2000);
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 800);
      await page.waitForTimeout(400);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    const list = getEventList();
    const count = await list.count().catch(() => 0);
    todayHasEvents = count > 0;

    if (todayHasEvents) {
      const openedExample = await tryOpenSpecificEvent(exampleEventName);
      if (!openedExample) {
        console.log(`When I open a Tennis event (example "${exampleEventName}" not in list, continuing with all events)`);
      }
    }
  }

  // Complete animation validation for Today, then Tomorrow
  let todayResults = { tested: 0, passed: 0, failed: 0, results: [] as string[] };
  let tomorrowResults = { tested: 0, passed: 0, failed: 0, results: [] as string[] };

  if (todayHasEvents) {
    console.log('When I complete animation validation for events under the "Today" tab');
    let eventsTestedSoFar = 0;
    todayResults = await testTabEvents('Today', ANIMATION_EVENTS_PER_SPORT - eventsTestedSoFar);
    eventsTestedSoFar += todayResults.tested;
    console.log('And I navigate to the "Tomorrow" tab');
    console.log('And I open available Tennis events');
    tomorrowResults = await testTabEvents('Tomorrow', ANIMATION_EVENTS_PER_SPORT - eventsTestedSoFar);
  } else {
    console.log('If no Tennis events are available under the "Today" tab');
    console.log('Then I should automatically move to the "Tomorrow" tab ✅');
    console.log('And I navigate to the "Tomorrow" tab');
    console.log('And I open available Tennis events');
    tomorrowResults = await testTabEvents('Tomorrow', ANIMATION_EVENTS_PER_SPORT);
  }

  console.log('\nThen the event page should load successfully');
  console.log('And a live animation should be displayed if available');
  console.log('And I should be able to validate Tennis live animations for events under both the "Today" and "Tomorrow" tabs');
  console.log('And I should confirm that the animation behavior matches the expected functionality defined in the PlanetSportBet Tennis animation tests');
  
  console.log(`\n🏁 === FINAL TENNIS TEST SUMMARY ===`);
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

  const animationFailLines = totalFailed > 0
    ? betwrightAnimationFailLinesForEmail('Tennis', todayResults, tomorrowResults)
    : [];
  appendBetwrightEmailFailures(animationFailLines);

  expect(totalTested, 'Should test at least one tennis event across Today+Tomorrow').toBeGreaterThan(0);
  expect(totalFailed, missingAnimationsAssertMessage(animationFailLines)).toBe(0);
});

