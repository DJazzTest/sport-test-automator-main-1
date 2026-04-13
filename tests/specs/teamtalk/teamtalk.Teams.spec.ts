import { test, expect, Page, APIRequestContext } from '@playwright/test';

function isTeamTalkHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'www.teamtalk.com' || host === 'teamtalk.com';
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return url;
  }
}

async function acceptUniConsent(page: Page) {
  await page.waitForTimeout(800);
  const direct = page.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first();
  if (await direct.isVisible()) {
    await direct.click({ timeout: 5000 });
    return;
  }
}

async function dismissOverlays(page: Page) {
  await page.evaluate(() => {
    const ids = ['uniccmp', 'ps-nav-overlay'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
        (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
        (el as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
      }
    });
    document.querySelectorAll('[role="dialog"], .unic-modal-container').forEach(d => {
      const el = d as HTMLElement;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    });
  });
}

async function checkNoBrokenImages(page: Page, sectionName: string, emailFailures?: string[]) {
  const imgs = await page.$$('img');
  for (const img of imgs) {
    try {
      if (!(await img.isVisible())) continue;
      await img.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(250);
      const width = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
      if (width === 0) {
        const src = await img.getAttribute('src').catch(() => '');
        if (!src) continue;
        const absolute = src.startsWith('http') ? src : new URL(src, page.url()).toString();
        if (absolute.includes('doubleclick') || absolute.includes('googletagmanager') || absolute.includes('google-analytics')) continue;
        if (emailFailures) emailFailures.push(`Broken image: ${sectionName}|${absolute}`);
      }
    } catch {}
  }
}

async function checkAdsPresence(page: Page) {
  const adSelectors = ['[id*="ad" i]', '[class*="ad" i]', '[data-ad]'];
  const count = await page.locator(adSelectors.join(',')).count().catch(() => 0);
  console.log(`Ad containers found: ${count}`);
}

async function checkErrorMarkers(page: Page, sectionName: string, emailFailures?: string[]) {
  const hasError = await page.evaluate(() => {
    const main = document.querySelector('main');
    const text = (main?.textContent || '').toLowerCase();
    return /\b404\b|\bserver error\b|\bfatal error\b/.test(text);
  });

  if (hasError && emailFailures) emailFailures.push(`${sectionName}: 404/server error in main content`);
  expect(hasError, `Detected 404/server error markers in main content for ${sectionName}`).toBeFalsy();
}

async function checkStaleArticlesOnPage(page: Page, sectionName: string, emailFailures?: string[]) {
  const thresholdDays = 365;
  const now = Date.now();
  const maxAgeMs = thresholdDays * 24 * 60 * 60 * 1000;

  const rawDates: string[] = await page.evaluate(() => {
    const main = document.querySelector('main');
    const text = (main?.textContent || '').replace(/\s+/g, ' ') || '';
    const pattern = /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/gi;
    const dates: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) dates.push(match[0]);
    return Array.from(new Set(dates));
  });

  const staleSamples = rawDates
    .map(d => ({ d, parsed: Date.parse(d) }))
    .filter(({ parsed }) => !Number.isNaN(parsed) && now - parsed > maxAgeMs)
    .map(({ d }) => d);

  if (!staleSamples.length) return;
  const msg = `${sectionName}: stale articles detected (e.g. ${Array.from(new Set(staleSamples)).slice(0, 3).join(', ')})`;
  console.warn(`⚠️ ${msg}`);
  if (emailFailures) emailFailures.push(msg);
}

async function checkBrokenLinksAndErrors(
  page: Page,
  request: APIRequestContext,
  sectionName: string,
  maxLinks = 20,
  emailFailures?: string[]
) {
  const hrefs = await page.$$eval('main a[href]', (as: Element[]) =>
    Array.from(new Set((as as HTMLAnchorElement[]).map(a => (a as HTMLAnchorElement).href).filter(Boolean)))
  );
  const firstParty = hrefs.map(normalizeUrl).filter((url, idx, arr) => arr.indexOf(url) === idx).filter(isTeamTalkHost);
  const sample = firstParty.length > maxLinks ? firstParty.sort(() => Math.random() - 0.5).slice(0, maxLinks) : firstParty;
  const broken: Array<{ url: string; status: number }> = [];

  for (const url of sample) {
    if (!/^https?:/i.test(url)) continue;
    const lower = url.toLowerCase();
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp') || lower.includes('/content/uploads/')) continue;
    try {
      let res = await request.fetch(url, { method: 'HEAD', timeout: 5000 }).catch(() => null);
      if (!res || res.status() === 405 || res.status() === 501) {
        res = await request.fetch(url, { method: 'GET', timeout: 7000 }).catch(() => null);
      }
      const status = res?.status() ?? -1;
      if (status >= 400 || status < 0) broken.push({ url, status });
    } catch {
      broken.push({ url, status: -1 });
    }
  }

  if (emailFailures) {
    broken.slice(0, 20).forEach(b => {
      if (b.status >= 400) emailFailures.push(`Broken URL: ${sectionName}>${b.url} (${b.status})`);
      else emailFailures.push(`Unreachable in test: ${sectionName}>${b.url}`);
    });
  }

  await checkErrorMarkers(page, sectionName, emailFailures);
  await checkStaleArticlesOnPage(page, sectionName, emailFailures);
}

async function drillIntoRandomTagsAndLinks(page: Page, request: APIRequestContext, sectionName: string, emailFailures?: string[]) {
  const baseUrl = page.url();
  const tagLinks = await page.$$eval('main a[href*="/tag/"]', (as: Element[]) =>
    Array.from(new Set((as as HTMLAnchorElement[]).map(a => a.href).filter(Boolean)))
  ).catch(() => []);
  const generalLinks = await page.$$eval('main a[href]', (as: Element[]) =>
    Array.from(new Set((as as HTMLAnchorElement[]).map(a => a.href).filter(Boolean)))
  ).catch(() => []);
  const sample = (arr: string[], max: number) =>
    arr.map(normalizeUrl).filter((url, idx, list) => list.indexOf(url) === idx).filter(isTeamTalkHost).sort(() => Math.random() - 0.5).slice(0, max);
  const targets = Array.from(new Set([...sample(tagLinks, 2), ...sample(generalLinks.filter((u) => !u.includes('/tag/')), 2)]));

  for (const target of targets) {
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await acceptUniConsent(page);
      await dismissOverlays(page);
      await checkNoBrokenImages(page, `${sectionName} (drill)`, emailFailures);
      await checkErrorMarkers(page, `${sectionName} drill>${target}`, emailFailures);
      await checkBrokenLinksAndErrors(page, request, `${sectionName} drill>${target}`, 8, emailFailures);
    } catch {
      if (emailFailures) emailFailures.push(`Unreachable in test: ${sectionName} drill>${target}`);
    } finally {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
      await acceptUniConsent(page);
      await dismissOverlays(page);
    }
  }
}

async function visitSectionAndAudit(
  page: Page,
  request: APIRequestContext,
  label: string,
  url: string,
  emailFailures?: string[],
  maxLinks: number = 20
) {
  console.log(`\n===== ${label.toUpperCase()} =====`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await acceptUniConsent(page);
  await dismissOverlays(page);
  for (let s = 0; s < 3; s++) {
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await checkNoBrokenImages(page, label, emailFailures);
  await checkAdsPresence(page);
  await checkBrokenLinksAndErrors(page, request, label, maxLinks, emailFailures);
  await drillIntoRandomTagsAndLinks(page, request, label, emailFailures);
}

test('TeamTalk Teams: full team tabs coverage', async ({ page, request }) => {
  test.setTimeout(30 * 60_000);
  const emailFailures: string[] = [];

  const defaultTeams = [
    'Arsenal',
    'Aston Villa',
    'Chelsea',
    'Leeds',
    'Newcastle United',
    'Crystal Palace',
    'Liverpool',
    'Real Madrid',
    'Barcelona',
    'Everton',
    'Manchester City',
    'Tottenham Hotspur',
    'Bayern Munich',
    'Juventus',
    'Manchester United',
    'West Ham',
  ];
  const envMaxTeams = parseInt(process.env.MAX_TEAMS || `${defaultTeams.length}`, 10);
  const maxTeams = Number.isNaN(envMaxTeams) ? defaultTeams.length : envMaxTeams;
  const teamNames = defaultTeams.slice(0, maxTeams);
  const teamTabs = ['Overview', 'News', 'Fixtures', 'Results', 'Squad', 'Stats'] as const;

  for (const teamName of teamNames) {
    const slug = teamName.toLowerCase().replace(/\s+/g, '-');
    const baseUrl = `https://www.teamtalk.com/team/${slug}`;
    for (const tab of teamTabs) {
      const tabUrl = tab === 'Overview' ? baseUrl : `${baseUrl}/${tab.toLowerCase()}`;
      await visitSectionAndAudit(page, request, `${teamName} – ${tab}`, tabUrl, emailFailures, 40);
    }
  }

  try {
    const fs = await import('fs');
    const path = await import('path');
    const reportDir = path.join(process.cwd(), 'test-results');
    const reportPath = path.join(reportDir, 'email-report.json');
    fs.mkdirSync(reportDir, { recursive: true });
    let mergedFailures: string[] = [];
    if (fs.existsSync(reportPath)) {
      try {
        const previous = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        if (previous?.siteName === 'TeamTalk' && Array.isArray(previous?.failures)) mergedFailures = previous.failures;
      } catch {}
    }
    const deduped = Array.from(new Set([...mergedFailures, ...emailFailures]));
    fs.writeFileSync(reportPath, JSON.stringify({ siteName: 'TeamTalk', failures: deduped }, null, 0));
  } catch {}
});
