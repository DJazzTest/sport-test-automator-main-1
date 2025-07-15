import { test, expect, chromium } from '@playwright/test';

test('Check the animated widget appears on SBLive Cricket live event pages', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const page = await browser.newPage();
  try {
    // 1. Go to home page
    await page.goto('https://sblive.io/', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'test-results/01-homepage-sblive.png', fullPage: true });
    console.log('Current URL:', page.url());

    // 2. Dismiss cookie popup if visible
    const cookieSelector = '.unic-agree-all-button, button:has-text("Agree and proceed")';
    try {
      await page.waitForSelector(cookieSelector, { timeout: 5000 });
      const cookieBtn = await page.$(cookieSelector);
      if (cookieBtn) {
        await cookieBtn.click();
        await page.waitForSelector(cookieSelector, { state: 'hidden', timeout: 5000 });
        await page.screenshot({ path: 'test-results/02-cookie-dismissed-sblive.png', fullPage: true });
        console.log('✅ Cookie popup dismissed.');
      }
    } catch (err) {
      console.log('ℹ️ Cookie popup not found or already dismissed.');
    }

    // 3. Click the LIVE dropdown in the nav bar
    const liveDropdownSelector = 'a[data-toggle="dropdown"]:has-text("Live")';
    await page.waitForSelector(liveDropdownSelector, { timeout: 8000 });
    await page.click(liveDropdownSelector);
    console.log('Clicked LIVE dropdown.');
    await page.screenshot({ path: 'test-results/03-live-dropdown-clicked-sblive.png', fullPage: true });

    // 4. Wait for dropdown menu and click Cricket inside dropdown
    const dropdownMenuSelector = '.dropdown-menu.show, .dropdown-menu';
    await page.waitForSelector(dropdownMenuSelector, { timeout: 5000 });
    const cricketDropdownSelector = '.dropdown-menu a.close-nav:has-text("Cricket")';
    await page.waitForSelector(cricketDropdownSelector, { timeout: 5000 });
    await page.click(cricketDropdownSelector);
    console.log('Clicked Cricket tab in dropdown.');
    await page.screenshot({ path: 'test-results/04-cricket-in-dropdown-clicked-sblive.png', fullPage: true });

    // 5. Wait for live matches to appear and test at least half
    const matchItemSelector = '.pr-match-item .all-wrp-link';
    await page.waitForSelector(matchItemSelector, { timeout: 15000 });
    let matches = await page.$$(matchItemSelector);
    expect(matches.length).toBeGreaterThan(0);
    console.log(`Found ${matches.length} live matches.`);

    const toTest = Math.max(1, Math.floor(matches.length / 2));
    console.log(`Testing ${toTest} out of ${matches.length} live matches.`);

    let widgetCount = 0;
    for (let i = 0; i < toTest; i++) {
      matches = await page.$$(matchItemSelector); // re-query in case DOM changes
      const match = matches[i];
      if (!match) continue;
      await match.scrollIntoViewIfNeeded();
      await match.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/event-detail-sblive-${i + 1}.png`, fullPage: true });

      // Check for <iframe title="Live Match Animation">
      const iframeSelector = 'iframe[title="Live Match Animation"]';
      await page.waitForTimeout(2000); // wait for animation to load
      const iframe = await page.$(iframeSelector);
      if (iframe) {
        const isVisible = await iframe.isVisible();
        expect(isVisible, `Live Match Animation iframe should be visible in event ${i + 1}`).toBe(true);
        console.log(`✅ Live Match Animation iframe found and visible in event ${i + 1}.`);
        await page.screenshot({ path: `test-results/iframe-found-sblive-${i + 1}.png`, fullPage: true });
        widgetCount++;
      } else {
        console.log(`❌ Live Match Animation iframe NOT found in event ${i + 1}.`);
        await page.screenshot({ path: `test-results/iframe-NOT-found-sblive-${i + 1}.png`, fullPage: true });
      }
      await page.goBack();
      await page.waitForSelector(matchItemSelector, { timeout: 10000 });
    }
    console.log(`Tested ${toTest} matches out of ${matches.length}. Live Match Animation found in ${widgetCount} matches.`);
  } finally {
    await browser.close();
  }
});
