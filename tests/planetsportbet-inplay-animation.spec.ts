 

test('PlanetSportBet – In Play animation check', async ({ page }) => {
  // 1️⃣ Go to homepage
  await page.goto('https://planetsportbet.com/');

  // 2️⃣ Accept cookies / pop-ups (handles “Allow All”, “Accept” or Cookiebot)
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

  // 3️⃣ Dismiss any sign-up overlay (close icon)
  const bannerClose = page.locator('.css-7o8a95-SvgElement-CloseButton');
  if (await bannerClose.isVisible({ timeout: 5000 })) {
    await bannerClose.click();
    console.log('✅ Closed sign-up banner');
  }

  // 4️⃣ Click the IN PLAY tab
  // DEBUG: Screenshot and overlay state before clicking IN PLAY
  await page.screenshot({ path: 'before_inplay_click.png', fullPage: true });
  const overlayCount = await page.locator('.css-1u3p516-LPOverlay').count();
  console.log('Overlay count:', overlayCount);
  if (overlayCount > 0) {
    const overlayHtml = await page.locator('.css-1u3p516-LPOverlay').first().evaluate(el => el.outerHTML);
    console.log('Overlay HTML:', overlayHtml);
    const overlayBox = await page.locator('.css-1u3p516-LPOverlay').first().boundingBox();
    console.log('Overlay bounding box:', overlayBox);
  }
  // Try to remove overlay repeatedly
  for (let i = 0; i < 5; i++) {
    if (await page.locator('.css-1u3p516-LPOverlay').isVisible({ timeout: 1000 })) {
      await page.evaluate(() => {
        const overlay = document.querySelector('.css-1u3p516-LPOverlay');
        if (overlay) overlay.remove();
      });
      await page.waitForTimeout(500);
    }
  }
  const inPlayTab = page.locator('a[href="/inplay"]');
  await expect(inPlayTab).toBeVisible({ timeout: 5000 });
  await inPlayTab.click({ force: true });
  await page.waitForURL('**/inplay');
  console.log('🔗 Navigated to /inplay');

  // Wait for the In Play page heading to appear
  await page.waitForSelector('h2.css-1ffzfd-TitleStyle', { timeout: 10000 });
  console.log('✅ In Play heading detected');

  // After In Play heading: check/remove overlays again and debug
  await page.screenshot({ path: 'after_inplay_heading.png', fullPage: true });
  let overlayCountAfter = await page.locator('.css-1u3p516-LPOverlay').count();
  console.log('Overlay count after IN PLAY:', overlayCountAfter);
  if (overlayCountAfter > 0) {
    const overlayHtml = await page.locator('.css-1u3p516-LPOverlay').first().evaluate(el => el.outerHTML);
    console.log('Overlay HTML after IN PLAY:', overlayHtml);
    const overlayBox = await page.locator('.css-1u3p516-LPOverlay').first().boundingBox();
    console.log('Overlay bounding box after IN PLAY:', overlayBox);
    // Try to remove overlay repeatedly
    for (let i = 0; i < 5; i++) {
      if (await page.locator('.css-1u3p516-LPOverlay').isVisible({ timeout: 1000 })) {
        await page.evaluate(() => {
          const overlay = document.querySelector('.css-1u3p516-LPOverlay');
          if (overlay) overlay.remove();
        });
        await page.waitForTimeout(500);
      }
    }
    overlayCountAfter = await page.locator('.css-1u3p516-LPOverlay').count();
    console.log('Overlay count after attempted removal:', overlayCountAfter);
  }

  // 5️⃣ Wait for at least one live event row
  await page.waitForSelector('[data-test="event-row"]', { timeout: 10000 });
  const firstRow = page.locator('[data-test="event-row"]').first();
  await firstRow.scrollIntoViewIfNeeded();
  console.log('🔍 Found first live event');

  // 6️⃣ Click the event’s name link
  const eventLink = firstRow.locator('a[data-test="EventRowNameLink-link"]');
  await expect(eventLink).toBeVisible();
  await eventLink.click({ force: true });
  await page.waitForURL(/\/event\/\d+/);
  console.log('🎯 Entered event detail page:', page.url());

  // 7️⃣ Verify live animation is present
  // Looking for any active swiper slide or wrapper
  const animation = page.locator('.swiper-wrapper, .swiper-slide-active, .animate-svg');
  await expect(animation.first()).toBeVisible({ timeout: 10000 });
  console.log('✨ Live animation detected');
});
