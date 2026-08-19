import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { appendEmailReportFailures } from '../../Utils/emailReportMerge';

const BASE_URL = 'https://www.teamtalk.com/';

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

async function checkLinksInWidget(
  request: APIRequestContext,
  page: Page,
  widgetSelector: string,
  widgetName: string,
  failures: string[],
  maxLinks = 5,
): Promise<void> {
  const widget = page.locator(widgetSelector).first();
  const visible = await widget.isVisible({ timeout: 5000 }).catch(() => false);

  if (!visible) {
    console.log(`ℹ️ "${widgetName}" widget not found on page`);
    return;
  }

  await widget.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  const links = await widget.evaluate((el) => {
    const rows = Array.from(el.querySelectorAll('a[href]')).map((a) => ({
      text: (a.textContent || '').trim(),
      href: (a as HTMLAnchorElement).href,
    }));
    const seen = new Set<string>();
    return rows.filter((r) => {
      if (!r.text || !r.href || seen.has(r.href)) return false;
      if (/^(view more|see all|show more)$/i.test(r.text)) return false;
      seen.add(r.href);
      return r.href.includes('teamtalk.com');
    });
  });

  console.log(`  Found ${links.length} link(s) in "${widgetName}"`);
  const toTest = links.slice(0, maxLinks);

  for (const { text, href } of toTest) {
    const normalized = href.replace(/\/$/, '');
    const status = await fetchStatus(request, normalized);
    if (status >= 400 || status === 0) {
      const msg = `Broken URL: ${widgetName} — "${text}" | ${normalized} (HTTP ${status || 'unreachable'})`;
      failures.push(msg);
      console.log(`  ❌ ${text}: ${normalized} → HTTP ${status || 'unreachable'}`);
    } else {
      console.log(`  ✅ ${text}: ${normalized} (HTTP ${status})`);
    }
  }
}

test('TeamTalk – sidebar widget link checks (Most Read, Editors Picks, Trending)', async ({ page, request }) => {
  test.setTimeout(3 * 60_000);
  const failures: string[] = [];

  console.log('\n📋 TeamTalk sidebar widget link checks');

  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await acceptConsent(page);

  expect(page.url()).toMatch(/teamtalk\.com\/?$/);
  console.log('✅ Landed on Home');

  // Scroll down to load sidebar widgets
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(400);
  }

  // Check common sidebar widget patterns
  const widgetSelectors = [
    { selector: '[class*="most-read"], [class*="mostRead"], [data-widget*="most-read"], aside [class*="popular"]', name: 'Most Read' },
    { selector: '[class*="editor"], [class*="Editor"], [data-widget*="editor"]', name: "Editor's Picks" },
    { selector: '[class*="trending"], [data-widget*="trending"]', name: 'Trending' },
    { selector: 'aside section, aside [class*="widget"]', name: 'Sidebar Widget' },
  ];

  let anyWidgetFound = false;
  for (const { selector, name } of widgetSelectors) {
    const widget = page.locator(selector).first();
    if (await widget.isVisible({ timeout: 2000 }).catch(() => false)) {
      anyWidgetFound = true;
      await checkLinksInWidget(request, page, selector, name, failures);
    }
  }

  if (!anyWidgetFound) {
    // Fallback: check all sidebar links
    console.log('ℹ️ No named widgets found — checking all sidebar links');
    const sidebar = page.locator('aside').first();
    if (await sidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkLinksInWidget(request, page, 'aside', 'Sidebar', failures, 8);
    }
  }

  // Also check Transfer News page sidebar
  console.log('\n📰 Checking Transfer News page sidebar…');
  await page.goto(`${BASE_URL}transfer-news`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await acceptConsent(page);
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(300);
  }

  for (const { selector, name } of widgetSelectors.slice(0, 3)) {
    const widget = page.locator(selector).first();
    if (await widget.isVisible({ timeout: 2000 }).catch(() => false)) {
      await checkLinksInWidget(request, page, selector, `Transfer News — ${name}`, failures);
    }
  }

  if (failures.length > 0) {
    appendEmailReportFailures('TeamTalk', failures);
  }

  console.log('\n📋 Broken pages summary');
  if (failures.length === 0) {
    console.log('✅ No broken sidebar widget links detected');
  } else {
    failures.forEach((f, i) => console.log(`${i + 1}. ${f}`));
    throw new Error(`TeamTalk sidebar widgets: ${failures.length} broken link(s)`);
  }
});
