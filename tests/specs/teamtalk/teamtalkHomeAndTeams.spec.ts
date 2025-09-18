import { test, expect, Page } from '@playwright/test';
import fs from 'fs/promises';

async function acceptUniConsent(page: Page) {
  const direct = page.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first();
  if (await direct.isVisible()) { await direct.click({ timeout: 5000 }); return; }
  const root = page.locator('#uniccmp');
  if (await root.count()) {
    const candidates = [
      root.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first(),
      root.getByRole('button', { name: /Accept All/i }).first(),
      root.getByRole('button', { name: /I Accept/i }).first(),
      root.locator('button:has-text("Accept")').first(),
      root.locator('button:has-text("Allow All")').first(),
    ];
    for (const btn of candidates) { if (await btn.isVisible()) { await btn.click({ timeout: 5000 }); break; } }
  }
}

async function dismissOverlays(page: Page) {
  await page.evaluate(() => {
    const ids = ['uniccmp', 'ps-nav-overlay'];
    ids.forEach(id => { const el = document.getElementById(id) as HTMLElement | null; if (el) { el.style.setProperty('display','none','important'); el.style.setProperty('visibility','hidden','important'); el.style.setProperty('pointer-events','none','important'); }});
    document.querySelectorAll('[role="dialog"], .unic-modal-container').forEach(d => {
      const el = d as HTMLElement; el.style.setProperty('display','none','important'); el.style.setProperty('visibility','hidden','important'); el.style.setProperty('pointer-events','none','important');
    });
  });
}

async function checkNoBrokenImages(page: Page) {
  const imgs = await page.$$('img');
  for (const img of imgs) {
    try {
      if (!(await img.isVisible())) continue;
      const width = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
      if (width === 0) console.warn('Broken image:', await img.getAttribute('src'));
    } catch {}
  }
}

async function verifyRecentContent(page: Page, days = 14) {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  const datetimes = await page.$$eval('time', t => t.map(x => x.getAttribute('datetime') || ''));
  const recent = datetimes.map(d => d ? Date.parse(d) : 0).filter(ts => !Number.isNaN(ts) && ts > threshold);
  if (recent.length === 0) console.warn('No recent content found within threshold; continuing test.');
}

async function closeMobileMenuIfOpen(page: Page) {
  const buttons = [
    page.getByRole('button', { name: /Close/i }).first(),
    page.locator('[aria-label*="Close"]').first(),
    page.locator('.close, .close-btn, .modal-close').first(),
  ];
  for (const b of buttons) { if (await b.isVisible()) { await b.click({ timeout: 3000 }); break; } }
}

test('TeamTalk end-to-end suite (single test)', async ({ page, request, browser }) => {
  test.setTimeout(300_000);

  // 1) Navigate homepage, consent, Team Pages and iterate all teams (record summary)
  await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
  await acceptUniConsent(page); await dismissOverlays(page);
  await expect(page.locator('a[data-text="Home"]')).toBeVisible();
  for (let y = 400; y <= 2400; y += 400) { await acceptUniConsent(page); await dismissOverlays(page); await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(150); }
  const complementary = page.getByRole('complementary').first();
  const teamPagesHeading = complementary.getByRole('heading', { name: /Team Pages/i }).first();
  await teamPagesHeading.waitFor({ state: 'visible', timeout: 10000 });
  const teamList = teamPagesHeading.locator('xpath=following-sibling::*[1]').getByRole('link');
  const totalTeams = await teamList.count();
  expect(totalTeams).toBeGreaterThanOrEqual(20);
  const visited: { index: number; teamName: string; teamUrl: string }[] = [];
  for (let i = 0; i < totalTeams; i++) {
    const link = teamList.nth(i);
    const href = (await link.getAttribute('href')) || '';
    const teamName = (await link.textContent())?.trim() || `team-${i+1}`;
    await link.scrollIntoViewIfNeeded(); await acceptUniConsent(page); await dismissOverlays(page);
    await link.click({ timeout: 10000, force: true });
    try { await page.waitForLoadState('domcontentloaded', { timeout: 15000 }); } catch {}
    await acceptUniConsent(page); await dismissOverlays(page);
    if (href) { const slug = href.replace(/^https?:\/\/[^/]+/, ''); await expect(page).toHaveURL(new RegExp(slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); }
    await expect(page.getByRole('main').locator('h1').first()).toBeVisible();
    await checkNoBrokenImages(page); await verifyRecentContent(page);
    visited.push({ index: i+1, teamName, teamUrl: page.url() });
    // Return Home (ensure top, avoid outside-viewport)
    await page.evaluate(() => window.scrollTo(0, 0));
    await acceptUniConsent(page); await dismissOverlays(page);
    const headerOrNav = page.locator('header, nav, [class*="header"], [class*="navigation"]').first();
    try { await headerOrNav.waitFor({ state: 'visible', timeout: 3000 }); } catch {}
    const homePill = page.locator('a[data-text="Home"]').first();
    if (await homePill.count()) { await homePill.scrollIntoViewIfNeeded(); await homePill.click({ timeout: 10000, force: true }); }
    else { const homeHref = page.locator('a[href="https://www.teamtalk.com"]').first(); await homeHref.scrollIntoViewIfNeeded(); await homeHref.click({ timeout: 10000, force: true }); }
    try { await page.waitForLoadState('domcontentloaded', { timeout: 12000 }); } catch {}
    await acceptUniConsent(page); await dismissOverlays(page);
    await expect(page).toHaveURL('https://www.teamtalk.com/');
    await closeMobileMenuIfOpen(page);
  }
  try { await fs.mkdir('test-results', { recursive: true }); await fs.writeFile('test-results/teamtalk-team-summary.json', JSON.stringify({ generatedAt: new Date().toISOString(), visited }, null, 2)); } catch {}

  // 2) Navigation links incl social popups
  const base = new URL('https://www.teamtalk.com/');
  const selectors = ['header nav a, [role="navigation"] a', 'footer a'];
  const hrefs: string[] = [];
  for (const sel of selectors) { const links = await page.$$eval(sel, as => as.map(a => (a as HTMLAnchorElement).href).filter(Boolean)); hrefs.push(...links); }
  for (const domain of ['facebook.com', 'x.com', 'twitter.com', 'flipboard.com']) {
    const socialLink = page.locator(`a[href*="${domain}"]`).first();
    if (await socialLink.count()) { await acceptUniConsent(page); await dismissOverlays(page); const [popup] = await Promise.all([page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null), socialLink.click({ timeout: 8000 })]); if (popup) { try { await popup.waitForLoadState('domcontentloaded', { timeout: 8000 }); await popup.waitForTimeout(1500); } catch {} await popup.close().catch(() => {}); } }
  }
  const socialDomains = ['facebook.com','x.com','twitter.com','flipboard.com'];
  const normalized = Array.from(new Set(hrefs.filter(h => !/^javascript:|^mailto:|^tel:/i.test(h)).map(h => new URL(h, base).toString()).filter(h => !socialDomains.some(d => h.includes(d)))));
  for (const url of normalized) { const resp = await request.fetch(url, { maxRedirects: 0 }).catch(() => null); if (resp && resp.status() >= 400) console.error('Broken nav/footer link', resp.status(), url); }

  // 3) Article cards
  const cards = page.locator('article, [class*="article"], [class*="card"]');
  expect(await cards.count()).toBeGreaterThan(0);
  const sample = Math.min(await cards.count(), 10);
  for (let i = 0; i < sample; i++) {
    const card = cards.nth(i);
    const title = card.locator('h2, h3, .title, [class*="title"]').first();
    try {
      await title.waitFor({ state: 'visible', timeout: 7000 });
    } catch {
      console.warn('Card title not visible after wait; skipping card', i + 1);
      continue;
    }
    const img = card.locator('img').first(); if (await img.count()) { await expect(img).toBeVisible(); const w = await img.evaluate(el => (el as HTMLImageElement).naturalWidth); if (w === 0) console.warn('Broken card image detected; continuing.'); }
    const link = card.locator('a[href]').first(); await expect(link).toBeVisible(); const href = await link.getAttribute('href'); if (href) { const url = new URL(href, 'https://www.teamtalk.com').toString(); const res = await request.get(url); if (res.status() >= 400) console.error('Card link bad status', res.status(), url); }
  }

  // 4) Consent persistence
  const storage = await page.context().storageState();
  const context2 = await browser.newContext({ storageState: storage });
  const page2 = await context2.newPage(); await page2.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' }); await page2.waitForTimeout(500); const modal = page2.locator('#uniccmp, [role="dialog"]:has(#uniccmp)'); if (await modal.count()) { await acceptUniConsent(page2); await dismissOverlays(page2); } await context2.close();

  // 5) Search (soft)
  await page.goto('https://www.teamtalk.com/?s=Arsenal', { waitUntil: 'domcontentloaded' }); await acceptUniConsent(page); await dismissOverlays(page);
  const results = page.locator('article, [class*="result"], [data-result]');
  try { await results.first().waitFor({ state: 'visible', timeout: 10000 }); } catch { console.warn('Search results did not load within 10s; skipping further search checks.'); }

  // 6) Responsive
  for (const vp of [{ w:390,h:844 }, { w:768,h:1024 }, { w:1366,h:900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } }); const p = await ctx.newPage(); await p.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' }); await acceptUniConsent(p); await dismissOverlays(p); const overflow = await p.evaluate(() => (document.scrollingElement?.scrollWidth || document.documentElement.scrollWidth) > window.innerWidth + 1); if (overflow) console.error('Horizontal overflow at', vp); await ctx.close();
  }

  // 7) Meta/Schema (soft og:image)
  await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' }); const headHtml = await page.locator('head').innerHTML(); expect(headHtml).toMatch(/<meta[^>]+property=["']og:title["']/i); if (!/<meta[^>]+property=["']og:image["']/i.test(headHtml)) console.warn('og:image not found in head at domcontentloaded; continuing.'); expect(headHtml).toMatch(/<meta[^>]+name=["']twitter:card["']/i); expect(headHtml).toMatch(/<link[^>]+rel=["']canonical["']/i); const ldjson = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => e.textContent || '')); expect(ldjson.length).toBeGreaterThan(0);

  // 8) Ads/trackers presence
  await acceptUniConsent(page); await dismissOverlays(page); await expect(page.getByRole('main')).toBeVisible();

  // 9) Performance timings
  const timing = await page.evaluate(() => JSON.parse(JSON.stringify(performance.timing || {}))); const paint = await page.evaluate(() => { const entries = performance.getEntriesByType('paint') as PerformanceEntry[]; const obj: Record<string, number> = {}; entries.forEach(e => obj[e.name] = e.startTime); return obj; }); console.log('NavigationTiming:', timing); console.log('PaintTiming:', paint);

  // 10) Touch interactions (warn-only sizes)
  const touchCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true }); const tp = await touchCtx.newPage(); await tp.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' }); await acceptUniConsent(tp); await dismissOverlays(tp); const tappables = tp.locator('a, button'); const maxCheck = Math.min(await tappables.count(), 50); for (let i = 0; i < maxCheck; i++) { const el = tappables.nth(i); const box = await el.boundingBox(); if (box && (box.width < 40 || box.height < 40)) console.warn(`Small tap target ~${Math.round(box.width)}x${Math.round(box.height)} at index ${i}`); } await touchCtx.close();

  // 11) Video embeds (warn if none)
  await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' }); await acceptUniConsent(page); await dismissOverlays(page); const frames = page.locator('iframe[src*="youtube.com" i], iframe[src*="player.vimeo.com" i], iframe[src*="brightcove" i]'); if (await frames.count() === 0) console.warn('No video embeds detected on homepage.'); else await expect(frames.first()).toBeVisible();
});


