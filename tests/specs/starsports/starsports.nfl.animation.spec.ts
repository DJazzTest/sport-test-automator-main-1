import { test, expect, Page } from '@playwright/test';
import { ANIMATION_EVENTS_PER_SPORT, pickRandomIndices } from '../../lib/animation-sample';
import {
  appendAnimationEmailFailures,
  formatAnimationFailLine,
  missingAnimationsAssertMessage,
} from '../../Utils/animationEmailReport';

async function acceptCookies(page: Page): Promise<void> {
  try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
  try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
  try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
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

  let heading = page.locator('h4[data-test="section-title"]').filter({ hasText: /NFL Pre-Season/i }).first();
  let sectionName = 'NFL Pre-Season';
  if (!(await heading.isVisible({ timeout: 2500 }).catch(() => false))) {
    heading = page.locator('h4[data-test="section-title"]').filter({ hasText: /^US NFL$/i }).first();
    sectionName = 'US NFL';
  }
  // Fallback role heading used on some StarSports layouts
  if (!(await heading.isVisible({ timeout: 1500 }).catch(() => false))) {
    heading = page.getByRole('heading', { name: /NFL Pre-Season|US NFL/i }).first();
  }

  const visible = await heading.isVisible({ timeout: 2000 }).catch(() => false);
  if (!visible) {
    return { visible: false, sectionName: '', eventLinks: page.locator('a__none'), total: 0 };
  }
  sectionName = ((await heading.innerText().catch(() => sectionName)) || sectionName).trim();
  console.log(`✅ Found section title: "${sectionName}"`);

  await heading.scrollIntoViewIfNeeded().catch(() => {});
  await heading.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(600);
  await heading.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(800);

  const section = heading.locator('xpath=ancestor::section[1]');
  let eventLinks = section.locator('a[href*="/event/"]');
  let total = await eventLinks.count().catch(() => 0);
  if (!total) {
    eventLinks = page.locator(
      `xpath=//h4[@data-test="section-title"][contains(normalize-space(.), "Pre-Season") or normalize-space(.)="US NFL"]/following::a[contains(@href,"/event/")][position()<=30]`
    );
    total = await eventLinks.count().catch(() => 0);
  }
  return { visible: true, sectionName, eventLinks, total };
}

test('StarSports NFL Animation/tests/specs/starsports/starsports.nfl.animation.spec.ts', async ({ page }) => {
  test.setTimeout(10 * 60_000);

  await page.goto('https://starsports.bet/', { waitUntil: 'domcontentloaded' });
  await acceptCookies(page);
  await dismissOverlays(page);

  console.log('🏈 Navigating to American Football via left-hand side...');
  await page.getByRole('link', { name: 'American Football' }).click().catch(async () => {
    await page.goto('https://starsports.bet/sport/americanfootball', { waitUntil: 'domcontentloaded' });
  });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(1500);
  await dismissOverlays(page);

  const opened = await openNflPreSeasonEvents(page);
  expect(opened.visible, 'h4[data-test="section-title"] for NFL Pre-Season / US NFL should be visible').toBeTruthy();
  expect(opened.total, 'Should find events under NFL Pre-Season / US NFL').toBeGreaterThan(0);
  console.log(`📊 Events under "${opened.sectionName}": ${opened.total}`);

  const indices = pickRandomIndices(opened.total, ANIMATION_EVENTS_PER_SPORT);
  console.log(`🎲 Sampling ${indices.length} of ${opened.total}: [${indices.join(', ')}]`);

  let pass = 0, fail = 0;
  const results: string[] = [];

  for (let t = 0; t < indices.length; t++) {
    const i = indices[t];
    const refreshed = await openNflPreSeasonEvents(page);
    if (i >= refreshed.total) break;
    const link = refreshed.eventLinks.nth(i);
    const title = (await link.innerText().catch(() => `Event ${i + 1}`)).trim().replace(/\s+/g, ' ') || `Event ${i + 1}`;
    console.log(`\n🎯 Testing ${t + 1}/${indices.length}: ${title}`);

    await link.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const liveTracker = page.getByRole('heading', { name: 'Live tracker' });
    if (await liveTracker.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('🖱️ Clicking Live tracker...');
      await liveTracker.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    const detect = async () => {
      const widget = page.locator('#the-americanfootball-sport-widget iframe, .animated_widget iframe').first();
      try {
        await widget.scrollIntoViewIfNeeded();
        await widget.waitFor({ state: 'visible', timeout: 5000 });
        const start = Date.now();
        while (Date.now() - start < 8000) {
          const src = await widget.getAttribute('src').catch(() => null);
          const visible = await widget.isVisible().catch(() => false);
          if (src && src.includes('thesports01.com') && visible) return true;
          await page.waitForTimeout(400).catch(() => {});
        }
      } catch {}
      return false;
    };

    let hasAnim = false;
    try {
      hasAnim = await Promise.race([
        detect(),
        new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('EVENT_TIMEOUT')), 15000)),
      ]) as boolean;
    } catch {
      hasAnim = false;
    }

    if (hasAnim) {
      console.log(`✅ PASS: animation detected — ${title} | URL: ${page.url()}`);
      pass++;
      results.push(`PASS: ${title} | URL: ${page.url()}`);
    } else {
      const failLine = formatAnimationFailLine({
        site: 'StarSports',
        sport: 'NFL',
        title,
        url: page.url(),
      });
      console.log(`❌ ${failLine}`);
      fail++;
      results.push(failLine);
    }

    await page.getByRole('link', { name: 'American Football' }).click().catch(async () => {
      await page.goto('https://starsports.bet/sport/americanfootball', { waitUntil: 'domcontentloaded' });
    });
    await page.waitForTimeout(800);
    await dismissOverlays(page);
  }

  console.log('\n🏁 === FINAL NFL ANIMATION TEST RESULTS ===');
  console.log(`📊 Total Events Tested: ${pass + fail}`);
  console.log(`✅ Total Passed: ${pass}`);
  console.log(`❌ Total Failed: ${fail}`);
  results.forEach(r => console.log(r));

  const failLines = results.filter((r) => r.includes('| FAIL:') || r.startsWith('FAIL:'));
  appendAnimationEmailFailures('StarSports', failLines);

  expect(pass + fail, 'Should test at least one NFL event').toBeGreaterThan(0);
  expect(fail, missingAnimationsAssertMessage(failLines)).toBe(0);
});
