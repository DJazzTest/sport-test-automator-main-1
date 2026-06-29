import { test, expect, Page } from '@playwright/test';

async function acceptConsent(page: Page): Promise<void> {
  try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 2500 }); } catch {}
  try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
}

async function detectTennisAnimation(page: Page): Promise<boolean> {
  const container = page.locator('#the-tennis-sport-widget');
  try { await container.scrollIntoViewIfNeeded(); } catch {}
  try {
    await container.waitFor({ state: 'visible', timeout: 2_000 });
    const iframe = container.locator('iframe');
    await iframe.waitFor({ state: 'visible', timeout: 2_000 });
    const src = await iframe.getAttribute('src').catch(() => null);
    if (src && /widgets\.thesports01\.com/i.test(src)) return true;
  } catch {}
  return false;
}

test('DragonSport – Tennis Animation Check', async ({ page }) => {
  test.setTimeout(8 * 60_000);

  await page.goto('https://dragonbet.co.uk/', { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);

  console.log('🎾 Navigating to Tennis...');
  const tennisNav = page.locator('a[href="/sport/tennis"], a[href*="/sport/tennis"]').first();
  if (await tennisNav.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tennisNav.click();
  } else {
    await page.getByRole('link', { name: /^Tennis$/ }).click();
  }
  await page.waitForTimeout(500);

  let pass = 0, fail = 0; const results: string[] = [];

  const testTab = async (tab: string) => {
    console.log(`\n🔍 Testing Tennis – ${tab}`);
    await page.getByRole('button', { name: tab }).click();
    await page.waitForTimeout(300);

    const eventLinks = page.locator('[data-test="EventRowNameLink-link"]');
    const total = await eventLinks.count();
    if (!total) { console.log('ℹ️ No Tennis events found'); return; }
    const maxToTest = Math.min(total, 10);

    for (let i = 0; i < maxToTest; i++) {
      const link = eventLinks.nth(i);
      const title = (await link.innerText()).trim();
      
      await link.click();
      await page.waitForTimeout(300);

      try { await page.getByRole('heading', { name: /Live tracker/i }).click({ timeout: 1000 }); } catch {}
      const hasAnim = await detectTennisAnimation(page);
      if (hasAnim) { pass++; results.push(`PASS: ${title}`); } else { fail++; results.push(`FAIL: ${title}`); }
      
      // Click Tennis link to go back
      if (!page.isClosed()) {
        if (await tennisNav.isVisible({ timeout: 1500 }).catch(() => false)) {
          await tennisNav.click().catch(() => {});
        } else {
          await page.getByRole('link', { name: /^Tennis$/ }).click().catch(() => {});
        }
        await page.waitForTimeout(300);
        await page.getByRole('button', { name: tab }).click().catch(() => {});
        await page.waitForTimeout(200);
      }
    }
  };

  await testTab('Today');
  await testTab('Tomorrow');

  console.log(`\n🧪 TENNIS RESULTS — PASS: ${pass} | FAIL: ${fail}`);
  results.forEach(r => console.log(r));
});











