import { test, expect, Page } from '@playwright/test';
import { ANIMATION_EVENTS_PER_SPORT, pickRandomIndices } from '../../lib/animation-sample';
import {
  appendAnimationEmailFailures,
  formatAnimationFailLine,
  missingAnimationsAssertMessage,
} from '../../Utils/animationEmailReport';

async function acceptConsent(page: Page): Promise<void> {
  try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
  try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
  try { await page.locator('[data-test="notification-box"] [data-test="close-icon"]').first().click({ timeout: 1500 }); } catch {}
  try { await page.locator('[data-test="landing-page"] [data-test="close-icon"]').first().click({ timeout: 1500 }); } catch {}
}

async function dismissOverlays(page: Page): Promise<void> {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => {
    document.querySelectorAll('[class*="LPOverlay"]').forEach((el) => {
      (el as HTMLElement).style.display = 'none';
      (el as HTMLElement).style.pointerEvents = 'none';
    });
  }).catch(() => {});
}

async function openNflPreSeasonEvents(page: Page) {
  // All view keeps pre-season fixtures visible (Today/Tomorrow filters hide Fri+ games)
  const allBtn = page.getByRole('button', { name: 'All', exact: true }).first();
  if (await allBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await allBtn.click({ force: true, timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
  }

  const chip = page.getByRole('button', { name: /US NFL Pre-Season|NFL Pre-Season/i }).first();
  if (await chip.isVisible({ timeout: 1500 }).catch(() => false)) {
    console.log('🖱️ Clicking competition filter: US NFL Pre-Season');
    await chip.click({ force: true, timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(800);
  }

  for (let s = 0; s < 6; s++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

  // Prefer the user's target element: h4[data-test="section-title"] NFL Pre-Season
  let heading = page.locator('h4[data-test="section-title"]').filter({ hasText: /NFL Pre-Season/i }).first();
  let sectionName = 'NFL Pre-Season';
  if (!(await heading.isVisible({ timeout: 2500 }).catch(() => false))) {
    heading = page.locator('h4[data-test="section-title"]').filter({ hasText: /^US NFL$/i }).first();
    sectionName = 'US NFL';
  }
  const visible = await heading.isVisible({ timeout: 2000 }).catch(() => false);
  if (!visible) {
    return { visible: false, sectionName: '', eventLinks: page.locator('a__none'), total: 0 };
  }
  sectionName = ((await heading.innerText().catch(() => sectionName)) || sectionName).trim();
  console.log(`✅ Found section title: "${sectionName}"`);

  await heading.scrollIntoViewIfNeeded().catch(() => {});
  await heading.click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(400);
  await heading.click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(600);

  const section = heading.locator('xpath=ancestor::section[1]');
  let eventLinks = section.locator('a[href*="/event/"]');
  let total = await eventLinks.count().catch(() => 0);
  if (!total) {
    eventLinks = page.locator(
      `xpath=//h4[@data-test="section-title"][contains(normalize-space(.), "Pre-Season") or normalize-space(.)="US NFL"]/following::a[contains(@href,"/event/")][position()<=30]`
    );
    // Narrow to links that appear before the next unrelated section by filtering team-like text length
    total = await eventLinks.count().catch(() => 0);
  }
  return { visible: true, sectionName, eventLinks, total };
}

test('PlanetSports NFL Animation/tests/specs/planetsports/PSG.NFL.Animations.spec.ts', async ({ page }) => {
  test.setTimeout(8 * 60_000);
  console.log('🚀 Starting American Football Live Tracker check...');

  await page.goto('https://planetsportbet.com/');
  await acceptConsent(page);
  await dismissOverlays(page);

  console.log('🏈 Navigating to American Football sport page...');
  await page.goto('https://planetsportbet.com/sport/americanfootball');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await dismissOverlays(page);

  const opened = await openNflPreSeasonEvents(page);
  expect(opened.visible, 'h4[data-test="section-title"] for NFL Pre-Season / US NFL should be visible').toBeTruthy();
  expect(opened.total, 'Should find events under NFL Pre-Season / US NFL').toBeGreaterThan(0);
  console.log(`📊 Events under "${opened.sectionName}": ${opened.total}`);

  const indices = pickRandomIndices(opened.total, ANIMATION_EVENTS_PER_SPORT);
  console.log(`🎲 Sampling ${indices.length} of ${opened.total}: [${indices.join(', ')}]`);

  let totalPassCount = 0;
  let totalFailCount = 0;
  const allPassedEvents: string[] = [];
  const allFailedEvents: string[] = [];

  for (const i of indices) {
    const refreshed = await openNflPreSeasonEvents(page);
    if (i >= refreshed.total) break;
    const event = refreshed.eventLinks.nth(i);
    let eventTitle = `Event ${i + 1}`;
    try {
      eventTitle = ((await event.innerText().catch(() => '')) || eventTitle).trim().replace(/\s+/g, ' ');
      console.log(`\n🎯 Testing: ${eventTitle}`);

      await event.scrollIntoViewIfNeeded().catch(() => {});
      await event.click({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(800);

      const animatedWidget = page.locator('div.animated_widget iframe[src*="widgets"], #the-americanfootball-sport-widget iframe');
      let hasAnimatedWidget = await animatedWidget.first().isVisible({ timeout: 2000 }).catch(() => false);

      if (!hasAnimatedWidget) {
        const liveTrackerSection = page.locator('div[class*="CollapseLabel"]').filter({ hasText: /Live tracker/i }).first();
        await liveTrackerSection.click({ timeout: 2000 }).catch(() => {});
        await page.getByRole('heading', { name: /Live tracker/i }).click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(1000);
        hasAnimatedWidget = await animatedWidget.first().isVisible({ timeout: 3000 }).catch(() => false);
      }

      if (hasAnimatedWidget) {
        console.log(`✅ PASS: ${eventTitle} | URL: ${page.url()}`);
        totalPassCount++;
        allPassedEvents.push(`${eventTitle} | URL: ${page.url()}`);
      } else {
        const failLine = formatAnimationFailLine({
          site: 'PlanetSports',
          sport: 'NFL',
          title: eventTitle,
          url: page.url(),
        });
        console.log(`❌ ${failLine}`);
        totalFailCount++;
        allFailedEvents.push(failLine);
      }
    } catch (error) {
      const failLine = formatAnimationFailLine({
        site: 'PlanetSports',
        sport: 'NFL',
        title: `${eventTitle} (error: ${(error as Error).message})`,
        url: page.url(),
      });
      console.log(`❌ ${failLine}`);
      totalFailCount++;
      allFailedEvents.push(failLine);
    }

    await page.goto('https://planetsportbet.com/sport/americanfootball', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(800);
    await dismissOverlays(page);
  }

  console.log('\n=== AMERICAN FOOTBALL LIVE TRACKER RESULTS ===');
  console.log(`📊 Total Events Tested: ${totalPassCount + totalFailCount}`);
  console.log(`✅ PASS: ${totalPassCount}`);
  console.log(`❌ FAIL: ${totalFailCount}`);
  allPassedEvents.forEach((e, i) => console.log(`PASS ${i + 1}. ${e}`));
  allFailedEvents.forEach((e, i) => console.log(`FAIL ${i + 1}. ${e}`));

  appendAnimationEmailFailures('PlanetSports', allFailedEvents);

  expect(totalPassCount + totalFailCount, 'Should test at least one NFL event').toBeGreaterThan(0);
  expect(totalFailCount, missingAnimationsAssertMessage(allFailedEvents)).toBe(0);
});
