import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { appendEmailReportFailures } from '../../Utils/emailReportMerge';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://www.planetf1.com/';
const TEAM_SAMPLE = (process.env.PF1_TEAM_SLUG || 'audi').toLowerCase();
const MIN_DRIVERS_TO_TEST = 4;
const CONSTRUCTOR_NAMES = ['Mercedes', 'Ferrari'];

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

async function collectWidgetLinks(
  page: Page,
  widget: ReturnType<Page['locator']>,
  tab: 'Drivers' | 'Constructors',
): Promise<Array<{ text: string; href: string }>> {
  const minLinks = tab === 'Drivers' ? MIN_DRIVERS_TO_TEST : 2;

  const readLinks = async () =>
    widget.evaluate((section, tabName) => {
      const rows = Array.from(section.querySelectorAll('a[href]')).map((a) => ({
        text: (a.textContent || '').trim(),
        href: (a as HTMLAnchorElement).href,
      }));
      const seen = new Set<string>();
      return rows.filter((r) => {
        if (!r.text || /^view more$/i.test(r.text)) return false;
        if (seen.has(r.href)) return false;
        seen.add(r.href);
        if (tabName === 'Drivers') {
          return /\/driver\/[^/]+/i.test(r.href) && !/\/drivers\/?$/i.test(r.href);
        }
        return /\/f1-teams\/[^/]+/i.test(r.href);
      });
    }, tab);

  let links = await readLinks();
  if (links.length >= minLinks) return links;

  await widget.evaluate((section, tabName) => {
    const tabEl = Array.from(section.querySelectorAll('li')).find((li) =>
      new RegExp(`^${tabName}$`, 'i').test((li.textContent || '').trim()),
    );
    (tabEl as HTMLElement | undefined)?.click();
  }, tab);
  await page.waitForTimeout(1500);
  links = await readLinks();

  if (links.length < minLinks) {
    await widget.locator('li').filter({ hasText: new RegExp(`^${tab}$`) }).click({ force: true });
    await page.waitForTimeout(1500);
    links = await readLinks();
  }

  return links;
}

test('PlanetF1 – Teams nav → team page → Championship Standings widget links', async ({ page, request }) => {
  test.setTimeout(5 * 60_000);
  const failures: string[] = [];

  console.log('\n📋 PlanetF1 team standings widget flow');
  console.log('1) Open Home → 2) Teams nav dropdown → 3) Team page → 4) Standings widget Drivers/Constructors links');

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await acceptConsent(page);

  expect(page.url()).toMatch(/planetf1\.com\/?$/);
  console.log('✅ Landed on Home (/)');

  const teamsBtn = page.locator('#ps-teams-sub-nav-btn');
  await expect(teamsBtn, 'Teams nav (5th item) should be visible').toBeVisible({ timeout: 8000 });
  const teamsLabel = (await teamsBtn.locator('span').first().textContent())?.trim();
  expect(teamsLabel, 'Teams nav label').toMatch(/^Teams$/i);
  console.log('✅ Teams nav item found');
  await teamsBtn.click({ force: true });
  await teamsBtn.hover({ force: true }).catch(() => {});
  await page.waitForTimeout(500);

  const teamsPanel = page.locator('#ps-teams-sub-nav');
  await expect(teamsPanel, 'Teams dropdown panel should open').toBeVisible({ timeout: 8000 });

  const teamLink = teamsPanel.getByRole('link', { name: new RegExp(`^${TEAM_SAMPLE}$`, 'i') });
  await expect(teamLink, `Team "${TEAM_SAMPLE}" should appear in dropdown`).toBeVisible({ timeout: 5000 });
  const expectedTeamUrl = `${BASE_URL}team/${TEAM_SAMPLE}`;
  await teamLink.click({ force: true });
  await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
  expect(normalizePath(page.url())).toBe(normalizePath(expectedTeamUrl));
  console.log(`✅ Opened team page: ${page.url()}`);

  const widget = page.locator('section.ps-team-standings-lite');
  await widget.scrollIntoViewIfNeeded({ timeout: 15000 });
  await expect(widget.getByText(/Championship Standings/i)).toBeVisible({ timeout: 8000 });
  await widget.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 15000 });
  console.log('✅ Championship Standings widget visible (lazy-loaded)');

  const driverLinks = await collectWidgetLinks(page, widget, 'Drivers');
  expect(driverLinks.length, 'Standings widget should list driver links').toBeGreaterThanOrEqual(MIN_DRIVERS_TO_TEST);

  const constructorLinks = await collectWidgetLinks(page, widget, 'Constructors');
  expect(constructorLinks.length, 'Constructors tab should list team links').toBeGreaterThan(0);

  const driversToTest = driverLinks.slice(0, MIN_DRIVERS_TO_TEST);
  console.log(`\n👤 Testing ${driversToTest.length} driver link(s) from widget…`);
  for (const { text, href } of driversToTest) {
    await assertUrlOk(request, href, `Standings widget driver: ${text}`, failures);
  }

  console.log(`\n🏁 Testing constructor link(s) from widget…`);
  const priority = constructorLinks.filter((l) =>
    CONSTRUCTOR_NAMES.some((name) => new RegExp(`^${name}$`, 'i').test(l.text)),
  );
  const remainder = constructorLinks.filter((l) => !priority.includes(l));
  const constructorsToTest = [...priority, ...remainder].slice(0, Math.max(CONSTRUCTOR_NAMES.length, 4));

  for (const { text, href } of constructorsToTest) {
    await assertUrlOk(request, href, `Standings widget constructor: ${text}`, failures);
  }

  const reportDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(reportDir, { recursive: true });
  if (failures.length > 0) {
    appendEmailReportFailures('PlanetF1', failures);
  }

  console.log('\n📋 Broken pages summary');
  if (failures.length === 0) {
    console.log('✅ No broken driver or constructor pages detected');
  } else {
    failures.forEach((f, i) => console.log(`${i + 1}. ${f}`));
    throw new Error(`PlanetF1 team standings widget: ${failures.length} broken page(s)`);
  }
});

function normalizePath(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.replace(/\/$/, '');
  }
}
