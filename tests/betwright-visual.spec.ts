import { test, expect, chromium } from '@playwright/test';

import { dismissOverlays, goToInPlay } from './helpers';

test('Navigate to In Play, select live event, and verify event details on BetWright', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch({
    headless: process.env.CI ? true : false,
    slowMo: process.env.CI ? 0 : 1000,
    args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });
  const page = await browser.newPage();
  await page.goto('https://www.betwright.com/', { waitUntil: 'domcontentloaded' });
  await dismissOverlays(page);
  await goToInPlay(page);
  try {
    // 1. Go to home page
    await page.goto('https://www.betwright.com/', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'test-results/01-homepage-betwright.png', fullPage: true });
    console.log('Current URL:', page.url());

    // 2. Dismiss cookie popup if visible
    const allowAllSelector = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, button:has-text("Accept All")';
    try {
      await page.waitForSelector(allowAllSelector, { timeout: 5000 });
      const allowAllBtn = await page.$(allowAllSelector);
      if (allowAllBtn) {
        await allowAllBtn.click();
        await page.waitForSelector(allowAllSelector, { state: 'hidden', timeout: 5000 });
        await page.screenshot({ path: 'test-results/02-cookie-dismissed-betwright.png', fullPage: true });
        console.log('✅ Cookie popup dismissed.');
      }
    } catch (err) {
      console.log('ℹ️ Cookie popup not found or already dismissed.');
    }

    // 3. Click the IN PLAY header link (try multiple selectors)
    const inPlaySelectors = [
      '[data-test="header-link-inplay"]',
      'a[href="/inplay"]',
      'text=IN PLAY',
      'text=In-Play',
      'text=In Play'
    ];
    let foundInPlay = false;
    for (const selector of inPlaySelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 4000 });
        await page.click(selector);
        await page.waitForURL('**/inplay', { timeout: 10000 });
        await page.screenshot({ path: 'test-results/04-inplay-clicked-betwright.png', fullPage: true });
        console.log('Clicked IN PLAY, current URL:', page.url());
        foundInPlay = true;
        break;
      } catch {}
    }
    if (!foundInPlay) {
      console.error('❌ Failed to click IN PLAY or navigate.');
      await page.screenshot({ path: 'test-results/inplay-header-error-betwright.png', fullPage: true });
      throw new Error('Could not find or click IN PLAY link.');
    }

    // 4. Ensure "All Sports" tab is present (try multiple selectors)
    const allSportsSelectors = [
      '[data-test="all-sports-tab"]',
      'text=All Sports'
    ];
    let foundAllSports = false;
    for (const selector of allSportsSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 4000 });
        console.log('All Sports tab found.');
        foundAllSports = true;
        break;
      } catch {}
    }
    if (!foundAllSports) {
      console.error('❌ All Sports tab not found.');
      await page.screenshot({ path: 'test-results/allsports-tab-error-betwright.png', fullPage: true });
      throw new Error('Could not find All Sports tab.');
    }

    // 5. Find and test at least half of the live events for the widget
    const liveEventSelector = '[data-test="event-row"], .css-1i4eg6l-Event';
    await page.waitForSelector(liveEventSelector, { timeout: 15000 });
    const liveEvents = await page.$$(liveEventSelector);
    expect(liveEvents.length, 'There should be at least one live event').toBeGreaterThan(0);
    console.log(`Found ${liveEvents.length} live events.`);

    const toTest = Math.max(1, Math.floor(liveEvents.length / 2));
    let widgetCount = 0;
    const failedEvents: number[] = [];
    for (let i = 0; i < toTest; i++) {
      const events = await page.$$(liveEventSelector);
      const event = events[i];
      if (!event) continue;
      await event.scrollIntoViewIfNeeded();
      await event.click();
      console.log(`Clicked live event ${i + 1}/${liveEvents.length}`);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/event-detail-betwright-${i + 1}.png`, fullPage: true });
      const widgetSelector = 'app-the-sport-widget-component .animated_widget';
      const widget = await page.$(widgetSelector);
      if (widget) {
        await page.screenshot({ path: `test-results/widget-found-event-betwright-${i + 1}.png`, fullPage: true });
        console.log(`✅ Widget found in event ${i + 1}`);
        widgetCount++;
      } else {
        console.log(`❌ Widget not found in event ${i + 1}.`);
        failedEvents.push(i + 1);
      }
      await page.goBack();
      await page.waitForSelector(liveEventSelector, { timeout: 10000 });
    }
    if (widgetCount < toTest) {
      await page.screenshot({ path: 'test-results/not-enough-widgets-found-betwright.png', fullPage: true });
      console.error(`Widget missing in event(s): ${failedEvents.join(', ')}`);
      throw new Error(`Only ${widgetCount} out of ${toTest} tested live events contained the expected sport widget component. Widget missing in event(s): ${failedEvents.join(', ')}`);
    } else {
      console.log(`Test passed: ${widgetCount} out of ${toTest} tested live events contained the widget.`);
    }
  } finally {
    await browser.close();
  }
});
