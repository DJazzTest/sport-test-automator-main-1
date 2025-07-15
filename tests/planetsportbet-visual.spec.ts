import { test, expect, chromium } from '@playwright/test';

import { dismissOverlays, goToInPlay } from './helpers';

test('Navigate to In Play, select live event, and verify event details', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch({
    headless: process.env.CI ? true : false,
    slowMo: process.env.CI ? 0 : 1000,
    args: process.env.CI ? ['--no-sandbox', '--disable-setuid-sandbox'] : [],
  });
  const page = await browser.newPage();
  await page.goto('https://planetsportbet.com/', { waitUntil: 'domcontentloaded' });
  await dismissOverlays(page);
  await goToInPlay(page);
  try {
    // 1. Go to home page
    console.log('Navigating to home page...');
    await page.goto('https://planetsportbet.com/', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'test-results/01-homepage.png', fullPage: true });
    console.log('Current URL:', page.url());

    // 2. Dismiss 'Allow All' cookie popup if visible
    const allowAllSelector = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll';
    try {
      await page.waitForSelector(allowAllSelector, { timeout: 7000 });
      const allowAllBtn = await page.$(allowAllSelector);
      if (allowAllBtn && await allowAllBtn.isVisible()) {
        console.log('🔔 "Allow All" cookie button is visible, clicking...');
        await allowAllBtn.click();
        // Wait for the popup to disappear
        await page.waitForSelector(allowAllSelector, { state: 'hidden', timeout: 5000 });
        await page.screenshot({ path: 'test-results/02-cookie-dismissed.png', fullPage: true });
        console.log('✅ Cookie popup dismissed.');
      }
    } catch (err) {
      console.log('ℹ️ "Allow All" cookie button not found or already dismissed.');
    }

    // 2b. Dismiss overlay close button if present
    const closeIconSelector = '[data-test="close-icon"]';
    try {
      await page.waitForSelector(closeIconSelector, { timeout: 5000 });
      const closeBtn = await page.$(closeIconSelector);
      if (closeBtn && await closeBtn.isVisible()) {
        console.log('🔔 Overlay close button is visible, clicking...');
        await closeBtn.click();
        // Wait for overlay to disappear
        await page.waitForTimeout(500); // Give time for overlay to animate out
        await page.screenshot({ path: 'test-results/03-overlay-closed.png', fullPage: true });
        console.log('✅ Overlay closed.');
      }
    } catch (err) {
      console.log('ℹ️ Overlay close button not found or already dismissed.');
    }

    // 3. Handle overlays that may block header clicks
    const overlaySelector = '.css-1u3p516-LPOverlay';
    try {
      const overlay = await page.$(overlaySelector);
      if (overlay && await overlay.isVisible()) {
        console.log('🔔 Overlay detected, waiting for it to disappear...');
        const closeBtn = await overlay.$('button, [role="button"]');
        if (closeBtn) {
          await closeBtn.click();
          await page.waitForTimeout(500);
        }
        await page.waitForSelector(overlaySelector, { state: 'hidden', timeout: 10000 });
        console.log('✅ Overlay is gone.');
      }
    } catch (err) {
      console.error('❌ Overlay did not disappear:', err);
      await page.screenshot({ path: 'test-results/overlay-error.png', fullPage: true });
      throw err;
    }

    // 4. Click IN PLAY in the header
    const inPlaySelector = 'header a[href="/inplay"], a:has-text("IN PLAY")';
    try {
      await page.waitForSelector(inPlaySelector, { timeout: 10000 });
      await page.click(inPlaySelector);
      await page.waitForURL('**/inplay', { timeout: 10000 });
      await page.screenshot({ path: 'test-results/04-inplay-clicked.png', fullPage: true });
      console.log('Clicked IN PLAY, current URL:', page.url());
    } catch (err) {
      console.error('❌ Failed to click IN PLAY or navigate:', err);
      await page.screenshot({ path: 'test-results/inplay-error.png', fullPage: true });
      throw err;
    }

    // 5. Ensure the All Sports tab is present
    const allSportsSelector = 'button[title="All Sports"][data-test-filter-key="empty"]';
    try {
      await page.waitForSelector(allSportsSelector, { timeout: 10000 });
      const allSportsBtn = await page.$(allSportsSelector);
      expect(allSportsBtn, 'All Sports tab/button should be present').not.toBeNull();
      console.log('All Sports tab found.');
    } catch (err) {
      console.error('❌ All Sports tab/button not found:', err);
      await page.screenshot({ path: 'test-results/allsports-error.png', fullPage: true });
      throw err;
    }

    // 6. Iterate over all live events and check for sport widget
    const liveEventSelector = '[data-test="event-row"], .css-1i4eg6l-Event';
    await page.waitForSelector(liveEventSelector, { timeout: 15000 });
    const liveEvents = await page.$$(liveEventSelector);
    expect(liveEvents.length, 'There should be at least one live event').toBeGreaterThan(0);
    console.log(`Found ${liveEvents.length} live events.`);

    // --- Test at least 5 events if more than 10, else all ---
    const toTest = liveEvents.length > 10 ? 5 : liveEvents.length;
    let widgetCount = 0;
    for (let i = 0; i < toTest; i++) {
      const events = await page.$$(liveEventSelector);
      const event = events[i];
      if (!event) continue;
      await event.scrollIntoViewIfNeeded();
      await event.click();
      console.log(`Clicked live event ${i + 1}/${liveEvents.length}`);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/event-detail-${i + 1}.png`, fullPage: true });
      const widgetSelector = 'app-the-sport-widget-component .animated_widget';
      const widget = await page.$(widgetSelector);
      if (widget) {
        await page.screenshot({ path: `test-results/widget-found-event-${i + 1}.png`, fullPage: true });
        console.log(`✅ Widget found in event ${i + 1}`);
        widgetCount++;
      } else {
        console.log(`❌ Widget not found in event ${i + 1}.`);
      }
      // Go back to IN PLAY after checking each event
      await page.goBack();
      await page.waitForSelector(liveEventSelector, { timeout: 10000 });
    }
    if (widgetCount < toTest) {
      await page.screenshot({ path: 'test-results/not-enough-widgets-found.png', fullPage: true });
      throw new Error(`Only ${widgetCount} out of ${toTest} tested live events contained the expected sport widget component.`);
    } else {
      console.log(`Test passed: ${widgetCount} out of ${toTest} tested live events contained the widget.`);
    }


    // (Old debug and data-box logic removed: now only check for widget)
    // This block is intentionally left empty, as widget checking is now handled in the event iteration above.

  } finally {
    await browser.close();
  }
});


