import { test, expect, chromium } from '@playwright/test';

test('Check animation in first in-play event (headed)', async () => {
  const browser = await chromium.launch({ headless: false }); // Headed mode!
  const page = await browser.newPage();

  // Step 1: Go to homepage
  await page.goto('https://planetsportbet.com/');

  // Step 2: Go to In Play section
  await page.goto('https://planetsportbet.com/inplay');

  // Step 3: Click first live event link, if any
  const eventLinks = await page.$$('a[href^="/event/"]');
  if (eventLinks.length > 0) {
    await eventLinks[0].click();
    await page.waitForURL(/\/event\/\d+/);

    // Step 4: Check for animation element on event page
    const animation = await page.$('.swiper-slide.match-information.swiper-slide-prev');
    if (animation) {
      console.log('✅ Animation found!');
    } else {
      throw new Error('❌ Animation NOT found on event page');
    }
  } else {
    throw new Error('❌ No live event links found on In Play page');
  }

  await browser.close();
});
