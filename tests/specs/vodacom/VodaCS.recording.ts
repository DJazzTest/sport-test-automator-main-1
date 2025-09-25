import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://vodacomsoccer.com/');
  await page.getByRole('button', { name: 'Accept all Cookies' }).click();
  await page.getByRole('button', { name: 'Agree and proceed' }).click();
  await page.getByRole('link', { name: 'Match Centre' }).click();
  await page.getByRole('link', { name: 'Millwall Millwall 0 - 0' }).click();
  await page.getByRole('tabpanel', { name: 'Live' }).locator('iframe').contentFrame().locator('.swiper-slide').first().click();
});