import { test, expect, chromium } from '@playwright/test';

test('Check the animate-svg appears on SBLive Football live event pages', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const page = await browser.newPage();
  try {
    // 1. Go to home page
    await page.goto('https://sblive.io/', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'test-results/01-homepage-sblive-football.png', fullPage: true });
    console.log('Current URL:', page.url());

    // 2. Dismiss cookie popup if visible
    const cookieSelector = '.unic-agree-all-button, button:has-text("Agree and proceed")';
    try {
      await page.waitForSelector(cookieSelector, { timeout: 5000 });
      const cookieBtn = await page.$(cookieSelector);
      if (cookieBtn) {
        await cookieBtn.click();
        await page.waitForSelector(cookieSelector, { state: 'hidden', timeout: 5000 });
        await page.screenshot({ path: 'test-results/02-cookie-dismissed-sblive-football.png', fullPage: true });
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
    await page.screenshot({ path: 'test-results/03-live-dropdown-clicked-sblive-football.png', fullPage: true });

    // 4. Wait for dropdown menu and click Football inside dropdown
    const footballDropdownSelector = '.dropdown-menu a.close-nav:has-text("Football")';
    await page.waitForSelector(footballDropdownSelector, { timeout: 5000 });
    await page.click(footballDropdownSelector);
    console.log('Clicked Football tab in dropdown.');
    await page.screenshot({ path: 'test-results/04-football-in-dropdown-clicked-sblive-football.png', fullPage: true });

    // 5. Wait for match_table_content elements to appear
    const matchSelector = '.match_table_content';
    await page.waitForSelector(matchSelector, { timeout: 15000 });
    let matches = await page.$$(matchSelector);
    console.log(`Found ${matches.length} football matches.`);

    // 6. Determine which matches to test
    let indicesToTest: number[] = [];
    if (matches.length > 40) {
      while (indicesToTest.length < 20) {
        let rand = Math.floor(Math.random() * matches.length);
        if (!indicesToTest.includes(rand)) indicesToTest.push(rand);
      }
    } else {
      indicesToTest = Array.from({length: matches.length}, (_, i) => i);
    }
    console.log(`Testing ${indicesToTest.length} football matches.`);

    // 7. Test each selected match and track missing animations
    let missingAnimationDesc: { index: number, desc: string }[] = [];
    let foundAnimation = 0;
    for (const idx of indicesToTest) {
      matches = await page.$$(matchSelector); // re-query in case DOM changes
      const match = matches[idx];
      if (!match) continue;

      // Extract a description from the match_table_content element
      let desc = '';
      try {
        desc = await match.innerText();
        desc = desc.trim().replace(/\s+/g, ' ').slice(0, 120); // Shorten for log
      } catch { desc = '[Could not extract text]'; }

      await match.scrollIntoViewIfNeeded();
      await match.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `test-results/football-event-detail-${idx + 1}.png`, fullPage: true });

      // 8. Check for .animate-svg
      const svgSelector = '.animate-svg';
      const svg = await page.$(svgSelector);
      if (svg) {
        foundAnimation++;
        console.log(`✅ Animate SVG found in football event ${idx + 1}: ${desc}`);
        await page.screenshot({ path: `test-results/animate-svg-found-football-${idx + 1}.png`, fullPage: true });
      } else {
        missingAnimationDesc.push({ index: idx + 1, desc });
        console.log(`❌ Animate SVG NOT found in football event ${idx + 1}: ${desc}`);
        await page.screenshot({ path: `test-results/animate-svg-NOT-found-football-${idx + 1}.png`, fullPage: true });
      }

      await page.goBack();
      await page.waitForSelector(matchSelector, { timeout: 10000 });
    }
    console.log(`Tested ${indicesToTest.length} football matches out of ${matches.length}.`);
    console.log(`Animate SVG found in ${foundAnimation} matches.`);
    if (missingAnimationDesc.length > 0) {
      console.log('Animate SVG NOT found in the following matches:');
      for (const miss of missingAnimationDesc) {
        console.log(`- [${miss.index}] ${miss.desc}`);
      }
    } else {
      console.log('Animate SVG was found in all tested matches.');
    }
  } finally {
    await browser.close();
  }
});
