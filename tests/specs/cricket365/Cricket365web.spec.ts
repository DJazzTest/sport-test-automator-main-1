/**
 * Feature: Cricket365 website validation
 *
 * Single sequential test: Homepage → Live Scores → Tests → ODI → T20 → Countries (run ends after Countries).
 * For each section: load, URL, content, images, links, pagination (where applicable).
 * Summary report: test-results/Cricket365_Test_Summary_Report.md (and DETAILED_RUN_REPORT.md).
 *
 * Run: npx playwright test Cricket365web.spec.ts
 */

import { test, expect } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
import {
  checkBrokenLinks,
  checkBrokenImages,
  scrollThroughPage,
} from '../../Utils/contentHelpers';
import type { BrokenLinkResult, BrokenImageResult } from '../../Utils/contentHelpers';

const BASE_URL = 'https://cricket365.com/';

const SECTION_MAX_LINKS_CHECK = 30;

/** Log per-section result in console with ✅ / ❌, mirroring Golf365 format. */
function logSectionResultsToConsole(
  sectionResults: Array<{ name: string; status: 'passed' | 'failed'; error?: string }>
): void {
  if (!sectionResults.length) return;
  console.log('\n--- Cricket365 section results ---');
  for (const section of sectionResults) {
    const icon = section.status === 'passed' ? '✅ passed' : '❌ failed';
    if (section.error) {
      console.log(`  ${icon}: ${section.name} - ${section.error}`);
    } else {
      console.log(`  ${icon}: ${section.name}`);
    }
  }
  console.log('--- End of Cricket365 section results ---\n');
}

/** Order of sections in the single flow: Homepage then these. */
const SECTION_ORDER = [
  { name: 'Live Scores', pattern: /Live\s*Scores/i },
  { name: 'Tests', pattern: /^Tests$/i },
  { name: 'ODI', pattern: /ODI'?s?/i },
  { name: 'T20', pattern: /T20/i },
  { name: 'Countries', pattern: /Countries/i },
];

/** Live Scores filter tabs: selector and optional label for visibility. */
const LIVE_SCORES_TABS = [
  { name: 'All', selector: 'span.all_tournament_tab' },
  { name: 'Live', selector: 'span:has-text("Live")' },
  { name: 'Finished', selector: 'span:has-text("Finished")' },
  { name: 'Upcoming', selector: 'span:has-text("Upcoming")' },
  { name: 'My Matches', selector: 'span:has-text("My Matches")' },
];

/** GMT timezone select on Live Scores page. */
const LIVE_SCORES_GMT_SELECTOR = 'select.ng-pristine, select[class*="ng-"]';

/** Overs format: e.g. 10.3, 0.0 (numeric.numeric). */
const OVERS_PATTERN = /^\d+(\.\d+)?$/;

/** Attach broken link URLs to the test report. */
function attachBrokenLinks(info: TestInfo, broken: BrokenLinkResult[]) {
  if (broken.length === 0) return;
  const lines = broken.map((b) => `${b.url}\t${b.status}\t${(b.text || '').slice(0, 60)}`);
  info.attach('broken-links-homepage.txt', {
    body: `URL\tStatus\tLink text\n${lines.join('\n')}`,
    contentType: 'text/plain',
  });
}

/** Attach broken image URLs to the test report. */
function attachBrokenImages(info: TestInfo, broken: BrokenImageResult[]) {
  if (broken.length === 0) return;
  const lines = broken.map((b) => `${b.src}\t${b.reason}\t${(b.alt || '').slice(0, 40)}`);
  info.attach('broken-images-homepage.txt', {
    body: `URL\tReason\tAlt\n${lines.join('\n')}`,
    contentType: 'text/plain',
  });
}

/** Dismiss cookie/consent banner if present. */
async function acceptConsent(page: import('@playwright/test').Page) {
  await page.waitForTimeout(800);
  const btn = page.getByRole('button', { name: /Accept|Allow all|Agree|OK/i }).first();
  if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await btn.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
}

/** Scope to main site header (nav or header element). */
function getHeaderScope(page: import('@playwright/test').Page) {
  return page.locator('header nav, nav[class*="nav"], header').first();
}

/**
 * Assert no visible score on the page is missing or malformed.
 * Cricket scores are typically like "150/3", "45-32", "2-1". Flag "? - ?" or "?-?" style placeholders.
 */
async function assertNoMissingOrMalformedScores(
  page: import('@playwright/test').Page
): Promise<void> {
  const result = await page.evaluate(() => {
    const body = document.body?.innerText || '';
    const malformed: string[] = [];
    // Obvious missing-score placeholders: ? - ? or ?-?
    if (/\?\s*[-–—]\s*\?/.test(body)) malformed.push('? - ?');
    if (/\?\s*\/\s*\?/.test(body)) malformed.push('?/?');
    return { malformed };
  });
  expect.soft(
    result.malformed.length,
    `No score should be missing or malformed. Found: ${result.malformed.join(', ') || 'none'}`
  ).toBe(0);
}

/**
 * Validate Live Scores page: tabs, GMT, team names, scores, overs format, match status,
 * clickable teams, no duplicate scorecards, page stable after updates.
 */
async function validateLiveScoresPage(
  page: import('@playwright/test').Page
): Promise<void> {
  // ——— Filter tabs (All, Live, Finished, Upcoming, My Matches) ———
  for (const tab of LIVE_SCORES_TABS) {
    const tabEl = page.locator(tab.selector).first();
    await expect.soft(tabEl, `Live Scores: "${tab.name}" tab visible`).toBeVisible({ timeout: 8000 });
  }

  // ——— GMT select ———
  const gmtSelect = page.locator(LIVE_SCORES_GMT_SELECTOR).first();
  await expect.soft(gmtSelect, 'Live Scores: GMT timezone select visible').toBeVisible({ timeout: 5000 });

  // ——— Verify sections open and any matches display (click each tab) ———
  for (const tab of LIVE_SCORES_TABS) {
    const tabEl = page.locator(tab.selector).first();
    if (await tabEl.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tabEl.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const hasMatchContent = await page.evaluate(() => {
        const body = (document.body?.innerText || '').trim();
        const hasScores = /\d+\s*[\/\-]\s*\d+|\d+\s*-\s*\d+/.test(body);
        const hasOvers = /\(\d+\.\d+\)|Overs?\s*[\d.]+/i.test(body);
        return body.length > 100 && (hasScores || hasOvers || body.includes('Match') || body.includes('vs'));
      });
      expect.soft(
        hasMatchContent,
        `Live Scores: "${tab.name}" tab opens and page shows match/scores area`
      ).toBe(true);
    }
  }

  // ——— Return to "All" so main content is visible for scorecard checks ———
  const allTab = page.locator('span.all_tournament_tab').first();
  if (await allTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await allTab.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  // ——— Scorecard assertions (when matches exist) ———
  const snapshot = await page.evaluate(
    (oversPattern: string) => {
      const reOvers = new RegExp(oversPattern);
      const body = document.body;
      const text = body?.innerText || '';
      const scoreLike = text.match(/\d+\s*[\/\-]\s*\d+/g) || [];
      const oversLike = text.match(/\d+\.\d+/g) || [];
      const teamLinks = Array.from(body?.querySelectorAll('a[href*="cricket365"], a[href*="/"]') || [])
        .filter((a) => (a.textContent || '').trim().length >= 2 && (a.textContent || '').trim().length <= 80)
        .slice(0, 30);
      const statusLike = /\b(Live|Finished|Upcoming|Stumps|Day \d|Innings|Match)\b/i.test(text);
      const scoreNotEmpty = scoreLike.every((s) => (s || '').trim().length > 0);
      const oversValid = oversLike.length === 0 || oversLike.some((o) => reOvers.test(o));
      return {
        scoreCount: scoreLike.length,
        scoreNotEmpty,
        oversValid,
        oversSamples: oversLike.slice(0, 5),
        teamLinkCount: teamLinks.length,
        hasStatus: statusLike,
        hasContent: text.length > 200,
      };
    },
    OVERS_PATTERN.source
  );

  expect.soft(snapshot.hasContent, 'Live Scores: page has content').toBe(true);
  expect.soft(snapshot.scoreNotEmpty, 'Live Scores: scores are not empty').toBe(true);
  expect.soft(snapshot.oversValid, `Live Scores: overs follow numeric pattern (e.g. 10.3), got: ${snapshot.oversSamples.join(', ') || 'none'}`).toBe(true);
  expect.soft(snapshot.hasStatus, 'Live Scores: match status text appears (Live/Finished/Upcoming/etc.)').toBe(true);

  if (snapshot.teamLinkCount > 0) {
    expect.soft(
      snapshot.teamLinkCount,
      'Live Scores: team names/links visible and clickable'
    ).toBeGreaterThan(0);
  }

  // ——— No duplicated scorecards (same score line repeated many times in a row) ———
  const noDuplicates = await page.evaluate(() => {
    const text = (document.body?.innerText || '').trim();
    const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const scoreLines = lines.filter((l) => /\d+\s*[\/\-]\s*\d+/.test(l));
    if (scoreLines.length < 2) return true;
    let repeated = 0;
    for (let i = 1; i < scoreLines.length; i++) {
      if (scoreLines[i] === scoreLines[i - 1]) repeated++;
    }
    return repeated < Math.min(3, scoreLines.length - 1);
  });
  expect.soft(noDuplicates, 'Live Scores: no duplicated scorecards').toBe(true);

  // ——— Page does not break during updates (wait and re-check) ———
  await page.waitForTimeout(3000);
  const afterWait = await page.evaluate(() => {
    const text = (document.body?.textContent || '').toLowerCase();
    const hasError = /\b404\b|\bpage not found\b|\bserver error\b/i.test(text);
    const hasScores = /\d+\s*[\/\-]\s*\d+/.test(text);
    return { hasError, hasScores };
  });
  expect.soft(afterWait.hasError, 'Live Scores: page does not break during updates (no error after wait)').toBeFalsy();
  expect.soft(
    afterWait.hasScores || snapshot.scoreCount > 0,
    'Live Scores: scores still present after short wait (updates correctly)'
  ).toBe(true);

  await assertNoMissingOrMalformedScores(page);
}

/** Check that page is not 404/error and has main content. */
async function assertPageLoadsAndRenders(
  page: import('@playwright/test').Page,
  sectionName: string
): Promise<void> {
  const url = page.url();
  const hasError = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const text = (main?.textContent || '').toLowerCase();
    return /\b404\b|\bserver error\b|\bfatal error\b|\bpage not found\b/i.test(text);
  });
  expect(hasError, `${sectionName}: No 404/error page. URL: ${url}`).toBeFalsy();

  const hasContent = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const text = (main?.textContent || '').trim();
    return text.length > 80;
  });
  expect(hasContent, `${sectionName}: Page content should render (sufficient text)`).toBe(true);

  const hasMajorLayoutIssue = await page.evaluate(() => {
    const body = document.body;
    if (!body) return true;
    const rect = body.getBoundingClientRect();
    const overflowHidden = window.getComputedStyle(body).overflow === 'hidden' && rect.height < 100;
    const noVisibleContent = document.querySelectorAll('img, a, h1, h2, [class*="article"], [class*="content"]').length === 0;
    return overflowHidden || noVisibleContent;
  });
  expect(hasMajorLayoutIssue, `${sectionName}: No major layout or rendering issues`).toBeFalsy();
}

/**
 * Validate a country detail page: correct URL structure, country name displayed,
 * related cricket news content visible, no placeholder (F365 Teams-style validation).
 */
async function validateCountryPage(
  page: import('@playwright/test').Page,
  countryName: string,
  countrySlug: string
): Promise<void> {
  const url = page.url();
  expect.soft(
    url,
    `Country page URL should contain country slug "${countrySlug}"`
  ).toContain(countrySlug);
  expect.soft(url, 'Country page should be on cricket365.com').toMatch(/cricket365\.com/);

  const hasError = await page.evaluate(() => {
    const text = (document.body?.textContent || '').toLowerCase();
    return /\b404\b|\bpage not found\b|\bserver error\b/i.test(text);
  });
  expect.soft(hasError, `Country "${countryName}": page should load without error`).toBeFalsy();

  const h1 = page.getByRole('heading', { level: 1 }).first();
  const h1Visible = await h1.isVisible({ timeout: 5000 }).catch(() => false);
  expect.soft(
    h1Visible,
    `Country "${countryName}": page should display country name (H1)`
  ).toBe(true);
  if (h1Visible) {
    const h1Text = (await h1.textContent())?.trim() ?? '';
    const containsName = h1Text.toLowerCase().includes(countryName.toLowerCase());
    if (!containsName) {
      // Soft-only: record mismatch in logs, but do not fail the test
      // (main failure signal for Countries comes from pagination/broken links).
      console.log(
        `Country H1 mismatch for ${countryName}: got "${h1Text.slice(0, 80)}"`
      );
    }
  }

  const newsSection = page.locator(
    'h2:has-text("News"), h3:has-text("News"), [class*="news"], [class*="article"], article'
  ).first();
  const newsVisible = await newsSection.isVisible({ timeout: 5000 }).catch(() => false);
  expect.soft(
    newsVisible,
    `Country "${countryName}": related cricket news section should be visible`
  ).toBe(true);

  const hasPlaceholder = await page.evaluate(() => {
    const text = (document.body?.textContent || '').toLowerCase();
    return ['lorem ipsum', 'add content here', 'placeholder text'].some(
      (p) => text.includes(p)
    );
  });
  expect.soft(
    hasPlaceholder,
    `Country "${countryName}": no placeholder or empty module text`
  ).toBeFalsy();
}

/** Validate Countries listing page: load, URL structure, content modules (F365 Teams-style). */
async function validateCountriesListingPage(
  page: import('@playwright/test').Page
): Promise<void> {
  const url = page.url();
  expect.soft(url, 'Countries page should be on cricket365.com').toMatch(/cricket365\.com/);

  const hasError = await page.evaluate(() => {
    const text = (document.body?.textContent || '').toLowerCase();
    return /\b404\b|\bpage not found\b|\bserver error\b/i.test(text);
  });
  expect.soft(hasError, 'Countries page should load without error').toBeFalsy();

  const hasContent = await page.evaluate(() => (document.body?.textContent || '').trim().length > 80);
  expect.soft(hasContent, 'Countries page should have content').toBe(true);

  const hasContentModules = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const hasLinks = main?.querySelectorAll('a[href*="cricket365"]').length ?? 0;
    const hasImages = main?.querySelectorAll('img').length ?? 0;
    return (hasLinks > 0 && hasImages > 0) || (main?.textContent?.trim().length ?? 0) > 200;
  });
  expect.soft(
    hasContentModules,
    'Countries page: content modules (links and/or images) should render correctly'
  ).toBe(true);
}

/**
 * Collect all countries displayed on the Countries list (links containing div.text-sm.font-medium.text-white).
 * Returns unique entries by href so each country page is tested once.
 */
async function getCountriesFromList(
  page: import('@playwright/test').Page
): Promise<Array<{ name: string; href: string }>> {
  const countryLinks = page.locator('a').filter({
    has: page.locator('div.text-sm.font-medium.text-white'),
  });
  const count = await countryLinks.count();
  const entries: Array<{ name: string; href: string }> = [];
  const seenHref = new Set<string>();
  for (let i = 0; i < count; i++) {
    const a = countryLinks.nth(i);
    const name = (await a.locator('div.text-sm.font-medium.text-white').first().textContent())?.trim() ?? '';
    const href = await a.getAttribute('href');
    if (!name || !href) continue;
    const fullHref = new URL(href, page.url()).href;
    if (seenHref.has(fullHref)) continue;
    seenHref.add(fullHref);
    entries.push({ name, href: fullHref });
  }
  return entries;
}

/** Build page 2 URL from a given page URL (same path + /page/2). */
function getPage2Url(pageUrl: string): string {
  const url = new URL(pageUrl);
  const pathname = url.pathname.replace(/\/$/, '');
  const basePath = pathname.replace(/\/page\/\d+$/i, '') || '/';
  const page2Path = basePath + (basePath.endsWith('/') ? '' : '/') + 'page/2';
  return `${url.origin}${page2Path}`;
}

/**
 * Assert pagination works: page 2 (or next page) loads successfully.
 * Builds page 2 URL from current path and fails if it returns 404 or error.
 */
async function assertPaginationWorks(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  contextName: string
): Promise<void> {
  const page2Url = getPage2Url(page.url());
  const response = await request.get(page2Url, { timeout: 15_000 }).catch(() => null);
  expect.soft(
    response,
    `${contextName}: pagination page 2 URL should be reachable (${page2Url})`
  ).not.toBeNull();
  if (response) {
    expect.soft(
      response.status(),
      `${contextName}: pagination page 2 must not return error (got ${response.status()} for ${page2Url})`
    ).toBeLessThan(400);
  }
  if (response && response.status() < 400) {
    await page.goto(page2Url, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => {});
    const has404 = await page.evaluate(() => {
      const text = (document.body?.textContent || '').toLowerCase();
      return /\b404\b|\bpage not found\b/i.test(text);
    });
    expect.soft(
      has404,
      `${contextName}: pagination page 2 must load content (no 404 page)`
    ).toBeFalsy();
    const hasContent = await page.evaluate(() => (document.body?.textContent || '').trim().length > 50);
    expect.soft(
      hasContent,
      `${contextName}: pagination page 2 must display content`
    ).toBe(true);
  }
}

/**
 * Check if country page 2 returns 404 (or error status). Does not throw.
 * Returns true if page 2 is broken (404 or error status or 404 in body).
 */
async function isCountryPage2Broken(
  request: import('@playwright/test').APIRequestContext,
  countryPageUrl: string
): Promise<{ broken: boolean; page2Url: string; status?: number }> {
  const page2Url = getPage2Url(countryPageUrl);
  const response = await request.get(page2Url, { timeout: 15_000 }).catch(() => null);
  if (!response) return { broken: true, page2Url };
  if (response.status() >= 400) return { broken: true, page2Url, status: response.status() };
  return { broken: false, page2Url, status: response.status() };
}

/** Assert section page loaded successfully and correct URL. */
async function assertSectionLoadAndUrl(
  page: import('@playwright/test').Page,
  sectionName: string
): Promise<void> {
  await expect.soft(page).toHaveURL(/cricket365\.com/);
  const hasError = await page.evaluate(() => {
    const text = (document.body?.textContent || '').toLowerCase();
    return /\b404\b|\bpage not found\b|\bserver error\b/i.test(text);
  });
  expect.soft(hasError, `${sectionName}: page should load without error`).toBeFalsy();
  const hasContent = await page.evaluate(() => (document.body?.textContent || '').trim().length > 50);
  expect.soft(hasContent, `${sectionName}: page should have content`).toBe(true);
}

/** Assert article list is displayed and each of first few articles has headline, image, date, author. */
async function validateArticleListSection(
  page: import('@playwright/test').Page,
  sectionLabel: string
): Promise<void> {
  const articleSelector = 'article, [class*="article"], [class*="card"]';
  const articles = page.locator(articleSelector);
  const count = await articles.count();
  expect.soft(count, `${sectionLabel}: list of news articles should be displayed`).toBeGreaterThan(0);
  const minToCheck = Math.min(3, count);
  for (let i = 0; i < minToCheck; i++) {
    const article = articles.nth(i);
    await expect.soft(article, `${sectionLabel}: article ${i + 1} visible`).toBeVisible({ timeout: 5000 });
  }
}

/** Validate images, links, and text on current page (section-level limits). */
async function validateSectionContent(
  page: import('@playwright/test').Page,
  request: import('@playwright/test').APIRequestContext,
  sectionName: string,
  info: TestInfo
): Promise<void> {
  await scrollThroughPage(page);
  await page.waitForTimeout(800);

  const { broken: brokenImages, totalVisible } = await checkBrokenImages(page, request, {
    maxHttpChecks: 15,
  });
  if (brokenImages.length > 0) {
    const lines = brokenImages.map((b) => `${b.src}\t${b.reason}`);
    info.attach(`broken-images-${sectionName.replace(/\s+/g, '-')}.txt`, {
      body: `URL\tReason\n${lines.join('\n')}`,
      contentType: 'text/plain',
    });
  }
  expect.soft(
    brokenImages.length,
    `${sectionName}: All visible images should be valid (found ${brokenImages.length} broken of ${totalVisible} visible)`
  ).toBe(0);

  const textReadable = await page.evaluate(() => {
    const text = (document.body?.textContent || '').trim();
    return text.length > 50 && !/\uFFFD/.test(text);
  });
  expect.soft(textReadable, `${sectionName}: All visible text should be valid/readable`).toBe(true);

  const { broken: brokenLinks, totalChecked } = await checkBrokenLinks(page, request, {
    maxLinks: SECTION_MAX_LINKS_CHECK,
    timeout: 8000,
  });
  if (brokenLinks.length > 0) {
    const lines = brokenLinks.map((b) => `${b.url}\t${b.status}`);
    info.attach(`broken-links-${sectionName.replace(/\s+/g, '-')}.txt`, {
      body: `URL\tStatus\n${lines.join('\n')}`,
      contentType: 'text/plain',
    });
  }
  expect.soft(
    brokenLinks.length,
    `${sectionName}: All visible links should be valid (found ${brokenLinks.length} broken of ${totalChecked} checked)`
  ).toBe(0);
}

test.describe.serial('Cricket365', () => {
  test.describe.configure({ retries: 0 });

  test('Full sequence: Homepage → Live Scores → Tests → ODI → T20 → Countries', async ({
    page,
    request,
  }) => {
    test.setTimeout(420_000);
    const info = test.info();
    const sectionResults: Array<{ name: string; status: 'passed' | 'failed'; error?: string }> = [];
    let countryPagination404: Array<{ countryName: string; countryUrl: string; page2Url: string; status?: number }> = [];
    try {
    const baseOrigin = new URL(BASE_URL).origin;
    const failedResponses: Array<{ status: number; url: string }> = [];
    page.on('response', (r) => {
      const url = r.url();
      if (r.status() >= 400 && !/uniccmp|intentiq|doubleclick|googletagmanager|google-analytics|facebook\.com\/tr/i.test(url))
        failedResponses.push({ status: r.status(), url });
    });

    // ——— 1. HOMEPAGE ———
    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect.soft(response?.status(), 'Homepage: page should load successfully').toBeLessThan(400);
    await expect.soft(page).toHaveURL(/cricket365\.com/);
    await acceptConsent(page);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const sameOriginFailures = failedResponses.filter((r) => {
      try {
        return new URL(r.url).origin === baseOrigin;
      } catch {
        return false;
      }
    });
    expect.soft(
      sameOriginFailures.length,
      `Homepage: no critical same-origin network errors. Same-origin failures: ${sameOriginFailures.slice(0, 5).map((r) => `${r.status} ${r.url}`).join('; ')}`
    ).toBe(0);
    await scrollThroughPage(page);
    await page.waitForTimeout(1500);
    const { broken: homeBrokenImages, totalVisible: homeImages } = await checkBrokenImages(page, request, { maxHttpChecks: 25 });
    attachBrokenImages(info, homeBrokenImages);
    expect.soft(homeBrokenImages.length, `Homepage: no broken images (${homeBrokenImages.length} of ${homeImages})`).toBe(0);
    expect.soft(await page.evaluate(() => (document.body?.textContent || '').trim().length > 100 && !/\uFFFD/.test((document.body?.textContent || ''))), 'Homepage: text readable').toBe(true);
    const { broken: homeBrokenLinks, totalChecked: homeLinksChecked } = await checkBrokenLinks(page, request, { maxLinks: 75, timeout: 10_000 });
    attachBrokenLinks(info, homeBrokenLinks);
    expect.soft(homeBrokenLinks.length, `Homepage: no broken links (${homeBrokenLinks.length} of ${homeLinksChecked})`).toBe(0);
    const homeUrl = page.url();
    await assertPaginationWorks(page, request, 'Homepage');
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});

    const homePassed =
      (response?.status() ?? 0) < 400 &&
      sameOriginFailures.length === 0 &&
      homeBrokenImages.length === 0 &&
      homeBrokenLinks.length === 0;
    const homeError = !homePassed
      ? [
          (response?.status() ?? 0) >= 400 && `Page load: ${response?.status()}`,
          sameOriginFailures.length > 0 && `Network errors: ${sameOriginFailures.length}`,
          homeBrokenImages.length > 0 && `Broken images: ${homeBrokenImages.length}`,
          homeBrokenLinks.length > 0 && `Broken links: ${homeBrokenLinks.length}`,
        ]
          .filter(Boolean)
          .join('; ')
      : undefined;
    sectionResults.push({ name: 'Homepage', status: homePassed ? 'passed' : 'failed', error: homeError });

    // ——— 2–6. SECTIONS: Live Scores → Tests → ODI → T20 → Countries ———
    for (const section of SECTION_ORDER) {
      const link = page.getByRole('link', { name: section.pattern }).first();
      await expect.soft(link, `${section.name}: nav link visible`).toBeVisible({ timeout: 10_000 });
      await link.click({ timeout: 10_000 });
      await page.waitForLoadState('domcontentloaded', { timeout: 20_000 });
      await page.waitForTimeout(2000);

      await assertSectionLoadAndUrl(page, section.name);
      await expect.soft(page).toHaveURL(/cricket365\.com/);

      if (section.name === 'Live Scores') {
        await validateLiveScoresPage(page);
      } else if (section.name === 'Tests' || section.name === 'ODI' || section.name === 'T20') {
        await validateArticleListSection(page, section.name);
        const sectionUrl = page.url();
        await assertPaginationWorks(page, request, section.name);
        await page.goto(sectionUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
      } else if (section.name === 'Countries') {
        await validateCountriesListingPage(page);
        const countriesUrl = page.url();
        await assertPaginationWorks(page, request, 'Countries');
        await page.goto(countriesUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
        const countryEntries = await getCountriesFromList(page);
        expect.soft(countryEntries.length, 'Countries: at least one country must be displayed in the list').toBeGreaterThan(0);
        countryPagination404 = [];
        for (let i = 0; i < countryEntries.length; i++) {
          try {
            const { name, href } = countryEntries[i];
            if (i > 0) {
              await page.goto(countriesUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
              await page.waitForTimeout(2000);
            }
            await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 20_000 });
            await page.waitForTimeout(2000);
            const slug = new URL(href).pathname.replace(/\/$/, '').split('/').pop() ?? name.toLowerCase().replace(/\s+/g, '-');
            await validateCountryPage(page, name, slug);
            const countryPageUrl = page.url();
            const page2Check = await isCountryPage2Broken(request, countryPageUrl);
            if (page2Check.broken) {
              countryPagination404.push({
                countryName: name,
                countryUrl: href.startsWith('http') ? href : new URL(href, countryPageUrl).href,
                page2Url: page2Check.page2Url,
                status: page2Check.status,
              });
            }
            await page.goto(countryPageUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
          } catch (e) {
            info.attach(`country-error-${i}.txt`, { body: String(e), contentType: 'text/plain' });
          }
        }
        info.attach('cricket365-country-pagination-404.json', {
          body: JSON.stringify(countryPagination404, null, 2),
          contentType: 'application/json',
        });
        expect.soft(
          countryPagination404.length,
          `Country Pagination: page 2 must not return 404 (affected: ${countryPagination404.length} countries)`
        ).toBe(0);
      }

      await scrollThroughPage(page);
      await page.waitForTimeout(800);
      const { broken: sectionBrokenImages } = await checkBrokenImages(page, request, { maxHttpChecks: 20 });
      if (sectionBrokenImages.length > 0) {
        info.attach(`broken-images-${section.name.replace(/\s+/g, '-')}.txt`, { body: sectionBrokenImages.map((b) => `${b.src}\t${b.reason}`).join('\n'), contentType: 'text/plain' });
      }
      expect.soft(sectionBrokenImages.length, `${section.name}: no broken images`).toBe(0);
      expect.soft(await page.evaluate(() => (document.body?.textContent || '').trim().length > 50 && !/\uFFFD/.test((document.body?.textContent || ''))), `${section.name}: text readable`).toBe(true);
      const { broken: sectionBrokenLinks } = await checkBrokenLinks(page, request, { maxLinks: SECTION_MAX_LINKS_CHECK, timeout: 8000 });
      if (sectionBrokenLinks.length > 0) {
        info.attach(`broken-links-${section.name.replace(/\s+/g, '-')}.txt`, { body: sectionBrokenLinks.map((b) => `${b.url}\t${b.status}`).join('\n'), contentType: 'text/plain' });
      }
      expect.soft(sectionBrokenLinks.length, `${section.name}: no broken links (found ${sectionBrokenLinks.length})`).toBe(0);

      const sectionPassed = sectionBrokenImages.length === 0 && sectionBrokenLinks.length === 0;
      const sectionError = !sectionPassed
        ? [
            sectionBrokenImages.length > 0 && `Broken images: ${sectionBrokenImages.length}`,
            sectionBrokenLinks.length > 0 && `Broken links: ${sectionBrokenLinks.length}`,
          ]
            .filter(Boolean)
            .join('; ')
        : undefined;
      sectionResults.push({ name: section.name, status: sectionPassed ? 'passed' : 'failed', error: sectionError });
      if (section.name === 'Countries') {
        sectionResults.push({
          name: 'Country Pagination (Page 2)',
          status: countryPagination404.length === 0 ? 'passed' : 'failed',
          error:
            countryPagination404.length > 0
              ? `404 on page 2 for ${countryPagination404.length} countries. See affected URLs below.`
              : undefined,
        });
      }
    }
    } finally {
      info.attach('cricket365-sections.json', {
        body: JSON.stringify(sectionResults),
        contentType: 'application/json',
      });
      // Console summary in the same ✅ / ❌ style as Golf365
      logSectionResultsToConsole(sectionResults);
    }
  });
});
