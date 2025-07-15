import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://planetsportbet.com/');
  await page.goto('https://planetsportbet.com/inplay');

  const eventLinks = await page.$$('a[href^="/event/"]');
  if (eventLinks.length > 0) {
    await eventLinks[0].click();
    await page.waitForURL(/\/event\/\d+/);

    const animation = await page.$('.swiper-slide.match-information.swiper-slide-prev');
    if (animation) {
      console.log('✅ Animation found!');
    } else {
      console.log('❌ Animation NOT found on event page');
    }
  } else {
    console.log('❌ No live event links found on In Play page');
  }

  // await browser.close(); // Comment out if you want to inspect manually
})();
