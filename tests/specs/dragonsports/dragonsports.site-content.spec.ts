/**
 * DragonSports UK — site navigation & content audit
 *
 * Caps: ≤15 random images and ≤15 random URLs per page check (fast sampling).
 */

import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { dismissDragonSportsPopups } from '../../Utils/dragonsportsGate';
import { appendEmailReportFailures } from '../../Utils/emailReportMerge';

const BASE = process.env.DRAGONSPORTS_BASE?.replace(/\/$/, '') || 'https://www.dragonsports.co.uk';
const ENTRY_URL = `${BASE}/rugby/`;
const STALE_DAYS = 365;
const MAX_IMAGES = 15;
const MAX_URLS = 15;
const MAX_ARTICLES = 15;
const MAX_FOOTBALL_CLUBS = Number(process.env.DRAGONSPORTS_MAX_CLUBS || 4);
const URL_FETCH_MS = 8_000;
const ARTICLE_GAP_MS = 600;
const BOT_STATUSES = new Set([403, 429]);

const SKIP_IMG = /sportmonks\.com|i\.ytimg\.com|img\.youtube\.com|data:,|\/_next\/image\?|upload\.wikimedia|pngfind\.com|\/assets\/svg\/|\/logos\/|wp-content\/uploads/i;
const TEAM_TABS = ['Overview', 'DragonBet Results', 'Squad', 'News', 'Videos'];

const SECTION_URLS: Record<string, string> = {
  Tables: `${BASE}/tables/`,
  Fixtures: `${BASE}/fixtures/`,
  Cricket: `${BASE}/cricket/`,
  'Horse Racing': `${BASE}/horse-racing/`,
  'Other Sports': `${BASE}/other-sports/`,
  Video: `${BASE}/video/`,
  'Welsh Rugby': `${BASE}/rugby/`,
};

type Failures = string[];

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function fail(failures: Failures, section: string, tag: string, detail: string) {
  failures.push(`${section} | ${tag} | ${detail}`);
  console.log(`❌ ${section} | ${tag}: ${detail}`);
}

async function prepare(page: Page, url = `${BASE}/`) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
  await dismissDragonSportsPopups(page);
}

/** Primary nav uses role=menuitem (not links). Falls back to direct URL. */
async function openNavSection(page: Page, label: string) {
  await prepare(page);
  const item = page.getByRole('menuitem', { name: new RegExp(`^${label}$`, 'i') }).first();
  if (await item.isVisible({ timeout: 6000 }).catch(() => false)) {
    await item.click({ timeout: 8000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
    await dismissDragonSportsPopups(page);
    return;
  }
  const href = SECTION_URLS[label];
  if (href) {
    await page.goto(href, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await dismissDragonSportsPopups(page);
  }
}

async function scrollPage(page: Page) {
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(100);
  }
}

async function isRateLimited(page: Page): Promise<boolean> {
  const text = (await page.locator('body').textContent().catch(() => '')) || '';
  return /rate limit exceeded/i.test(text);
}

/** Wait for client-rendered main content (SPA sections). */
async function waitForPageContent(page: Page, timeout = 18_000) {
  await page.waitForLoadState('domcontentloaded', { timeout: 12_000 }).catch(() => {});
  await page
    .waitForFunction(
      () => {
        const text = (document.querySelector('main, #content, [role="main"]')?.textContent || document.body?.textContent || '').trim();
        return text.length > 80 && !/rate limit exceeded/i.test(text);
      },
      { timeout }
    )
    .catch(() => {});
  await scrollPage(page);
}

function sectionPathPrefix(label: string): string | null {
  const href = SECTION_URLS[label];
  if (!href) return null;
  const slug = new URL(href).pathname.split('/').filter(Boolean)[0];
  return slug ? `/${slug}/` : null;
}

async function has404(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const t = (main?.textContent || '').toLowerCase();
    const h1 = document.querySelector('h1')?.textContent?.toLowerCase() || '';
    return (h1.includes('404') || h1.includes('not found')) && /\b404\b|page not found/.test(t);
  });
}

async function assertHasContent(page: Page, section: string, failures: Failures) {
  if (await isRateLimited(page)) {
    fail(failures, section, 'rate limit', 'Site rate limited — retry later');
    return;
  }
  const { len, hasMedia } = await page.evaluate(() => {
    const root = document.querySelector('main, #content, [role="main"]') || document.body;
    const len = (root?.textContent || '').trim().length;
    const hasMedia =
      document.querySelectorAll('article, a[href*="/news/"], a[href*="/video/"], iframe, video, table tr').length > 0;
    return { len, hasMedia };
  });
  if (len < 80 && !hasMedia) fail(failures, section, 'content', 'Page has little or no main content');
  if (await has404(page)) fail(failures, section, '404', `404 or not-found on ${page.url()}`);
}

async function checkStale(page: Page, section: string, failures: Failures) {
  const cutoff = Date.now() - STALE_DAYS * 86_400_000;
  const stale = await page.evaluate((cutoffMs) => {
    const out: string[] = [];
    for (const el of document.querySelectorAll('[datetime], [data-ps-date], [data-ps-datetime]')) {
      const raw = el.getAttribute('datetime') || el.getAttribute('data-ps-date') || el.getAttribute('data-ps-datetime');
      if (!raw) continue;
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime()) && d.getTime() < cutoffMs) out.push(raw.slice(0, 10));
    }
    return [...new Set(out)];
  }, cutoff);
  if (stale.length) fail(failures, section, 'stale', `Old content dates: ${stale.slice(0, 3).join(', ')}`);
}

/** Sample up to MAX_IMAGES random visible images on the page. */
async function checkBrokenImages(page: Page, section: string, failures: Failures) {
  const total = await page.locator('img').count().catch(() => 0);
  const indices = shuffle(Array.from({ length: total }, (_, i) => i)).slice(0, MAX_IMAGES);
  const broken: string[] = [];
  let checked = 0;

  for (const i of indices) {
    const img = page.locator('img').nth(i);
    const src = (await img.getAttribute('src').catch(() => '')) || '';
    if (!src || SKIP_IMG.test(src)) continue;
    if (!(await img.isVisible({ timeout: 500 }).catch(() => false))) continue;
    checked++;
    await img.scrollIntoViewIfNeeded().catch(() => {});
    const ok = await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0).catch(() => true);
    if (!ok) broken.push(src);
  }

  if (broken.length) fail(failures, section, 'broken images', `${broken.length} broken of ${checked} sampled`);
  else console.log(`✅ ${section}: images OK (${checked} random sample)`);
}

/** Sample up to MAX_URLS random same-site links (GET). */
async function checkBrokenUrls(page: Page, request: APIRequestContext, section: string, failures: Failures) {
  const origin = new URL(page.url()).origin;
  const hrefs = await page.$$eval('main a[href]', (as) => {
    const s = new Set<string>();
    for (const a of as as HTMLAnchorElement[]) {
      const h = a.href;
      if (h && /^https?:/.test(h)) s.add(h);
    }
    return [...s];
  });
  const same = hrefs.filter((h) => {
    try {
      return new URL(h).origin === origin;
    } catch {
      return false;
    }
  });
  const sample = shuffle(same.filter((u) => !/\.(jpg|png|gif|webp)(\?|$)/i.test(u))).slice(0, MAX_URLS);

  for (const url of sample) {
    const res = await request.fetch(url, { method: 'GET', timeout: URL_FETCH_MS }).catch(() => null);
    const status = res?.status() ?? 0;
    if (BOT_STATUSES.has(status)) continue;
    if (status >= 400) fail(failures, section, 'broken urls', `${url} (${status})`);
  }
  console.log(`✅ ${section}: ${sample.length} URL(s) sampled`);
}

async function sampleArticles(page: Page, section: string, failures: Failures, count: number) {
  const origin = new URL(page.url()).origin;
  const pathPrefix = sectionPathPrefix(section);
  const urls = await page.evaluate(
    ({ siteOrigin, prefix }) => {
      const skip = /\/(tag\/|author\/|#|\.(jpg|png|gif|webp)$)/i;
      const out: string[] = [];
      const seen = new Set<string>();
      const anchors = document.querySelectorAll(
        'main a[href], #content a[href], article a[href], a[href*="/news/"]'
      ) as NodeListOf<HTMLAnchorElement>;
      for (const a of anchors) {
        const h = a.href;
        if (!h.startsWith(siteOrigin) || skip.test(h)) continue;
        const pathname = new URL(h).pathname;
        if (prefix && !pathname.startsWith(prefix)) continue;
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length < 2) continue;
        if (!h.includes('/news/') && parts.length < 3) continue;
        if (seen.has(h)) continue;
        seen.add(h);
        out.push(h);
      }
      return out;
    },
    { siteOrigin: origin, prefix: pathPrefix }
  );
  const sample = shuffle(urls).slice(0, Math.min(count, urls.length));
  console.log(`📰 ${section}: ${sample.length} random article(s)${pathPrefix ? ` (${pathPrefix}*)` : ''}`);
  const back = page.url();
  for (const url of sample) {
    if (await isRateLimited(page)) {
      console.log('⚠️ Rate limited — skipping remaining article checks');
      break;
    }
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => null);
    const status = res?.status() ?? 0;
    if (await isRateLimited(page)) {
      console.log(`⚠️ Rate limited after ${url} — stopping articles`);
      break;
    }
    if (BOT_STATUSES.has(status)) {
      const ok = await page.evaluate(() => {
        const t = (document.querySelector('main, article')?.textContent || '').trim();
        return t.length > 200 && !/rate limit exceeded/i.test(t);
      });
      if (!ok) console.log(`⚠️ ${url} HTTP ${status} (bot protection) — skipped`);
    } else if (!res || status >= 400) {
      fail(failures, section, 'articles', `${url} HTTP ${status || 'fail'}`);
    } else if (await has404(page)) {
      fail(failures, section, 'articles', `404 on ${url}`);
    }
    await page.waitForTimeout(ARTICLE_GAP_MS);
  }
  await page.goto(back, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await dismissDragonSportsPopups(page);
}

async function auditSection(
  page: Page,
  request: APIRequestContext,
  section: string,
  failures: Failures,
  opts: { articles?: number; stale?: boolean } = {}
) {
  await waitForPageContent(page);
  await assertHasContent(page, section, failures);
  if (opts.stale !== false) await checkStale(page, section, failures);
  await checkBrokenImages(page, section, failures);
  await checkBrokenUrls(page, request, section, failures);
  if (opts.articles) await sampleArticles(page, section, failures, opts.articles);
}

async function openNavMega(page: Page, label: string) {
  const item = page.getByRole('menuitem', { name: new RegExp(label, 'i') }).first();
  await expect(item, `Nav menuitem ${label}`).toBeVisible({ timeout: 10_000 });
  await item.click({ timeout: 8000 });
  await page.waitForTimeout(500);
}

async function testWelshFootballTeams(page: Page, request: APIRequestContext, failures: Failures) {
  const section = 'Welsh Football';
  console.log(`\n⚽ ${section}`);

  await prepare(page);
  await openNavMega(page, 'Welsh Football');

  const teamHrefs = await page.locator('a.ds-mega__team[href*="/football/"]').evaluateAll((els) =>
    els.map((a) => (a as HTMLAnchorElement).href).filter(Boolean)
  );
  const teams = shuffle([...new Set(teamHrefs)]).slice(0, MAX_FOOTBALL_CLUBS);
  console.log(`📋 ${teams.length} club(s) (max ${MAX_FOOTBALL_CLUBS})`);

  for (const teamUrl of teams) {
    const teamName = teamUrl.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || teamUrl;
    console.log(`\n⚽ ${teamName}`);

    const res = await page.goto(teamUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await dismissDragonSportsPopups(page);
    if (!res || res.status() >= 400) {
      fail(failures, section, teamName, `HTTP ${res?.status() ?? 'fail'}`);
      continue;
    }
    await scrollPage(page);
    await assertHasContent(page, `${section} > ${teamName}`, failures);
    await checkBrokenImages(page, `${section} > ${teamName}`, failures);
    await checkBrokenUrls(page, request, `${section} > ${teamName}`, failures);

    for (const tabName of TEAM_TABS) {
      const tab = page.getByRole('link', { name: new RegExp(`^${tabName}$`, 'i') }).first();
      if (!(await tab.isVisible({ timeout: 2000 }).catch(() => false))) continue;
      console.log(`   📑 ${tabName}`);
      await tab.click({ timeout: 6000 }).catch(() => {});
      await page.waitForLoadState('domcontentloaded', { timeout: 12_000 }).catch(() => {});
      await dismissDragonSportsPopups(page);
      await assertHasContent(page, `${section} > ${teamName} > ${tabName}`, failures);
    }
  }
}

async function testWelshRugby(page: Page, request: APIRequestContext, failures: Failures) {
  console.log('\n🏉 Welsh Rugby');
  await prepare(page, `${BASE}/rugby/`);

  const rugbyTrigger = page.locator('button.ds-nav__trigger').filter({ hasText: /Welsh Rugby/i }).first();
  if (await rugbyTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await rugbyTrigger.click({ timeout: 6000 }).catch(() => {});
    const news = page.getByRole('link', { name: /^News$/i }).first();
    if (await news.isVisible({ timeout: 3000 }).catch(() => false)) await news.click({ timeout: 6000 }).catch(() => {});
  }

  if (!page.url().includes('/rugby')) {
    await page.goto(`${BASE}/rugby/`, { waitUntil: 'domcontentloaded' });
    await dismissDragonSportsPopups(page);
  }
  await auditSection(page, request, 'Welsh Rugby', failures, { articles: MAX_ARTICLES });
}

async function testTables(page: Page, failures: Failures) {
  console.log('\n📊 Tables');
  await openNavSection(page, 'Tables');
  await waitForPageContent(page);
  if (await isRateLimited(page)) {
    fail(failures, 'Tables', 'rate limit', 'Site rate limited — retry later');
    return;
  }
  const hasData = await page.evaluate(() => {
    const text = (document.querySelector('main, #content')?.textContent || document.body?.textContent || '').toLowerCase();
    if (/\b404\b/.test(text) || /rate limit/.test(text)) return false;
    if (document.querySelector('table tr, [class*="standings"], [class*="league-table"]')) return true;
    return /standings|league table|position|played|points/.test(text) && text.trim().length > 100;
  });
  if (hasData) console.log('✅ Tables: data present');
  else fail(failures, 'Tables', 'data', 'No table data visible');
}

async function testFixtures(page: Page, failures: Failures) {
  console.log('\n📅 Fixtures');
  await openNavSection(page, 'Fixtures');
  await waitForPageContent(page);
  if (await isRateLimited(page)) {
    fail(failures, 'Fixtures', 'rate limit', 'Site rate limited — retry later');
    return;
  }
  const text = ((await page.locator('main, #content, body').first().textContent().catch(() => '')) || '').toLowerCase();
  if (/no upcoming fixtures?/i.test(text) || /no fixtures scheduled/i.test(text)) {
    console.log('✅ Fixtures: no upcoming (expected pass)');
  } else if (
    text.length > 100 &&
    (text.includes(' v ') || text.includes(' vs ') || /\d{1,2}:\d{2}/.test(text) || /fixture/i.test(text))
  ) {
    console.log('✅ Fixtures: data present');
  } else fail(failures, 'Fixtures', 'data', 'No fixtures message and no fixture data');
}

async function testNavSection(page: Page, request: APIRequestContext, label: string, failures: Failures) {
  console.log(`\n📂 ${label}`);
  await openNavSection(page, label);
  await auditSection(page, request, label, failures, { articles: MAX_ARTICLES });
}

async function testVideo(page: Page, request: APIRequestContext, failures: Failures) {
  console.log('\n🎥 Video');
  await openNavSection(page, 'Video');
  await auditSection(page, request, 'Video', failures, { articles: 0 });
}

async function testDragonBetAndBetNow(page: Page, failures: Failures) {
  console.log('\n🎰 DragonBet & Bet Now');
  await prepare(page, `${BASE}/rugby/`);
  const dragonBet = page.locator('a.ds-nav__dragonbet').first();
  if (await dragonBet.isVisible({ timeout: 4000 }).catch(() => false)) {
    await dragonBet.click({ timeout: 8000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 12_000 }).catch(() => {});
    if (!/dragonbet/i.test(page.url())) fail(failures, 'DragonBet', 'redirect', page.url());
    else {
      console.log('✅ DragonBet link OK');
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => prepare(page));
    }
  }
  await dismissDragonSportsPopups(page);
  const betNow = page.locator('a.ds-breadcrumbs__bet').first();
  if (await betNow.isVisible({ timeout: 3000 }).catch(() => false)) {
    const href = await betNow.getAttribute('href');
    if (!href || href === '#') fail(failures, 'Bet Now', 'link', 'missing href');
    else console.log('✅ Bet Now link present');
  }
}

async function testFollowTeam(page: Page) {
  console.log('\n👥 Follow team');
  await prepare(page, `${BASE}/rugby/`);
  const follow = page.getByRole('button', { name: /follow team/i }).first();
  if (!(await follow.isVisible({ timeout: 4000 }).catch(() => false))) {
    console.log('ℹ️ Follow team not found — skip');
    return;
  }
  await follow.click({ timeout: 6000 }).catch(() => {});
  if (await page.locator('[role="dialog"]').first().isVisible({ timeout: 4000 }).catch(() => false)) {
    console.log('✅ Follow team popup shown');
  }
}

test('DragonSportsUK – navigation and content audit', async ({ page, request }) => {
  test.setTimeout(15 * 60_000);
  const failures: Failures = [];
  console.log(`⚡ Limits: ${MAX_IMAGES} images & ${MAX_URLS} URLs per page; ${MAX_ARTICLES} articles/section; ${MAX_FOOTBALL_CLUBS} clubs`);

  try {
    await testWelshFootballTeams(page, request, failures);
    await testWelshRugby(page, request, failures);
    await testTables(page, failures);
    await testFixtures(page, failures);
    await testNavSection(page, request, 'Cricket', failures);
    await testNavSection(page, request, 'Horse Racing', failures);
    await testNavSection(page, request, 'Other Sports', failures);
    await testVideo(page, request, failures);
    await testDragonBetAndBetNow(page, failures);
    await testFollowTeam(page);
  } finally {
    console.log('\n--- DragonSports results ---');
    failures.length ? failures.forEach((f) => console.log(`❌ ${f}`)) : console.log('✅ All sections passed');
    if (failures.length) appendEmailReportFailures('DragonSports', failures);
  }

  expect(failures, `DragonSports failures (${failures.length}):\n${failures.slice(0, 20).join('\n')}`).toEqual([]);
});
