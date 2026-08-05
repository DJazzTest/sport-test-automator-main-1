import { test, expect, Page } from '@playwright/test';
import { ANIMATION_EVENTS_PER_SPORT, pickRandomIndices } from '../../lib/animation-sample';
import {
  appendAnimationEmailFailures,
  formatAnimationFailLine,
  missingAnimationsAssertMessage,
} from '../../Utils/animationEmailReport';

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

test('DragonBet Tennis Animation/tests/specs/dragonbet/DragonSportbet.Tennis.animations.spec.ts', async ({ page }) => {
  test.setTimeout(8 * 60_000);

  await page.goto('https://dragonbet.co.uk/', { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);

  console.log('🎾 Navigating to Tennis...');
  const tennisNav = page.locator('a[href="/sport/tennis"], a[href*="/sport/tennis"]').first();
  if (await tennisNav.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tennisNav.click();
  } else if (await page.getByRole('link', { name: /^Tennis$/i }).first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('link', { name: /^Tennis$/i }).first().click();
  } else {
    await page.goto('https://dragonbet.co.uk/sport/tennis', { waitUntil: 'domcontentloaded' });
  }
  await acceptConsent(page);
  await page.waitForTimeout(500);

  if (!(page.url().includes('tennis') || await page.getByRole('link', { name: /Tennis/i }).first().isVisible().catch(() => false))) {
    test.skip(true, 'Tennis sport not available on DragonBet right now');
  }

  let pass = 0, fail = 0; const results: string[] = [];

  const testTab = async (tab: string) => {
    console.log(`\n🔍 Testing Tennis – ${tab}`);
    const tabBtn = page.getByRole('button', { name: new RegExp(`^${tab}$`, 'i') }).first();
    if (!(await tabBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`ℹ️ Tennis tab "${tab}" not available — skipping`);
      return;
    }
    await tabBtn.click({ timeout: 10_000 });
    await page.waitForTimeout(300);

    const remaining = ANIMATION_EVENTS_PER_SPORT - (pass + fail);
    if (remaining <= 0) return;

    const eventLinks = page.locator('[data-test="EventRowNameLink-link"]');
    const total = await eventLinks.count();
    if (!total) { console.log('ℹ️ No Tennis events found'); return; }
    const indices = pickRandomIndices(total, remaining);
    console.log(`🎲 Sampling ${indices.length} of ${total} tennis events on ${tab}: [${indices.join(', ')}]`);

    for (const i of indices) {
      const link = eventLinks.nth(i);
      const title = (await link.innerText()).trim();
      
      await link.click();
      await page.waitForTimeout(300);

      try { await page.getByRole('heading', { name: /Live tracker/i }).click({ timeout: 1000 }); } catch {}
      const hasAnim = await detectTennisAnimation(page);
      const eventUrl = page.url();
      if (hasAnim) {
        pass++;
        results.push(`PASS: ${title}`);
      } else {
        const failLine = formatAnimationFailLine({
          site: 'DragonBet',
          sport: 'Tennis',
          title,
          url: eventUrl,
          tab,
        });
        console.log(`❌ ${failLine}`);
        fail++;
        results.push(failLine);
      }
      
      // Click Tennis link to go back
      if (!page.isClosed()) {
        if (await tennisNav.isVisible({ timeout: 1500 }).catch(() => false)) {
          await tennisNav.click().catch(() => {});
        } else {
          await page.getByRole('link', { name: /^Tennis$/i }).click().catch(() => {});
        }
        await page.waitForTimeout(300);
        await tabBtn.click().catch(() => {});
        await page.waitForTimeout(200);
      }
    }
  };

  await testTab('Today');
  if ((pass + fail) < ANIMATION_EVENTS_PER_SPORT) {
    await testTab('Tomorrow');
  }

  console.log(`\n🧪 TENNIS RESULTS — PASS: ${pass} | FAIL: ${fail}`);
  results.forEach(r => console.log(r));

  const failLines = results.filter((r) => r.includes('| FAIL:') || r.startsWith('FAIL:'));
  appendAnimationEmailFailures('DragonBet', failLines);

  expect(pass + fail, 'Should test at least one tennis event').toBeGreaterThan(0);
  expect(fail, missingAnimationsAssertMessage(failLines)).toBe(0);
});











