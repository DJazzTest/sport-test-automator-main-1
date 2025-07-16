import { Page } from '@playwright/test';

// Dismiss cookie/consent overlays if present
export async function dismissOverlays(page: Page) {
  const consentSelectors = [
    '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
    'button:has-text("Accept All")',
    'button:has-text("Allow All")',
    'button:has-text("ACCEPT ALL")',
    'button:has-text("ALLOW ALL")',
    '.cookie-banner button',
  ];
  for (const sel of consentSelectors) {
    const btn = await page.$(sel);
    if (btn && await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  }
  // Example: close overlay/banner by class or close icon
  const closeSelectors = [
    '.css-7o8a95-SvgElement-CloseButton',
    '.overlay-close',
    '.modal-close',
    '.close',
  ];
  for (const sel of closeSelectors) {
    const btn = await page.$(sel);
    if (btn && await btn.isVisible()) {
      await btn.click();
      await page.waitForTimeout(500);
    }
  }
}

// Robust navigation to IN PLAY page, using multiple selectors and visibility checks
export async function goToInPlay(page: Page) {
  const start = Date.now();
  console.log(`[goToInPlay] Started at: ${new Date(start).toISOString()}`);
  // Use a robust, case-insensitive locator for 'In Play' in a, button, div, or span
  const inPlay = page.locator('a, button, div, span', { hasText: /in[\s-]?play/i });
  const count = await inPlay.count();
  console.log(`[goToInPlay] Found ${count} matching elements for 'In Play'`);
  if (count === 0) {
    await page.screenshot({ path: 'test-results/inplay-not-found.png', fullPage: true });
    // Debug: log all clickable texts for a, button, div, span
    const clickableTexts = await page.$$eval('a,button,div,span', els => els.map(e => e.textContent?.trim()).filter(Boolean));
    console.log('[goToInPlay] All clickable texts:', clickableTexts);
    throw new Error('Could not find any "In Play" navigation element.');
  }
  console.log(`[goToInPlay] Attempting to click first 'In Play' element...`);
  await Promise.all([
    page.waitForURL(/inplay/i, { timeout: 15000 }),
    inPlay.first().click()
  ]);
  const end = Date.now();
  console.log(`[goToInPlay] Navigation to 'In Play' complete at: ${new Date(end).toISOString()} (duration: ${(end - start) / 1000}s)`);
}



export async function clickFirstEvent(page: Page) {
  const eventLinks = await page.$$('a[href^="/event/"]');
  if (eventLinks.length > 0) {
    await eventLinks[0].click();
    await page.waitForURL(/\/event\/\d+/);
    return true;
  }
  return false;
}

export async function hasAnimation(page: Page) {
  const animation = await page.$('.swiper-slide.match-information.swiper-slide-prev');
  return !!animation;
}
