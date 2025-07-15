import { test, expect } from '@playwright/test';

test('Visualize: In Play event and animation', async ({ page }) => {
  // 1. Go to home page
  await page.goto('https://planetsportbet.com/');

  // 2. Handle consent popup if visible
  const allowAllBtn = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
  if (await allowAllBtn.isVisible()) {
    await allowAllBtn.click();
    await page.waitForTimeout(1000);
  }

  // 3. Click "IN PLAY" in the header
  const inPlayHeader = page.locator('header a[href="/inplay"]');
  await expect(inPlayHeader).toBeVisible();
  await inPlayHeader.click();
  await expect(page).toHaveURL('https://planetsportbet.com/inplay');

  // 4. Click any live event link
  const eventLinks = page.locator('a[href^="/event/"]');
  await expect(eventLinks.first()).toBeVisible({ timeout: 10000 });
  await eventLinks.first().click();
  await expect(page).toHaveURL(/\/event\/\d+/);

  // 5. Check for animation class on the event page
  const animation = page.locator('.serve-ball-box.home.position-one');
  await expect(animation).toBeVisible({ timeout: 10000 });
});
