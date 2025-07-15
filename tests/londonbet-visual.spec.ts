import { test, expect, chromium } from '@playwright/test';

test('Check the animated widget appears on LondonBet live event pages', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch({ headless: process.env.CI ? true : false, slowMo: process.env.CI ? 0 : 1000 });
  const page = await browser.newPage();
  try {
    // 1. Go to home page
    await page.goto('https://london.bet/', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'test-results/01-homepage-londonbet.png', fullPage: true });
    console.log('Current URL:', page.url());

    // 2. Dismiss cookie popup if visible
    const cookieSelector = 'button:has-text("Allow All"), button:has-text("Accept All")';
    try {
      await page.waitForSelector(cookieSelector, { timeout: 5000 });
      const cookieBtn = await page.$(cookieSelector);
      if (cookieBtn) {
        await cookieBtn.click();
        await page.waitForSelector(cookieSelector, { state: 'hidden', timeout: 5000 });
        await page.screenshot({ path: 'test-results/02-cookie-dismissed-londonbet.png', fullPage: true });
        console.log('✅ Cookie popup dismissed.');
      }
    } catch (err) {
      console.log('ℹ️ Cookie popup not found or already dismissed.');
    }

    // 2. Go directly to /inplay
    await page.goto('https://www.london.bet/inplay', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'test-results/01-inplay-direct-londonbet.png', fullPage: true });
    console.log('Landed on /inplay:', page.url());

    // 3. If a cookie/consent popup appears, click Accept all or Allow all
    const acceptSelectors = [
      'button:has-text("Accept all")',
      'button:has-text("Allow all")',
      'button:has-text("ACCEPT ALL")',
      'button:has-text("ALLOW ALL")'
    ];
    let popupDismissed = false;
    for (const sel of acceptSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        popupDismissed = true;
        await page.screenshot({ path: 'test-results/02-popup-dismissed-londonbet.png', fullPage: true });
        console.log(`Dismissed popup with selector: ${sel}`);
        break;
      }
    }
    if (!popupDismissed) {
      console.log('No cookie/consent popup detected.');
    }

    // 4. Count EventRowNameLink and iterate through multiple events
    const rowSelector = '.css-dfcspo-EventRowWrapper';
    const eventRowNameSelector = 'a[data-test="EventRowNameLink-link"]';
    await page.waitForSelector(eventRowNameSelector, { timeout: 10000 });
    let eventRowNameLinks = await page.$$(eventRowNameSelector);
    console.log(`Found ${eventRowNameLinks.length} EventRowNameLink-link elements on /inplay page.`);
    await page.screenshot({ path: 'test-results/03-count-event-row-names-londonbet.png', fullPage: true });
    if (eventRowNameLinks.length === 0) {
      await page.screenshot({ path: 'test-results/04-no-event-row-names-londonbet.png', fullPage: true });
      throw new Error('No a[data-test="EventRowNameLink-link"] elements found.');
    }
    // Decide how many to click
    let toTest = 1;
    if (eventRowNameLinks.length >= 20) toTest = 10;
    else if (eventRowNameLinks.length >= 10) toTest = 5;
    else if (eventRowNameLinks.length >= 5) toTest = 2;
    console.log(`Will test ${toTest} events.`);
    const missingAnimate: { text: string, url: string }[] = [];
    for (let i = 0; i < toTest; i++) {
      eventRowNameLinks = await page.$$(eventRowNameSelector); // re-query after each goBack
      const link = eventRowNameLinks[i];
      if (!link) continue;
      const linkText = await link.innerText();
      const href = await link.getAttribute('href');
      const url = href && href.startsWith('http') ? href : `https://www.london.bet${href}`;
      await link.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/05-before-event-row-name-click-londonbet-${i + 1}.png`, fullPage: true });
      await page.waitForTimeout(1200); // slow motion
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
        link.click(),
      ]);
      await page.waitForTimeout(1200); // slow motion
      await page.screenshot({ path: `test-results/06-event-detail-londonbet-${i + 1}.png`, fullPage: true });
      console.log(`Clicked into event ${i + 1}: ${linkText}`);
      // Wait up to 5 seconds for .animate-svg to appear
      let animateSvg = null;
      try {
        animateSvg = await page.waitForSelector('.animate-svg', { timeout: 5000 });
      } catch {}
      if (animateSvg) {
        console.log(`✅ .animate-svg is present in event detail page for event ${i + 1}`);
        await page.screenshot({ path: `test-results/07-animate-svg-present-londonbet-${i + 1}.png`, fullPage: true });
      } else {
        console.log(`❌ .animate-svg is NOT present in event detail page for event ${i + 1}`);
        await page.screenshot({ path: `test-results/07-animate-svg-NOT-present-londonbet-${i + 1}.png`, fullPage: true });
        missingAnimate.push({ text: linkText, url });
      }
      // Go back and wait for the event list to reload
      await page.goBack();
      await page.waitForSelector(eventRowNameSelector, { timeout: 10000 });
      await page.waitForTimeout(1200); // slow motion
      await page.screenshot({ path: `test-results/08-after-goBack-londonbet-${i + 1}.png`, fullPage: true });
    }
    // Print summary of missing animate-svg
    const fs = require('fs');
    const path = require('path');
    const missingFile = path.join(__dirname, 'missing-animate-svg-events.txt');
    let fileContent = 'Events from the most recent run that did NOT have .animate-svg present:\n\n';
    if (missingAnimate.length > 0) {
      console.log('\nSummary: The following events did NOT have .animate-svg:');
      missingAnimate.forEach((evt, idx) => {
        console.log(`${idx + 1}. ${evt.text} — ${evt.url}`);
        fileContent += `${idx + 1}. ${evt.text} — ${evt.url}\n`;
      });
    } else {
      console.log('All tested events had .animate-svg present.');
      fileContent += 'All tested events had .animate-svg present.\n';
    }
    try {
      fs.writeFileSync(missingFile, fileContent, 'utf-8');
      console.log(`\nSummary written to ${missingFile}`);
    } catch (err) {
      console.error('Failed to write missing events file:', err);
    }
  } finally {
    await browser.close();
  }
});
