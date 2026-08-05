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

/** Landing / account overlays intercept Tomorrow/All clicks on these sites. */
async function dismissOverlays(page: Page): Promise<void> {
  for (const sel of [
    '[data-test="landing-page"] [data-test="close-icon"]',
    '[data-test="notification-box"] [data-test="close-icon"]',
    'aside[data-component="AccountSidebar"] [data-test="close-icon"]',
  ]) {
    await page.locator(sel).first().click({ timeout: 1200 }).catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('[class*="LPOverlay"]').forEach((el) => {
      (el as HTMLElement).style.display = 'none';
      (el as HTMLElement).style.pointerEvents = 'none';
    });
  }).catch(() => {});
}

async function detectNflAnimation(page: Page): Promise<boolean> {
  const container = page.locator('div.animated_widget, #the-americanfootball-sport-widget');
  try {
    await container.first().scrollIntoViewIfNeeded().catch(() => {});
    const iframe = page.locator('div.animated_widget iframe, #the-americanfootball-sport-widget iframe').first();
    const iframeVis = await iframe.isVisible({ timeout: 2_500 }).catch(() => false);
    if (!iframeVis) return false;
    const src = await iframe.getAttribute('src').catch(() => null);
    if (src && /widgets.*thesports01\.com|thesports01\.com/i.test(src)) return true;
  } catch {}
  return false;
}

/** Prefer NFL Pre-Season section; fall back to US NFL. */
function nflSectionHeading(page: Page) {
  const preSeason = page.locator('h4[data-test="section-title"]').filter({ hasText: /NFL Pre-Season/i }).first();
  const usNfl = page.locator('h4[data-test="section-title"]').filter({ hasText: /^US NFL$/i }).first();
  const anyNfl = page.locator('h4[data-test="section-title"]').filter({ hasText: /NFL/i }).first();
  return { preSeason, usNfl, anyNfl };
}

async function openNflEvents(page: Page) {
  // Stay on All (or default) — Today/Tomorrow hide pre-season fixtures dated beyond those filters
  const allBtn = page.getByRole('button', { name: 'All', exact: true }).first();
  if (await allBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
    await allBtn.click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  }

  // Competition chip helps surface the section when present
  const chip = page.getByRole('button', { name: /US NFL Pre-Season|NFL Pre-Season/i }).first();
  if (await chip.isVisible({ timeout: 1500 }).catch(() => false)) {
    await chip.click({ force: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(800);
  }

  for (let s = 0; s < 6; s++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(300);

  const { preSeason, usNfl, anyNfl } = nflSectionHeading(page);
  let heading = preSeason;
  let sectionName = 'NFL Pre-Season';
  if (!(await heading.isVisible({ timeout: 2000 }).catch(() => false))) {
    heading = usNfl;
    sectionName = 'US NFL';
  }
  if (!(await heading.isVisible({ timeout: 1500 }).catch(() => false))) {
    heading = anyNfl;
    sectionName = 'NFL';
  }
  const visible = await heading.isVisible({ timeout: 2000 }).catch(() => false);
  if (!visible) {
    return { visible: false, sectionName: '', eventLinks: page.locator('a__none'), total: 0 };
  }

  sectionName = ((await heading.innerText().catch(() => sectionName)) || sectionName).trim();
  await heading.scrollIntoViewIfNeeded().catch(() => {});
  await heading.click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(400);
  await heading.click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(600);

  const section = heading.locator('xpath=ancestor::section[1]');
  let eventLinks = section.locator('a[href*="/event/"]');
  let total = await eventLinks.count().catch(() => 0);
  if (!total) {
    // Section markup varies — take event links following the heading until the next section title
    eventLinks = page.locator(
      `xpath=//h4[@data-test="section-title"][contains(normalize-space(.), "${sectionName.replace(/"/g, '')}")]//following::a[contains(@href,"/event/")][position()<=20]`
    );
    total = await eventLinks.count().catch(() => 0);
  }
  return { visible: true, sectionName, eventLinks, total, heading };
}

test('DragonBet American Football Animation/tests/specs/dragonbet/DragonSportbet.NFL.animations.spec.ts', async ({ page }) => {
  test.setTimeout(8 * 60_000);

  await page.goto('https://dragonbet.co.uk/', { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);
  await dismissOverlays(page);

  console.log('🏈 Navigating to American Football...');
  try {
    await page.getByRole('link', { name: 'American Football' }).first().click({ timeout: 4000 });
  } catch {
    await page.goto('https://dragonbet.co.uk/sport/americanfootball', { waitUntil: 'domcontentloaded' });
  }
  await page.waitForTimeout(1500);
  await dismissOverlays(page);

  const { visible, sectionName, eventLinks, total } = await openNflEvents(page);
  console.log(visible
    ? `✅ Found section "${sectionName}" with ${total} event link(s)`
    : '❌ No NFL / NFL Pre-Season section title found on All view');

  expect(visible, 'NFL Pre-Season / US NFL section title should be visible on American Football All view').toBeTruthy();
  expect(total, 'Should find at least one event under the NFL section').toBeGreaterThan(0);

  const indices = pickRandomIndices(total, ANIMATION_EVENTS_PER_SPORT);
  console.log(`🎲 Sampling ${indices.length} of ${total} events under "${sectionName}": [${indices.join(', ')}]`);

  let pass = 0, fail = 0;
  const results: string[] = [];

  for (const i of indices) {
    const opened = await openNflEvents(page);
    if (i >= opened.total) break;
    const link = opened.eventLinks.nth(i);
    const title = (await link.innerText().catch(() => `Event ${i + 1}`)).trim().replace(/\s+/g, ' ');
    console.log(`\n🎯 Testing: ${title}`);

    await link.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(600);

    const liveTrackerCollapse = page.locator('div[class*="CollapseLabel"]').filter({ hasText: /Live tracker/i }).first();
    if (await liveTrackerCollapse.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (!(await page.locator('div.animated_widget').isVisible({ timeout: 500 }).catch(() => false))) {
        await liveTrackerCollapse.click({ timeout: 1000 }).catch(() => {});
        await page.waitForTimeout(600);
      }
    } else {
      await page.getByRole('heading', { name: /Live tracker/i }).click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(600);
    }

    const hasAnim = await detectNflAnimation(page);
    const eventUrl = page.url();
    if (hasAnim) {
      console.log(`✅ PASS: animation detected — ${title}`);
      pass++;
      results.push(`PASS: ${title} | URL: ${eventUrl}`);
    } else {
      const failLine = formatAnimationFailLine({
        site: 'DragonBet',
        sport: 'NFL',
        title,
        url: eventUrl,
      });
      console.log(`❌ ${failLine}`);
      fail++;
      results.push(failLine);
    }

    await page.getByRole('link', { name: 'American Football' }).click().catch(async () => {
      await page.goto('https://dragonbet.co.uk/sport/americanfootball', { waitUntil: 'domcontentloaded' });
    });
    await page.waitForTimeout(800);
    await dismissOverlays(page);
  }

  console.log(`\n🧪 NFL RESULTS — PASS: ${pass} | FAIL: ${fail}`);
  results.forEach(r => console.log(r));

  const failLines = results.filter((r) => r.includes('| FAIL:') || r.startsWith('FAIL:'));
  appendAnimationEmailFailures('DragonBet', failLines);

  expect(pass + fail, 'Should test at least one NFL / NFL Pre-Season event').toBeGreaterThan(0);
  expect(fail, missingAnimationsAssertMessage(failLines)).toBe(0);
});
