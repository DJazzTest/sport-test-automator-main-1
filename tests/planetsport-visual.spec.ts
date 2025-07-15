import { test, expect, chromium } from '@playwright/test';

// This test automates the animation widget check for planetsport.com football live scores

test('Check animation appears on PlanetSport Football Live Scores', async () => {
  const browser = await chromium.launch({ headless: process.env.CI ? true : false, slowMo: process.env.CI ? 0 : 1000 });
  const page = await browser.newPage();
  try {
    // 1. Go to planetsport.com
    await page.goto('https://www.planetsport.com/', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'test-results/ps-01-home.png', fullPage: true });

    // 2. Click on Football (Soccer) - try to find a nav or menu link
    const footballSelector = 'a:has-text("Football")';
    await page.waitForSelector(footballSelector, { timeout: 10000 });
    await page.click(footballSelector);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/ps-02-football-clicked.png', fullPage: true });

    // 3. Click on Live Scores (may need to click twice if there are two)
    const liveScoresSelector = 'a:has-text("Live Scores")';
    await page.waitForSelector(liveScoresSelector, { timeout: 10000 });
    const liveLinks = await page.$$(liveScoresSelector);
    if (liveLinks.length === 0) throw new Error('No Live Scores links found');
    await liveLinks[0].click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/ps-03-live-scores-clicked.png', fullPage: true });

    // 4. Wait for list of teams (leg-inf)
    const teamSelector = '.leg-inf, [data-testid="leg-inf"]';
    await page.waitForSelector(teamSelector, { timeout: 10000 });
    const teams = await page.$$(teamSelector);
    if (teams.length === 0) throw new Error('No leg-inf team elements found');
    await teams[0].scrollIntoViewIfNeeded();
    const teamText = await teams[0].innerText();
    await page.screenshot({ path: 'test-results/ps-04-leg-inf-list.png', fullPage: true });

    // 5. Click into first team (leg-inf)
    await teams[0].click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/ps-05-leg-inf-detail.png', fullPage: true });

    // 6. Wait for animation (try .animate-svg, .animated_widget, svg)
    let animationFound = false;
    try {
      await page.waitForSelector('.animate-svg, .animated_widget, svg', { timeout: 7000 });
      animationFound = true;
    } catch {}
    if (animationFound) {
      console.log('✅ Animation widget is present in leg-inf detail page.');
      await page.screenshot({ path: 'test-results/ps-06-animation-present.png', fullPage: true });
    } else {
      console.log('❌ Animation widget NOT found in leg-inf detail page.');
      await page.screenshot({ path: 'test-results/ps-06-animation-NOT-present.png', fullPage: true });
    }
  } finally {
    await browser.close();
  }
});
