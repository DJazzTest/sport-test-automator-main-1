import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { appendEmailReportFailures } from '../../Utils/emailReportMerge';

const BASE_URL = 'https://www.planetrugby.com/';
const TEAM_SAMPLE = (process.env.PR_TEAM_SLUG || 'england').toLowerCase();
const MIN_LINKS_TO_TEST = 3;

async function acceptConsent(page: Page): Promise<void> {
  await page.waitForTimeout(800).catch(() => {});
  for (let attempt = 0; attempt < 3; attempt++) {
    const btn = page.locator('button', { hasText: /Accept\s*&\s*Continue/i }).first();
    if (!(await btn.isVisible({ timeout: 1500 }).catch(() => false))) break;
    await btn.click({ timeout: 4000, force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }
  await page.evaluate(() => {
    const cmp = document.getElementById('uniccmp');
    if (cmp) cmp.style.display = 'none';
  }).catch(() => {});
}

async function fetchStatus(request: APIRequestContext, url: string): Promise<number> {
  let res = await request.fetch(url, { method: 'HEAD', timeout: 8000 }).catch(() => null);
  if (!res || res.status() === 405 || res.status() === 501) {
    res = await request.fetch(url, { method: 'GET', timeout: 10000 }).catch(() => null);
  }
  return res?.status() ?? 0;
}

async function assertUrlOk(
  request: APIRequestContext,
  url: string,
  label: string,
  failures: string[],
): Promise<void> {
  const normalized = url.replace(/\/$/, '');
  const status = await fetchStatus(request, normalized);
  if (status >= 400 || status === 0) {
    failures.push(`Broken URL: ${label} | ${normalized} (HTTP ${status || 'unreachable'})`);
    console.log(`❌ ${label}: ${normalized} → HTTP ${status || 'unreachable'}`);
    return;
  }
  console.log(`✅ ${label}: ${normalized} (HTTP ${status})`);
}

test('PlanetRugby – Teams nav → team page → standings widget link checks', async ({ page, request }) => {
  test.setTimeout(5 * 60_000);
  const failures: string[] = [];

  console.log('\n📋 PlanetRugby standings widget flow');
  console.log('1) Open Home → 2) Teams nav → 3) Team page → 4) Check standings/table widget links');

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await acceptConsent(page);

  expect(page.url()).toMatch(/planetrugby\.com\/?$/);
  console.log('✅ Landed on Home (/)');

  // Find Teams nav — PlanetRugby uses the same ps-* selectors as PlanetF1
  const teamsBtn = page.locator('#ps-teams-sub-nav-btn').first();
  const teamsAlt = page.getByRole('button', { name: /Teams/i }).first();
  const teamsNav = (await teamsBtn.isVisible({ timeout: 5000 }).catch(() => false))
    ? teamsBtn
    : teamsAlt;

  await expect(teamsNav, 'Teams nav should be visible').toBeVisible({ timeout: 8000 });
  console.log('✅ Teams nav item found');
  await teamsNav.click({ force: true });
  await page.waitForTimeout(500);

  // Look for team in dropdown — try sub-nav panel first, then any visible team link
  const teamsPanel = page.locator('#ps-teams-sub-nav');
  const panelVisible = await teamsPanel.isVisible({ timeout: 3000 }).catch(() => false);

  let teamLink;
  if (panelVisible) {
    teamLink = teamsPanel.getByRole('link', { name: new RegExp(`^${TEAM_SAMPLE}$`, 'i') });
  } else {
    // Fallback: find team link in any dropdown/tab panel
    const nationalBtn = page.getByRole('button', { name: /National Teams/i }).first();
    if (await nationalBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nationalBtn.click({ timeout: 3000 });
      await page.waitForTimeout(500);
    }
    teamLink = page.locator(`#ps-league-tab-panel-0`).getByRole('link', { name: new RegExp(`^${TEAM_SAMPLE}$`, 'i') }).first();
    if (!(await teamLink.isVisible({ timeout: 3000 }).catch(() => false))) {
      teamLink = page.getByRole('link', { name: new RegExp(`^${TEAM_SAMPLE}$`, 'i') }).first();
    }
  }

  await expect(teamLink!, `Team "${TEAM_SAMPLE}" should appear`).toBeVisible({ timeout: 5000 });
  await teamLink!.click({ force: true });
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
  console.log(`✅ Opened team page: ${page.url()}`);

  // Scroll down to find standings/table widget
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(400);
  }

  // Look for standings widget — PlanetSports platform uses ps-team-standings-lite
  const standingsWidget = page.locator('section.ps-team-standings-lite, [class*="standings"], [class*="table-widget"]').first();
  const hasStandings = await standingsWidget.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasStandings) {
    console.log('✅ Standings widget found');

    // Collect all links within the widget
    const widgetLinks = await standingsWidget.evaluate((section) => {
      const rows = Array.from(section.querySelectorAll('a[href]')).map((a) => ({
        text: (a.textContent || '').trim(),
        href: (a as HTMLAnchorElement).href,
      }));
      const seen = new Set<string>();
      return rows.filter((r) => {
        if (!r.text || /^view more$/i.test(r.text)) return false;
        if (seen.has(r.href)) return false;
        seen.add(r.href);
        return true;
      });
    });

    console.log(`Found ${widgetLinks.length} link(s) in standings widget`);
    const linksToTest = widgetLinks.slice(0, Math.max(MIN_LINKS_TO_TEST, 6));

    for (const { text, href } of linksToTest) {
      await assertUrlOk(request, href, `Standings widget: ${text}`, failures);
    }
  } else {
    console.log('ℹ️ No standings widget found on team page — checking table tab instead');
  }

  // Also check the team's table page for broken links
  const tableUrl = `${page.url().replace(/\/$/, '')}/table`;
  const tableStatus = await fetchStatus(request, tableUrl);
  if (tableStatus >= 400 || tableStatus === 0) {
    failures.push(`Broken URL: Team table page | ${tableUrl} (HTTP ${tableStatus || 'unreachable'})`);
    console.log(`❌ Team table page: ${tableUrl} → HTTP ${tableStatus || 'unreachable'}`);
  } else {
    console.log(`✅ Team table page: ${tableUrl} (HTTP ${tableStatus})`);

    // Navigate to table page and check links within it
    await page.goto(tableUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await acceptConsent(page);
    await page.waitForTimeout(1000);

    const tableLinks = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('main a[href]')).map((a) => ({
        text: (a.textContent || '').trim(),
        href: (a as HTMLAnchorElement).href,
      }));
      const seen = new Set<string>();
      return rows.filter((r) => {
        if (!r.text || seen.has(r.href)) return false;
        seen.add(r.href);
        return /\/team\/[^/]+/i.test(r.href);
      });
    });

    console.log(`\n🏉 Testing ${tableLinks.length} team link(s) from table page…`);
    for (const { text, href } of tableLinks.slice(0, 6)) {
      await assertUrlOk(request, href, `Table page team: ${text}`, failures);
    }
  }

  if (failures.length > 0) {
    appendEmailReportFailures('PlanetRugby', failures);
  }

  console.log('\n📋 Broken pages summary');
  if (failures.length === 0) {
    console.log('✅ No broken pages detected in standings/table widgets');
  } else {
    failures.forEach((f, i) => console.log(`${i + 1}. ${f}`));
    throw new Error(`PlanetRugby standings widget: ${failures.length} broken page(s)`);
  }
});
