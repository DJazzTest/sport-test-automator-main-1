import { Page } from '@playwright/test';

export async function goToInPlay(page: Page) {
  await page.goto('https://planetsportbet.com/inplay');
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
