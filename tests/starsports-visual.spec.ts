import { test, expect, chromium } from '@playwright/test';

test('Navigate to In Play, select live event, and verify event details on Star Sports', async () => {
  test.setTimeout(120_000);
  // Launch browser in slow motion for debugging
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const page = await browser.newPage();
  try {
    // 1. Go to home page
    await page.goto('https://starsports.bet/', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'test-results/01-homepage-starsports.png', fullPage: true });
    console.log('Current URL:', page.url());

    // 2. Dismiss 'Allow All' cookie popup if visible
    const allowAllSelector = '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll';
    try {
      await page.waitForSelector(allowAllSelector, { timeout: 5000 });
      const allowAllBtn = await page.$(allowAllSelector);
      if (allowAllBtn) {
        await allowAllBtn.click();
        // Wait for the popup to disappear
        await page.waitForSelector(allowAllSelector, { state: 'hidden', timeout: 5000 });
        await page.screenshot({ path: 'test-results/02-cookie-dismissed-starsports.png', fullPage: true });
        console.log('✅ Cookie popup dismissed.');
      }
    } catch (err) {
      console.log('ℹ️ "Allow All" cookie button not found or already dismissed.');
    }

    // 3. Click the IN PLAY header link (try multiple selectors)
    const inPlaySelectors = [
      '[data-test="header-link-inplay"]',
      'a[href="/inplay"]',
      'text=IN PLAY'
    ];
    let foundInPlay = false;
    for (const selector of inPlaySelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 4000 });
        await page.click(selector);
        await page.waitForURL('**/inplay', { timeout: 10000 });
        await page.screenshot({ path: 'test-results/04-inplay-clicked-starsports.png', fullPage: true });
        console.log('Clicked IN PLAY, current URL:', page.url());
        foundInPlay = true;
        break;
      } catch {}
    }
    if (!foundInPlay) {
      console.error('❌ Failed to click IN PLAY or navigate.');
      await page.screenshot({ path: 'test-results/inplay-header-error-starsports.png', fullPage: true });
      throw new Error('Could not find or click IN PLAY link.');
    }


    // 5. Ensure "All Sports" tab is present (try multiple selectors)
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
      await page.screenshot({ path: 'test-results/allsports-tab-error-starsports.png', fullPage: true });
      throw new Error('Could not find All Sports tab.');
    }


    // 6. Find and test up to 5 live events for the widget
    const liveEventSelector = '[data-test="event-row"], .css-1i4eg6l-Event';
    await page.waitForSelector(liveEventSelector, { timeout: 15000 });
    const liveEvents = await page.$$(liveEventSelector);
    expect(liveEvents.length, 'There should be at least one live event').toBeGreaterThan(0);
    console.log(`Found ${liveEvents.length} live events.`);

    // --- Robust event sampling and logging, matches planetsportbet test ---
let eventIndices: number[] = [];
if (liveEvents.length === 5) {
  eventIndices = [0, 1, 2];
} else if (liveEvents.length === 10) {
  eventIndices = [0, 1, 2, 3, 4];
} else if (liveEvents.length === 20) {
  eventIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
} else if (liveEvents.length === 40) {
  eventIndices = Array.from({length: 20}, (_, i) => i);
} else if (liveEvents.length > 40) {
  const indices = Array.from({length: liveEvents.length}, (_, i) => i);
  for (let i = 0; i < 25; i++) {
    const rand = Math.floor(Math.random() * indices.length);
    eventIndices.push(indices.splice(rand, 1)[0]);
  }
} else {
  eventIndices = Array.from({length: liveEvents.length}, (_, i) => i);
}
let widgetCount = 0;
for (const i of eventIndices) {
  const events = await page.$$(liveEventSelector);
  const event = events[i];
  if (!event) continue;
  await event.scrollIntoViewIfNeeded();
  await event.click();
  console.log(`Clicked live event ${i + 1}/${liveEvents.length}`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `test-results/event-detail-starsports-${i + 1}.png`, fullPage: true });
  const widgetSelector = 'app-the-sport-widget-component .animated_widget';
  const widget = await page.$(widgetSelector);
  if (widget) {
    await page.screenshot({ path: `test-results/widget-found-event-starsports-${i + 1}.png`, fullPage: true });
    widgetCount++;
    console.log(`✅ Widget found in event ${i + 1}`);
  } else {
    await page.screenshot({ path: `test-results/widget-NOT-found-event-starsports-${i + 1}.png`, fullPage: true });
    // Try to extract additional info from the event-row
    let eventInfo = '';
    try {
      if (event) {
        const text = await event.innerText();
        const id = await event.getAttribute('id');
        const dataId = await event.getAttribute('data-id');
        const href = await event.getAttribute('href');
        eventInfo = ` | TEXT: ${text?.replace(/\s+/g, ' ').trim().slice(0, 200)}${id ? ' | id: ' + id : ''}${dataId ? ' | data-id: ' + dataId : ''}${href ? ' | href: ' + href : ''}`;
      }
    } catch (err) {
      eventInfo += ' | [Could not extract event details]';
    }
    console.log(`❌ Widget not found in event ${i + 1}.${eventInfo}`);
  }
  // Go back to IN PLAY after checking each event
  await page.goBack();
  await page.waitForSelector(liveEventSelector, { timeout: 10000 });
}
if (widgetCount < eventIndices.length) {
  await page.screenshot({ path: 'test-results/not-enough-widgets-found-starsports.png', fullPage: true });
  throw new Error(`Only ${widgetCount} out of ${eventIndices.length} tested live events contained the expected sport widget component.`);
} else {
  console.log(`Test passed: ${widgetCount} out of ${eventIndices.length} tested live events contained the widget.`);
}


  } finally {
    await browser.close();
  }
});
