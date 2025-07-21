import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://planetsportbet.com/');
  await page.getByRole('button', { name: 'Allow all' }).click();
  await page.locator('[data-test="landing-page"] [data-test="close-icon"]').click();
  await page.locator('[data-test="inplay-link"]').click();
  await page.getByRole('button', { name: 'Football' }).click();
});