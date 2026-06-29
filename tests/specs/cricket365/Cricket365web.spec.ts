/**
 * Cricket365 website validation
 *
 * Flow: Homepage → Live Scores → Tests → ODI → T20 → Countries
 * Per section: consent, ads, stale content, broken images, broken URLs, random article samples.
 */

import { test, expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { checkBrokenImages, scrollThroughPage } from '../../Utils/contentHelpers';
import { appendEmailReportFailures } from '../../Utils/emailReportMerge';

const BASE_URL = 'https://www.cricket365.com/';
const SITE_ORIGIN = 'https://www.cricket365.com';
const RANDOM_ARTICLE_COUNT = 15;
const STALE_ARTICLE_DAYS = 365;

const NAV = {
  liveScores: { dataText: 'Live Scores', url: `${SITE_ORIGIN}/matches` },
  tests: { dataText: 'Tests', url: `${SITE_ORIGIN}/test-cricket` },
  odi: { dataText: 'ODI', url: `${SITE_ORIGIN}/odi-cricket` },
  t20: { dataText: 'T20', url: `${SITE_ORIGIN}/t20-cricket` },
  countries: { dataText: 'Countries', url: `${SITE_ORIGIN}/countries` },
} as const;

const EXPECTED_COUNTRIES: Array<{ name: string; slug: string }> = [
  { name: 'Australia', slug: 'australia' },
  { name: 'India', slug: 'india' },
  { name: 'South Africa', slug: 'south-africa' },
  { name: 'Bangladesh', slug: 'bangladesh' },
  { name: 'New Zealand', slug: 'new-zealand' },
  { name: 'Sri Lanka', slug: 'sri-lanka' },
  { name: 'England', slug: 'england' },
  { name: 'Pakistan', slug: 'pakistan' },
  { name: 'West Indies', slug: 'west-indies' },
];

const SKIP_LINK_HOST =
  /facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|linkedin\.com|tiktok\.com|google\.com\/preferences|doubleclick|googletagmanager|google-analytics/i;

type SectionResult = { name: string; status: 'passed' | 'failed'; error?: string };

function logSectionResults(results: SectionResult[]) {
  console.log('\n--- Cricket365 section results ---');
  for (const r of results) {
    const icon = r.status === 'passed' ? '✅ passed' : '❌ failed';
    console.log(r.error ? `  ${icon}: ${r.name} - ${r.error}` : `  ${icon}: ${r.name}`);
  }
  console.log('--- End of Cricket365 section results ---\n');
}

function record(failures: string[], section: string, tag: string, detail: string) {
  failures.push(`${section} | ${tag} | ${detail}`);
}

/** Dismiss UniConsent — "Accept & Continue". */
async function dismissConsent(page: Page) {
  await page.waitForTimeout(600);
  const btn = page.locator('#uniccmp button', { hasText: /Accept\s*&\s*Continue/i }).first();
  if (await btn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await btn.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
  } else {
    const fallback = page.getByRole('button', { name: /Accept|Allow all|Agree/i }).first();
    if (await fallback.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fallback.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
  }
  await page.locator('#uniccmp [role="dialog"]').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
}

/** Hide consent overlay if it still intercepts clicks. */
async function dismissOverlays(page: Page) {
  await page.evaluate(() => {
    const cmp = document.getElementById('uniccmp');
    if (cmp) {
      cmp.style.setProperty('display', 'none', 'important');
      cmp.style.setProperty('pointer-events', 'none', 'important');
    }
  }).catch(() => {});
}

async function preparePage(page: Page) {
  await dismissConsent(page);
  await dismissOverlays(page);
}

/** Scroll page and poll for display ads (pass when ads present). */
async function assertAdsVisible(page: Page, section: string, failures: string[]) {
  const adSelectors = [
    'ins.adsbygoogle',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="doubleclick"]',
    'iframe[src*="securepubads"]',
    '[id*="ad-slot" i]',
    '[class*="advert" i]',
    '[class*="ad-slot" i]',
    '[data-ad]',
    'div[id^="div-gpt-ad"]',
    '[id*="google_ads" i]',
    'div[class*="ps-ad" i]',
  ].join(',');

  const deadline = Date.now() + 30_000;
  let found = false;
  while (Date.now() < deadline) {
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(200);
    }
    const count = await page.locator(adSelectors).count().catch(() => 0);
    const iframeAds = await page.locator('iframe').evaluateAll((frames) =>
      frames.filter((f) => {
        const src = f.getAttribute('src') || '';
        const id = f.id || '';
        return /ad|doubleclick|googlesyndication|pubmatic|rubicon|criteo/i.test(src + id);
      }).length
    ).catch(() => 0);
    const visibleAdBlocks = await page.evaluate(() => {
      const sel = '[id*="ad" i], [class*="advert" i], [class*="ad-slot" i], ins.adsbygoogle, iframe';
      let n = 0;
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width >= 80 && r.height >= 50) n++;
      }
      return n;
    }).catch(() => 0);
    if (count > 0 || iframeAds > 0 || visibleAdBlocks > 0) {
      found = true;
      console.log(`✅ ${section}: ads detected (${count} container(s), ${iframeAds} ad iframe(s))`);
      break;
    }
    await page.waitForTimeout(1000);
  }
  if (!found) {
    await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {});
    await scrollThroughPage(page);
    const retryCount = await page.locator(adSelectors).count().catch(() => 0);
    if (retryCount > 0) {
      found = true;
      console.log(`✅ ${section}: ads detected on retry (${retryCount})`);
    }
  }
  if (!found) {
    record(failures, section, 'ads', 'No display ads found after scrolling');
    console.log(`❌ ${section}: no ads detected`);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
}

async function assertUpToDateContent(page: Page, section: string, failures: string[]) {
  const stale = await findStaleArticleDates(page);
  if (stale.length) {
    record(failures, section, 'stale data', `Stale articles (e.g. ${stale.slice(0, 3).join(', ')})`);
  }
  const hasError = await page.evaluate(() => {
    const text = (document.body?.textContent || '').toLowerCase();
    return /\b404\b|\bpage not found\b|\bserver error\b/.test(text);
  });
  if (hasError) {
    record(failures, section, 'stale data', '404 or error text on page');
  }
}

async function findStaleArticleDates(page: Page): Promise<string[]> {
  const cutoff = Date.now() - STALE_ARTICLE_DAYS * 86_400_000;
  return page.evaluate((cutoffMs) => {
    const attrs = ['datetime', 'datatime', 'data-ps-date', 'data-ps-datetime'];
    const stale: string[] = [];
    for (const attr of attrs) {
      for (const el of Array.from(document.querySelectorAll(`time[${attr}], [${attr}]`))) {
        const raw = el.getAttribute(attr);
        if (!raw) continue;
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime()) && d.getTime() < cutoffMs) {
          stale.push(raw.slice(0, 10));
        }
      }
    }
    return Array.from(new Set(stale));
  }, cutoff);
}

const SKIP_IMAGE_HOST = /skysports\.com|youtube\.com|ytimg\.com|facebook\.com|twitter\.com/i;

async function assertBrokenImages(page: Page, section: string, failures: string[], request: APIRequestContext) {
  await scrollThroughPage(page);
  const { broken, totalVisible } = await checkBrokenImages(page, request, { maxHttpChecks: 25 });
  const siteBroken = broken.filter((b) => {
    try {
      const host = new URL(b.src).hostname;
      if (SKIP_IMAGE_HOST.test(host)) return false;
      return host.includes('cricket365') || host.includes('planetsport');
    } catch {
      return true;
    }
  });
  if (siteBroken.length) {
    record(
      failures,
      section,
      'broken images',
      `${siteBroken.length} broken of ${totalVisible} (${siteBroken.slice(0, 2).map((b) => b.src).join('; ')})`
    );
  }
}

async function assertBrokenUrls(
  page: Page,
  request: APIRequestContext,
  section: string,
  failures: string[],
  maxLinks = 40
) {
  const origin = new URL(page.url()).origin;
  const hrefs = await page.$$eval('a[href]', (as) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const a of as as HTMLAnchorElement[]) {
      const href = (a.href || '').trim();
      if (!href || !/^https?:\/\//i.test(href)) continue;
      if (href.endsWith('#') || /#($|\?)/.test(href)) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      out.push(href);
    }
    return out;
  });

  const sameSite = hrefs.filter((h) => {
    try {
      return new URL(h).origin === origin;
    } catch {
      return false;
    }
  });
  const sample = sameSite.slice(0, maxLinks);

  for (const url of sample) {
    if (SKIP_LINK_HOST.test(url)) continue;
    if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) continue;
    let res = await request.fetch(url, { method: 'HEAD', timeout: 10_000 }).catch(() => null);
    let status = res?.status() ?? 0;
    if (!res || status === 405 || status === 403 || status >= 400) {
      res = await request.fetch(url, { method: 'GET', timeout: 12_000 }).catch(() => null);
      status = res?.status() ?? 0;
    }
    if (status >= 400 || status === 0) {
      record(failures, section, 'redirect links', `${url} (${status || 'unreachable'})`);
    }
  }
}

async function collectArticleUrls(page: Page): Promise<string[]> {
  return page.evaluate((origin) => {
    const skip = /\/(matches|author\/|privacy|terms|#|\.jpg|\.png)/i;
    const links = Array.from(document.querySelectorAll('main a[href], article a[href], a[href]')) as HTMLAnchorElement[];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const a of links) {
      const href = a.href;
      if (!href.startsWith(origin)) continue;
      if (skip.test(href)) continue;
      const path = new URL(href).pathname;
      if (path.split('/').filter(Boolean).length < 2) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      out.push(href);
    }
    return out;
  }, SITE_ORIGIN);
}

/** Open up to N random article/tag pages, scroll, and check for errors. */
async function sampleRandomArticles(
  page: Page,
  section: string,
  failures: string[],
  count: number
) {
  const urls = await collectArticleUrls(page);
  if (!urls.length) {
    record(failures, section, 'tags', 'No article links found to sample');
    return;
  }
  const shuffled = [...urls].sort(() => Math.random() - 0.5).slice(0, Math.min(count, urls.length));
  console.log(`📰 ${section}: sampling ${shuffled.length} random article(s)`);

  const returnUrl = page.url();
  for (const url of shuffled) {
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      if ((res?.status() ?? 0) >= 400) {
        record(failures, section, 'tags', `${url} HTTP ${res?.status()}`);
        continue;
      }
      await preparePage(page);
      await scrollThroughPage(page);
      const bad = await page.evaluate(() => {
        const main = document.querySelector('main') || document.body;
        const t = (main?.textContent || '').toLowerCase();
        const h1 = document.querySelector('h1')?.textContent?.toLowerCase() || '';
        return (h1.includes('404') || h1.includes('not found')) && /\b404\b|\bpage not found\b/.test(t);
      });
      if (bad) record(failures, section, 'tags', `404 on article ${url}`);
    } catch (e) {
      record(failures, section, 'tags', `Failed to open ${url}: ${String(e).slice(0, 80)}`);
    }
  }
  await page.goto(returnUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 }).catch(() => {});
  await preparePage(page);
}

async function auditContentSection(
  page: Page,
  request: APIRequestContext,
  section: string,
  failures: string[],
  options: { randomArticles?: number; requireAds?: boolean } = {}
) {
  const { randomArticles = 0, requireAds = true } = options;
  await scrollThroughPage(page);
  await page.waitForTimeout(800);
  if (requireAds) await assertAdsVisible(page, section, failures);
  await assertUpToDateContent(page, section, failures);
  await assertBrokenImages(page, section, failures, request);
  await assertBrokenUrls(page, request, section, failures);
  if (randomArticles > 0) {
    await sampleRandomArticles(page, section, failures, randomArticles);
  }
}

async function clickNavLink(page: Page, dataText: string, fallbackUrl: string) {
  await preparePage(page);
  const link = page.locator(`a.ps-secondary-nav-link[data-text="${dataText}"]`).first();
  const visible = await link.isVisible({ timeout: 8000 }).catch(() => false);
  if (visible) {
    await link.scrollIntoViewIfNeeded().catch(() => {});
    await link.click({ timeout: 10_000, force: true }).catch(async () => {
      await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    });
  } else {
    const navLinks = page.locator('a.ps-secondary-nav-link');
    const nth = dataText === 'Live Scores' ? 1 : -1;
    if (nth >= 0 && (await navLinks.count()) > nth) {
      await navLinks.nth(nth).click({ force: true }).catch(() => page.goto(fallbackUrl));
    } else {
      await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    }
  }
  await page.waitForLoadState('domcontentloaded', { timeout: 20_000 }).catch(() => {});
  await preparePage(page);
}

async function validateLiveScores(page: Page, failures: string[]) {
  const section = 'Live Scores';
  await expect.soft(page).toHaveURL(/\/matches/, { timeout: 10_000 });

  const allTab = page.locator('span.all_tournament_tab').first();
  await expect.soft(allTab, `${section}: All tab visible`).toBeVisible({ timeout: 10_000 });
  await allTab.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const listing = page.locator('app-match-listing');
  await expect.soft(listing.first(), `${section}: match listings present`).toBeVisible({ timeout: 12_000 });

  const h1 = page.locator('.match_full_detail h1, app-match-listing h1').first();
  await expect.soft(h1, `${section}: date heading on All tab`).toContainText(/Live Cricket Scores/i, { timeout: 8000 });

  const matchRows = page.locator('app-match-listing a[href*="match-detail"], app-match-listing .match_status_detail');
  const matchCount = await matchRows.count().catch(() => 0);
  expect.soft(matchCount, `${section}: at least one match listing on All tab`).toBeGreaterThan(0);
  if (matchCount === 0) {
    record(failures, section, 'live centre', 'No match listings on All tab');
  } else {
    console.log(`✅ ${section}: All tab — ${matchCount} match row(s), date heading OK`);
  }

  const finishedTab = page.locator('span:has-text("Finished")').first();
  await finishedTab.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const finishedText = (await listing.first().textContent().catch(() => '')) ?? '';
  const hasWon = /\bwon\b/i.test(finishedText) || /won by/i.test(finishedText);
  expect.soft(hasWon, `${section}: Finished tab shows won status`).toBeTruthy();
  if (!hasWon) {
    record(failures, section, 'live centre', 'Finished tab: no "won" status found in match listings');
  } else {
    console.log(`✅ ${section}: Finished tab — won status present`);
  }

  const upcomingTab = page.locator('span:has-text("Upcoming")').first();
  await upcomingTab.click({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const upcomingText = (await listing.first().textContent().catch(() => '')) ?? '';
  const hasNotStarted = /not started/i.test(upcomingText) || /\bNSY\b/.test(upcomingText);
  expect.soft(hasNotStarted, `${section}: Upcoming tab shows Not started`).toBeTruthy();
  if (!hasNotStarted) {
    record(failures, section, 'live centre', 'Upcoming tab: no "Not started" status found');
  } else {
    console.log(`✅ ${section}: Upcoming tab — Not started status present`);
  }
}

async function validateCountryPages(page: Page, request: APIRequestContext, failures: string[]) {
  const section = 'Countries';
  await clickNavLink(page, NAV.countries.dataText, NAV.countries.url);
  await scrollThroughPage(page);

  const listed = await page
    .locator('a')
    .filter({ has: page.locator('div.text-sm.font-medium.text-white') })
    .count()
    .catch(() => 0);
  expect.soft(listed, `${section}: country list visible`).toBeGreaterThan(0);

  for (const country of EXPECTED_COUNTRIES) {
    const countryUrl = `${SITE_ORIGIN}/${country.slug}`;
    const res = await page.goto(countryUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
    await preparePage(page);

    const url = page.url();
    if ((res?.status() ?? 0) >= 400) {
      record(failures, section, 'country', `${country.name} HTTP ${res?.status()} (${countryUrl})`);
      continue;
    }

    const has404 = await page.evaluate(() => {
      const t = (document.body?.textContent || '').toLowerCase();
      return /\b404\b|\bpage not found\b/.test(t);
    });
    if (has404) {
      record(failures, section, 'country', `${country.name} page 404 (${url})`);
      continue;
    }

    const hasContent = await page.evaluate(() => (document.body?.textContent || '').trim().length > 120);
    if (!hasContent) {
      record(failures, section, 'country', `${country.name} page has little or no content`);
    }

    await assertUpToDateContent(page, `${section} > ${country.name}`, failures);
    await assertBrokenImages(page, `${section} > ${country.name}`, failures, request);

    console.log(`✅ ${section}: ${country.name} loaded (${url})`);
  }
}

function sectionFailed(failures: string[], section: string): string | undefined {
  const hits = failures.filter((f) => f.startsWith(`${section} |`));
  return hits.length ? hits.map((h) => h.split(' | ').slice(1).join(' | ')).join('; ') : undefined;
}

test.describe.serial('Cricket365', () => {
  test.describe.configure({ retries: 0 });

  test('Homepage → Live Scores → Tests → ODI → T20 → Countries', async ({ page, request }, testInfo) => {
    test.setTimeout(25 * 60_000);
    const failures: string[] = [];
    const sectionResults: SectionResult[] = [];

    try {
      console.log('🏏 Cricket365 — starting full site audit');

      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await preparePage(page);
      await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await expect.soft(page).toHaveURL(/cricket365\.com/);

      await auditContentSection(page, request, 'Homepage', failures, {
        randomArticles: RANDOM_ARTICLE_COUNT,
        requireAds: true,
      });
      sectionResults.push({
        name: 'Homepage',
        status: sectionFailed(failures, 'Homepage') ? 'failed' : 'passed',
        error: sectionFailed(failures, 'Homepage'),
      });

      await clickNavLink(page, NAV.liveScores.dataText, NAV.liveScores.url);
      await validateLiveScores(page, failures);
      sectionResults.push({
        name: 'Live Scores',
        status: sectionFailed(failures, 'Live Scores') ? 'failed' : 'passed',
        error: sectionFailed(failures, 'Live Scores'),
      });

      await clickNavLink(page, NAV.tests.dataText, NAV.tests.url);
      await expect.soft(page).toHaveURL(/test-cricket/);
      await auditContentSection(page, request, 'Tests', failures, { requireAds: true });
      sectionResults.push({
        name: 'Tests',
        status: sectionFailed(failures, 'Tests') ? 'failed' : 'passed',
        error: sectionFailed(failures, 'Tests'),
      });

      await clickNavLink(page, NAV.odi.dataText, NAV.odi.url);
      await expect.soft(page).toHaveURL(/odi-cricket/);
      await auditContentSection(page, request, 'ODI', failures, { requireAds: true });
      sectionResults.push({
        name: 'ODI',
        status: sectionFailed(failures, 'ODI') ? 'failed' : 'passed',
        error: sectionFailed(failures, 'ODI'),
      });

      await clickNavLink(page, NAV.t20.dataText, NAV.t20.url);
      await expect.soft(page).toHaveURL(/t20-cricket/);
      await auditContentSection(page, request, 'T20', failures, {
        randomArticles: RANDOM_ARTICLE_COUNT,
        requireAds: true,
      });
      sectionResults.push({
        name: 'T20',
        status: sectionFailed(failures, 'T20') ? 'failed' : 'passed',
        error: sectionFailed(failures, 'T20'),
      });

      await validateCountryPages(page, request, failures);
      sectionResults.push({
        name: 'Countries',
        status: sectionFailed(failures, 'Countries') ? 'failed' : 'passed',
        error: sectionFailed(failures, 'Countries'),
      });
    } finally {
      logSectionResults(sectionResults);
      testInfo.attach('cricket365-failures.json', {
        body: JSON.stringify({ failures, sections: sectionResults }, null, 2),
        contentType: 'application/json',
      });
      if (failures.length) {
        appendEmailReportFailures('Cricket365', failures);
      }
    }

    expect(
      failures,
      `Cricket365 failures (${failures.length}):\n${failures.slice(0, 20).join('\n')}`
    ).toEqual([]);
  });
});
