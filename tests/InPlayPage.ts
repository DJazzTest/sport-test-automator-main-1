import { Page } from '@playwright/test';

export class InPlayPage {
  constructor(private page: Page) {}

  async gotoHome() {
    await this.page.goto('https://planetsportbet.com/');
    await this.dismissPopups();
  }

  async dismissPopups() {
    // Wait before checking popups
    await this.page.waitForTimeout(2000);
    // Click 'Allow all' consent button if visible
    const allowAllBtn = this.page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
    if (await allowAllBtn.isVisible()) {
      console.log('🔔 "Allow all" consent button is visible, attempting to click...');
      await allowAllBtn.click();
      console.log('✅ "Allow all" consent button clicked');
      await this.page.waitForTimeout(2000);
    } else {
      console.log('❌ "Allow all" consent button not visible');
    }
    // Dismiss Cookiebot "Customize" button if visible
    const cookieBtn = this.page.locator('#CybotCookiebotDialogBodyLevelButtonCustomize');
    if (await cookieBtn.isVisible()) {
      console.log('🔔 Cookiebot popup is visible, attempting to click...');
      await cookieBtn.click();
      console.log('✅ Cookiebot popup dismissed');
      await this.page.waitForTimeout(2000);
    } else {
      console.log('❌ Cookiebot popup not visible');
    }

    // Dismiss modal close (SVG path inside a clickable element)
    const closeBtn = this.page.locator('svg path[d*="M22.5"]'); // match part of the path data
    if (await closeBtn.count()) {
      // Click the parent element (likely <svg> or <button>)
      const svgParent = closeBtn.first().locator('xpath=ancestor::*[self::button or self::svg]');
      if (await svgParent.isVisible()) {
        console.log('🔔 Modal or overlay is visible, attempting to click...');
        await svgParent.click();
        console.log('✅ Modal or overlay dismissed');
        await this.page.waitForTimeout(2000);
      } else {
        console.log('❌ Modal or overlay not visible');
      }
    } else {
      console.log('❌ No modal close button found');
    }
  }

  async isInPlayPage(): Promise<boolean> {
    // Wait up to 20s for the In play section to appear
    await this.page.waitForTimeout(2000); // Give the page a moment to load
    for (let i = 0; i < 10; i++) {
      const headings = await this.page.$$eval('h2[data-test="section-title"]', els => els.map(e => e.textContent?.trim() || ''));
      console.log(`[isInPlayPage] Attempt ${i+1}: Section titles found:`, headings);
      if (headings.some(text => text.toLowerCase() === 'in play')) {
        return true;
      }
      await this.page.waitForTimeout(2000); // Wait 2s before retry
    }
    // Take a screenshot for debugging
    await this.page.screenshot({ path: 'inplaypage_not_found.png', fullPage: true });
    return false;
  }

  async clickFirstInPlayEvent() {
    // Wait for at least one live In Play event to appear
    const eventLocator = this.page.locator('.css-dtxm66-EventStatus');
    await eventLocator.first().waitFor({ state: 'visible', timeout: 10000 });
    const count = await eventLocator.count();
    if (count > 0) {
      // Scroll the element into view using Playwright API
      await eventLocator.first().scrollIntoViewIfNeeded();
      // Log bounding box and visibility
      const box = await eventLocator.first().boundingBox();
      const visible = await eventLocator.first().isVisible();
      const enabled = await eventLocator.first().isEnabled();
      console.log('🔍 Bounding box:', box);
      console.log('👁️ Visible:', visible, '🟢 Enabled:', enabled);
      // Take a screenshot before clicking for debugging
      await this.page.screenshot({ path: 'before_click_event.png', fullPage: true });
      console.log('🖼️ Screenshot taken before clicking first In Play event');
      // Try clicking with force option
      await eventLocator.first().click({ force: true });
      return true;
    }
    return false;
  }

  async isOnEventDetailPage(): Promise<boolean> {
    return await this.page.url().includes('/event/');
  }
}

