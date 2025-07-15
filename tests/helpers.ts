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
  const inPlaySelectors = [
    '[data-test="header-link-inplay"]',
    'a[href="/inplay"]',
    'header a[href="/inplay"]',
    'text=/IN PLAY/i',
    'text=/In[- ]?Play/i',
    'a:has-text("IN PLAY")',
    'a:has-text("In-Play")',
    'a:has-text("In Play")',
    'a:has-text("InPlay")', // NEW fallback
    'button:has-text("IN PLAY")', // NEW fallback
  ];
  let found = false;
  for (const selector of inPlaySelectors) {
    const link = page.locator(selector);
    try {
      await link.waitFor({ state: 'visible', timeout: 7000 });
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await page.waitForURL('**/inplay', { timeout: 10000 });
      found = true;
      break;
    } catch (e) {
      console.log(`Selector failed: ${selector}`, e); // NEW robust logging
    }
  }
  // NEW fallback: try to click any link with "In Play"
  if (!found) {
    const links = await page.$$('a');
    for (const l of links) {
      const text = await l.innerText();
      if (/in\s*-?\s*play/i.test(text)) {
        await l.click();
        await page.waitForURL('**/inplay', { timeout: 10000 });
        found = true;
        break;
      }
    }
  }
  if (!found) {
    await page.screenshot({ path: 'test-results/inplay-not-found.png', fullPage: true });
    throw new Error('Could not find or click IN PLAY link.');
  }
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
