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

async function detectFootballAnimation(page: Page): Promise<boolean> {
  // Primary: explicit animated_widget class under Live tracker
  const explicit = page.locator('.animated_widget iframe');
  try {
    await explicit.scrollIntoViewIfNeeded();
    await explicit.waitFor({ state: 'visible', timeout: 3_000 });
    const start = Date.now();
    while (Date.now() - start < 4_000) {
      const src = await explicit.getAttribute('src').catch(() => null);
      const vis = await explicit.isVisible().catch(() => false);
      if (src && /widgets\.thesports01\.com/i.test(src) && vis) return true;
      await page.waitForTimeout(250);
    }
  } catch {}

  // Fallback: common widget ids
  const candidates = ['#the-football-sport-widget', '#the-soccer-sport-widget'];
  for (const selector of candidates) {
    const container = page.locator(`${selector} iframe, ${selector} .animated_widget iframe`);
    try { await container.first().scrollIntoViewIfNeeded(); } catch {}
    try {
      await container.first().waitFor({ state: 'visible', timeout: 3_000 });
      const start = Date.now();
      while (Date.now() - start < 4_000) {
        const src = await container.first().getAttribute('src').catch(() => null);
        const vis = await container.first().isVisible().catch(() => false);
        if (src && /widgets\.thesports01\.com/i.test(src) && vis) return true;
        await page.waitForTimeout(250);
      }
    } catch {}
  }
  return false;
}

test('DragonBet Football Animation/tests/specs/dragonbet/DragonSportbet.Football.animations.spec.ts', async ({ page, context }) => {
  test.setTimeout(5 * 60_000);

  await page.goto('https://dragonbet.co.uk/', { waitUntil: 'domcontentloaded' });
  // Match the requested consent step precisely
  try { await page.getByRole('button', { name: 'Allow all' }).click({ timeout: 3000 }); } catch {}
  await acceptConsent(page);

  // Navigate to Football (left-hand link or search)
  console.log('⚽ Navigating to Football...');
  const goToFootball = async () => {
    try {
      await page.getByRole('link', { name: 'Football' }).first().click({ timeout: 4000 });
    } catch {
      // Fallback: direct URL if present (best effort)
      try { await page.goto('https://dragonbet.co.uk/sport/football', { waitUntil: 'domcontentloaded' }); } catch {}
    }
    await page.waitForTimeout(1500);
  };
  await goToFootball();

  // Land on All, then explicitly click Today per requested flow
  try {
    await page.getByRole('button', { name: 'All' }).first().click({ timeout: 1500 });
    await page.waitForTimeout(400);
  } catch {}
  try {
    await page.getByRole('button', { name: 'Today' }).click({ timeout: 2000 });
    await page.waitForTimeout(600);
  } catch {}

  let pass = 0, fail = 0;
  const results: string[] = [];

  const testCurrentList = async (label: string, maxToTest = ANIMATION_EVENTS_PER_SPORT) => {
    console.log(`\n🔍 Testing Football – ${label}`);
    const remaining = maxToTest - (pass + fail);
    if (remaining <= 0) return;
    const eventLinks = page.locator('[data-test="EventRowNameLink-link"], a[href*="/event/"]');
    const total = await eventLinks.count().catch(() => 0);
    if (!total) { console.log('ℹ️ No Football events found'); return; }
    const indices = pickRandomIndices(total, remaining);
    console.log(`🎲 Sampling ${indices.length} of ${total} football events on ${label}: [${indices.join(', ')}]`);
    for (const i of indices) {
      const link = eventLinks.nth(i);
      const title = (await link.innerText().catch(() => `Event ${i+1}`)).trim();
      const href = await link.getAttribute('href').catch(() => null);
      if (!href) {
        const failLine = formatAnimationFailLine({
          site: 'DragonBet',
          sport: 'Football',
          title,
          url: page.url(),
        });
        console.log(`❌ ${failLine}`);
        results.push(failLine);
        fail++;
        continue;
      }

      const detail = await context.newPage();
      try {
        await detail.goto(new URL(href, page.url()).toString(), { waitUntil: 'domcontentloaded', timeout: 15_000 });
        await acceptConsent(detail);
        await detail.waitForTimeout(400);
      } catch (error) {
        console.log(`❌ Error opening event page: ${error.message}`);
        console.log(`   📋 Steps to recreate:`);
        console.log(`      1. Navigate to the event listing page`);
        console.log(`      2. Click on an event to open the detail page`);
        console.log(`      3. Expected: Event detail page should load successfully`);
        console.log(`      4. Actual: Error - ${error.message}`);
        await detail.close().catch(() => {});
        const failLine = formatAnimationFailLine({
          site: 'DragonBet',
          sport: 'Football',
          title: `${title} - Navigation error`,
          url: new URL(href, page.url()).toString(),
        });
        console.log(`❌ ${failLine}`);
        results.push(failLine);
        fail++;
        continue;
      }

      // Click Live tracker like the provided steps
      try {
        const liveTracker = detail.getByRole('heading', { name: 'Live tracker' }).first();
        if (await liveTracker.isVisible({ timeout: 1500 }).catch(() => false)) {
          await liveTracker.click({ timeout: 2000 });
          await detail.waitForTimeout(400);
        }
      } catch {}
      const hasAnim = await detectFootballAnimation(detail);
      if (!hasAnim) {
        // Optional: try swiper click inside widget iframe as in provided steps
        try {
          const frame = await detail.locator('#the-football-sport-widget iframe').elementHandle({ timeout: 2000 });
          if (frame) {
            const f = await frame.contentFrame();
            await f?.locator('.swiper-slide').first().click({ timeout: 1500 });
          }
        } catch {}
      }
      const finalAnim = hasAnim || await detectFootballAnimation(detail);
      const eventUrl = detail.url();
      if (finalAnim) {
        pass++;
        results.push(`PASS: ${title}`);
      } else {
        const failLine = formatAnimationFailLine({
          site: 'DragonBet',
          sport: 'Football',
          title,
          url: eventUrl,
        });
        console.log(`❌ ${failLine}`);
        fail++;
        results.push(failLine);
      }

      try {
        await detail.close();
        await page.bringToFront();
        await page.waitForTimeout(200);
      } catch (error) {
        console.log(`❌ Error closing detail page: ${error.message}`);
        console.log(`   📋 Steps to recreate:`);
        console.log(`      1. Open an event detail page`);
        console.log(`      2. Try to close or navigate away from the detail page`);
        console.log(`      3. Expected: Page should close or navigate successfully`);
        console.log(`      4. Actual: Error - ${error.message}`);
        // Ensure main page is still alive
        try {
          await page.goto('https://dragonbet.co.uk/', { waitUntil: 'domcontentloaded' });
          await acceptConsent(page);
          await page.getByRole('link', { name: 'Football' }).click();
          await page.waitForTimeout(1000);
        } catch {}
      }
    }
  };

  // First test Today list (up to 2 random events total across tabs)
  await testCurrentList('Today');

  // Only continue to Tomorrow if we still need samples
  if ((pass + fail) < ANIMATION_EVENTS_PER_SPORT) {
    try { await page.getByRole('link', { name: 'Football' }).click({ timeout: 2000 }); } catch {}
    try { await page.getByRole('button', { name: 'Tomorrow' }).click({ timeout: 2000 }); } catch {}
    await page.waitForTimeout(600);
    await testCurrentList('Tomorrow');
  }

  console.log(`\n🧪 FOOTBALL RESULTS — PASS: ${pass} | FAIL: ${fail}`);
  results.forEach(r => console.log(r));

  const failLines = results.filter((r) => r.includes('| FAIL:') || r.startsWith('FAIL:'));
  appendAnimationEmailFailures('DragonBet', failLines);

  expect(pass + fail, 'Should test at least one football event').toBeGreaterThan(0);
  expect(fail, missingAnimationsAssertMessage(failLines)).toBe(0);
});


