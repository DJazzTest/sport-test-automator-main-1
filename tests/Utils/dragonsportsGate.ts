import type { Page } from '@playwright/test';

/**
 * Dismiss DragonSports overlays in order: 18+ age gate, then cookie/consent.
 * Call after each navigation to dragonsports.co.uk or live.dragonsports.co.uk.
 */
export async function dismissDragonSportsPopups(page: Page): Promise<void> {
  await page.waitForTimeout(500);

  const ageBtn = page.getByRole('button', { name: /Yes,?\s*I\s*am(\s*18\+)?/i }).first();
  if (await ageBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
    await ageBtn.click({ timeout: 8000 }).catch(() => {});
    console.log('✅ Dismissed 18+ age gate (Yes, I am 18+)');
    await page.waitForTimeout(800);
  } else {
    const ageLink = page.locator('a, button').filter({ hasText: /Yes,?\s*I\s*am(\s*18\+)?/i }).first();
    if (await ageLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ageLink.click({ timeout: 8000 }).catch(() => {});
      console.log('✅ Dismissed 18+ age gate (Yes, I am)');
      await page.waitForTimeout(800);
    }
  }

  const uniccmp = page.locator('#uniccmp');
  if (await uniccmp.count().catch(() => 0)) {
    const agree = uniccmp
      .getByRole('button', { name: /Agree and proceed|Allow all|Accept all/i })
      .first();
    if (await agree.isVisible({ timeout: 5000 }).catch(() => false)) {
      await agree.click({ timeout: 8000 }).catch(() => {});
      await uniccmp.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
      console.log('✅ Dismissed UniConsent (Agree and proceed)');
    }
  }

  const cookieFallback = page
    .getByRole('button', { name: /Agree and proceed|Accept|Allow all|I agree/i })
    .first();
  if (await cookieFallback.isVisible({ timeout: 1500 }).catch(() => false)) {
    await cookieFallback.click({ timeout: 5000 }).catch(() => {});
  }
}
