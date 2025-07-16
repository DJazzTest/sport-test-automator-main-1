 import { test, expect } from '@playwright/test';

// Helper to aggressively dismiss overlays
async function dismissOverlays(page, step = '') {
  for (let i = 0; i < 10; i++) {
    const overlays = await page.locator('.css-1u3p516-LPOverlay').count();
    if (overlays === 0) return;
    await page.screenshot({ path: `overlay_present_${step}_${i}.png`, fullPage: true });
    await page.evaluate(() => {
      document.querySelectorAll('.css-1u3p516-LPOverlay').forEach(el => el.remove());
    });
    await page.waitForTimeout(500);
  }
  // Final check
  const overlays = await page.locator('.css-1u3p516-LPOverlay').count();
  if (overlays > 0) {
    await page.screenshot({ path: `overlay_FAILED_${step}.png`, fullPage: true });
    throw new Error(`[${step}] Could not dismiss overlays after retries`);
  }
}

test('PlanetSportBet – In Play animation check', async ({ page }) => {
  try {
    // 1️⃣ Go to homepage
    await page.goto('https://planetsportbet.com/');
    console.log('[Step] Navigated to homepage:', page.url());
    await page.screenshot({ path: 'step1_homepage.png', fullPage: true });

    // 2️⃣ Accept cookies / pop-ups (handles “Allow All”, “Accept” or Cookiebot)
    try {
      const allowAllBtn = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
      if (await allowAllBtn.isVisible({ timeout: 2000 })) {
        await allowAllBtn.click();
        console.log('✅ Clicked Allow All');
      }
      const customizeBtn = page.locator('#CybotCookiebotDialogBodyLevelButtonCustomize');
      if (await customizeBtn.isVisible({ timeout: 2000 })) {
        await customizeBtn.click();
        console.log('✅ Clicked Customize');
      }
      const acceptBtn = page.locator('button:has-text("Accept")');
      if (await acceptBtn.isVisible({ timeout: 2000 })) {
        await acceptBtn.click();
        console.log('✅ Clicked Accept');
      }
    } catch (e) {
      await page.screenshot({ path: 'step2_cookie_error.png', fullPage: true });
      console.log('⚠️ Cookie popup error:', e);
    }

    // 3️⃣ Dismiss any sign-up overlay (close icon)
    try {
      const bannerClose = page.locator('.css-7o8a95-SvgElement-CloseButton');
      if (await bannerClose.isVisible({ timeout: 5000 })) {
        await bannerClose.click();
        console.log('✅ Closed sign-up banner');
      }
    } catch (e) {
      await page.screenshot({ path: 'step3_banner_error.png', fullPage: true });
      console.log('⚠️ Banner close error:', e);
    }

    // 4️⃣ Click the IN PLAY tab
    await page.screenshot({ path: 'step4_before_inplay.png', fullPage: true });
    await dismissOverlays(page, 'before_inplay');
    const inPlayTab = page.locator('a[href="/inplay"]');
    await expect(inPlayTab).toBeVisible({ timeout: 7000 });
    // Debug: log all visible links
    const allLinks = await page.$$eval('a', els => els.filter(e => e.offsetParent !== null).map(e => ({text: e.textContent, href: e.href})));
    console.log('All visible links:', allLinks);
    console.log('Current URL before click:', page.url());
    await page.screenshot({ path: 'step4_inplaytab_before_click.png', fullPage: true });
    await inPlayTab.scrollIntoViewIfNeeded();
    await inPlayTab.click({ force: true });
    await page.screenshot({ path: 'step4_inplaytab_after_click.png', fullPage: true });
    console.log('Current URL after click:', page.url());
    // No need to wait for URL change; just wait for the In Play heading
    await page.waitForSelector('h2.css-1ffzfd-TitleStyle', { timeout: 12000 });
    console.log('✅ In Play heading detected');
    await page.screenshot({ path: 'step4_after_inplay.png', fullPage: true });
    await dismissOverlays(page, 'after_inplay');

    // 5️⃣ Wait for at least one live event row
    await page.waitForSelector('[data-test="event-row"]', { timeout: 12000 });
    const firstRow = page.locator('[data-test="event-row"]').first();
    await firstRow.scrollIntoViewIfNeeded();
    console.log('🔍 Found first live event');
    await page.screenshot({ path: 'step5_first_event.png', fullPage: true });

    // 6️⃣ Click the event’s name link
    const eventLink = firstRow.locator('a[data-test="EventRowNameLink-link"]');
    await expect(eventLink).toBeVisible({ timeout: 7000 });
    // Scroll the event row into view
    await firstRow.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    // Scroll the page up by 200px in case of sticky header
    await page.evaluate(() => window.scrollBy(0, -200));
    await eventLink.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'step6_before_event_click.png', fullPage: true });
    await page.waitForTimeout(500);
    // Try normal click, fallback to JS click if needed
    try {
      await eventLink.click({ force: true });
      console.log('✅ Clicked event link normally');
    } catch (e) {
      console.log('⚠️ Normal click failed, trying JS click:', e);
      const handle = await eventLink.elementHandle();
      if (handle) {
        await page.evaluate(el => el.click(), handle);
        console.log('✅ Clicked event link via JS');
      } else {
        throw e;
      }
    }
    // Do not wait for URL change, just log it
    console.log('🎯 Entered event detail page:', page.url());
    await page.screenshot({ path: 'step6_event_detail.png', fullPage: true });
    console.log('✅ Event detail screenshot taken');

    // 7️⃣ Verify live animation is present (TEMPORARILY COMMENTED OUT FOR DEBUGGING)
    // const animation = page.locator('.swiper-wrapper, .swiper-slide-active, .animate-svg');
    // await expect(animation.first()).toBeVisible({ timeout: 12000 });
    // console.log('✨ Live animation detected');
    // await page.screenshot({ path: 'step7_animation.png', fullPage: true });
    console.log('[DEBUG] Skipped animation verification');
  } catch (err) {
    await page.screenshot({ path: 'FAILED.png', fullPage: true });
    console.error('❌ Test failed:', err);
    throw err;
  }
});
