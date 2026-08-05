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

async function detectCricketAnimation(page: Page): Promise<boolean> {
  const container = page.locator('#the-cricket-sport-widget');
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

test('DragonBet Cricket Animation/tests/specs/dragonbet/DragonSportbet.Cricket.animations.spec.ts', async ({ page }) => {
  test.setTimeout(8 * 60_000);

  await page.goto('https://dragonbet.co.uk/', { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);

  console.log('🏏 Navigating to Cricket...');
  const cricketNav = page.locator('a[href="/sport/cricket"], a[href*="/sport/cricket"]').first();
  if (await cricketNav.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cricketNav.click();
  } else if (await page.getByRole('link', { name: /^Cricket$/i }).first().isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.getByRole('link', { name: /^Cricket$/i }).first().click();
  } else {
    await page.goto('https://dragonbet.co.uk/sport/cricket', { waitUntil: 'domcontentloaded' });
  }
  await acceptConsent(page);
  await page.waitForTimeout(500);

  if (!(page.url().includes('cricket') || await page.getByRole('link', { name: /Cricket/i }).first().isVisible().catch(() => false))) {
    test.skip(true, 'Cricket sport not available on DragonBet right now');
  }

  let pass = 0, fail = 0; const results: string[] = [];

  const testTab = async (tab: string) => {
    console.log(`\n🔍 Testing Cricket – ${tab}`);
    const tabBtn = page.getByRole('button', { name: new RegExp(`^${tab}$`, 'i') }).first();
    if (!(await tabBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`ℹ️ Cricket tab "${tab}" not available — skipping`);
      return;
    }
    await tabBtn.click({ timeout: 10_000 });
    await page.waitForTimeout(300);

    const remaining = ANIMATION_EVENTS_PER_SPORT - (pass + fail);
    if (remaining <= 0) return;

    const eventLinks = page.getByRole('link').filter({ hasText: / vs | v /i });
    const total = await eventLinks.count();
    if (!total) { console.log('ℹ️ No Cricket events found'); return; }
    const indices = pickRandomIndices(total, remaining);
    console.log(`🎲 Sampling ${indices.length} of ${total} cricket events on ${tab}: [${indices.join(', ')}]`);

    for (const i of indices) {
      const link = eventLinks.nth(i);
      const title = (await link.innerText()).trim();
      
      await link.click();
      await page.waitForTimeout(300);

      try { await page.getByRole('heading', { name: /Live tracker/i }).click({ timeout: 1000 }); } catch {}
      const hasAnim = await detectCricketAnimation(page);
      const eventUrl = page.url();
      if (hasAnim) {
        pass++;
        results.push(`PASS: ${title}`);
      } else {
        const failLine = formatAnimationFailLine({
          site: 'DragonBet',
          sport: 'Cricket',
          title,
          url: eventUrl,
          tab,
        });
        console.log(`❌ ${failLine}`);
        fail++;
        results.push(failLine);
      }
      
      // Click Cricket link to go back
      if (!page.isClosed()) {
        await page.getByRole('link', { name: 'Cricket' }).click().catch(() => {});
        await page.waitForTimeout(300);
        await page.getByRole('button', { name: tab }).click().catch(() => {});
        await page.waitForTimeout(200);
      }
    }
  };

  // Test Today first
  await testTab('Today');
  
  // Test Tomorrow if we still need samples
  if ((pass + fail) < ANIMATION_EVENTS_PER_SPORT) {
    await testTab('Tomorrow');
  }
  
  // If still under the sample size, also test All tab
  if ((pass + fail) < ANIMATION_EVENTS_PER_SPORT) {
    await testTab('All');
  }

  console.log(`\n🧪 CRICKET RESULTS — PASS: ${pass} | FAIL: ${fail}`);
  results.forEach(r => console.log(r));

  const failLines = results.filter((r) => r.includes('| FAIL:') || r.startsWith('FAIL:'));
  appendAnimationEmailFailures('DragonBet', failLines);

  expect(pass + fail, 'Should test at least one cricket event').toBeGreaterThan(0);
  expect(fail, missingAnimationsAssertMessage(failLines)).toBe(0);
});











