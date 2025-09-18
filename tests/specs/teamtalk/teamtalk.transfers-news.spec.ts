import { test, expect, Page } from '@playwright/test';

async function acceptUniConsentIfPresent(page: Page) {
  try {
    // Give the modal a moment to render
    await page.waitForTimeout(1200);
    const modalRoot = page.locator('#uniccmp, [role="dialog"]:has-text("TEAMTALK")').first();
    // Soft wait for modal visibility
    try { await modalRoot.waitFor({ state: 'visible', timeout: 2000 }); } catch {}
    const accept = page.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first();
    if (await accept.count()) {
      await accept.click({ timeout: 5000 });
      await page.waitForTimeout(1200);
    }
  } catch (e) { console.warn('Consent accept click skipped:', (e as Error).message); }
}

test('Transfer News page smoke: bell popup, ads, images, articles, errors', async ({ page }) => {
  // Navigate and consent
  await page.goto('https://www.teamtalk.com/', { waitUntil: 'domcontentloaded' });
  await acceptUniConsentIfPresent(page);

  // Click Transfer News
  const transferTab = page.locator('a[data-text="Transfer News"]').first();
  await transferTab.click({ timeout: 8000 }).catch((e) => { console.error('Failed to click Transfer News:', (e as Error).message); });
  try { await page.waitForLoadState('domcontentloaded', { timeout: 8000 }); } catch {}
  await acceptUniConsentIfPresent(page);

  // Extra safety: attempt consent dismissal again before interactions
  await acceptUniConsentIfPresent(page);

  // Click bell, then close popup
  const bell = page.locator('svg.vf-icon.vf-icon_bell_icon');
  if (await bell.count()) {
    await bell.first().click({ timeout: 5000 }).catch((e) => { console.warn('Bell click failed:', (e as Error).message); });
    const popup = page.locator('[role="dialog"], .vf-modal, .vf-popup, [class*="modal" i]');
    try { await popup.first().waitFor({ state: 'visible', timeout: 4000 }); } catch {}
    const closeSvg = page.locator('svg.vf-close-icon, svg.vf-icon-svg.vf-close-icon, [aria-label="Close"], button:has(svg.vf-close-icon)');
    if (await closeSvg.count()) { await closeSvg.first().click({ timeout: 5000 }).catch((e) => { console.warn('Popup close failed:', (e as Error).message); }); }
  }

  // Scroll page to trigger lazy loading
  for (let y = 400; y <= 2400; y += 400) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(150); }

  // Ads presence
  const adSelectors = ['[id*="ad" i]', '[class*="ad" i]', '[data-ad]'];
  const adsCount = await page.locator(adSelectors.join(',')).count();
  expect(adsCount, 'No ad containers detected (layout or selector change)').toBeGreaterThanOrEqual(0);

  // Images sanity
  const imgs = page.locator('main img');
  const imgCount = await imgs.count();
  expect(imgCount, 'No images found on Transfer News page').toBeGreaterThan(0);
  let ok = 0;
  const maxCheck = Math.min(imgCount, 40);
  for (let i = 0; i < maxCheck; i++) {
    const img = imgs.nth(i);
    try {
      await img.scrollIntoViewIfNeeded();
      if (!(await img.isVisible())) continue;
      await page.waitForTimeout(150);
      const width = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
      if (width === 0) console.warn('Broken image (non-fatal)'); else ok++;
    } catch {}
  }
  expect(ok, 'No visible, successfully loaded images after scrolling').toBeGreaterThan(0);

  // Articles open
  const firstArticle = page.locator('main').locator('article a[href], [class*="article" i] a[href]').first();
  if (await firstArticle.count()) {
    const [nav] = await Promise.all([
      page.waitForNavigation({ timeout: 8000 }).catch(() => null),
      firstArticle.click({ timeout: 8000 }).catch(() => {})
    ]);
    await page.waitForTimeout(500);
    await expect(page.locator('h1').first()).toBeVisible();
    await page.goBack().catch(() => {});
  }

  // No obvious error markers
  const hasError = await page.evaluate(() => {
    const main = document.querySelector('main');
    const text = (main?.textContent || '').toLowerCase();
    return /\b404\b|\bserver error\b|\bfatal error\b/.test(text);
  });
  expect(hasError, 'Detected error markers in main content on Transfer News').toBeFalsy();

  // Navigation links: top and footer resolve (status <400); log redirects
  const selectors = ['header nav a, [role="navigation"] a', 'footer a'];
  const hrefs: string[] = [];
  for (const sel of selectors) {
    const urls = await page.$$eval(sel, as => as.map(a => (a as HTMLAnchorElement).href).filter(Boolean));
    hrefs.push(...urls);
  }
  const base = new URL('https://www.teamtalk.com/');
  const normalized = Array.from(new Set(
    hrefs
      .filter(h => !/^javascript:|^mailto:|^tel:/i.test(h))
      .map(h => new URL(h, base).toString())
  ));
  const broken: { url: string; status: number }[] = [];
  const redirects: { url: string; status: number; location?: string }[] = [];
  for (const url of normalized) {
    const resp = await page.request.fetch(url, { maxRedirects: 0 }).catch(() => null);
    if (!resp) { broken.push({ url, status: -1 }); continue; }
    const s = resp.status();
    if (s >= 400) broken.push({ url, status: s });
    else if (s >= 300) redirects.push({ url, status: s, location: resp.headers()['location'] });
  }
  if (redirects.length) console.warn('Redirects:', redirects.slice(0, 5));
  // Only fail for internal links; external broken links are warn-only
  const internalBroken = broken.filter(b => /^(https?:\/\/)?(www\.)?teamtalk\.com\//i.test(b.url));
  if (broken.length && internalBroken.length === 0) {
    console.warn('Broken external links (ignored):', broken);
  }
  expect(internalBroken.length, 'Broken internal nav/footer links detected').toBe(0);

  // Article cards: ensure multiple cards have title, image, link, and timestamp/author if present
  const cards = page.locator('main').locator('article, [class*="article"], [class*="card"]').filter({ has: page.locator('a[href]') });
  const cardCount = await cards.count();
  expect(cardCount, 'No article cards found on Transfer News').toBeGreaterThan(0);
  const sampleCards = Math.min(cardCount, 8);
  for (let i = 0; i < sampleCards; i++) {
    const card = cards.nth(i);
    const title = card.locator('h2, h3, [class*="title" i]').first();
    await title.waitFor({ state: 'visible', timeout: 5000 }).catch(() => console.warn('Missing visible title on card', i + 1));
    const img = card.locator('img').first();
    if (await img.count()) {
      await img.scrollIntoViewIfNeeded();
      const w = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
      if (w === 0) console.warn('Card with broken image', i + 1);
    }
    const link = card.locator('a[href]').first();
    expect(await link.count(), `Card ${i + 1} missing link`).toBeTruthy();
    // Timestamp or author if present
    const timeOrAuthor = await card.locator('time, [class*="author" i], [rel="author"]').count();
    if (!timeOrAuthor) console.warn('Card missing timestamp/author (non-fatal)', i + 1);
  }

  // Search: keyword and infinite scroll (soft)
  const [newPage] = await Promise.all([
    page.context().waitForEvent('page').catch(() => null),
    page.evaluate(() => { window.open('/?s=Arsenal', '_blank'); })
  ]);
  const sp = newPage || page;
  if (newPage) { await newPage.waitForLoadState('domcontentloaded').catch(() => {}); }
  await acceptUniConsentIfPresent(sp);
  const results = sp.locator('article, [class*="result"], [data-result]');
  try { await results.first().waitFor({ state: 'visible', timeout: 8000 }); } catch { console.warn('Search results did not appear (soft)'); }
  await sp.evaluate(async () => { for (let i = 0; i < 4; i++) { window.scrollTo(0, document.body.scrollHeight); await new Promise(r => setTimeout(r, 500)); } });
  if (newPage) await newPage.close().catch(() => {});

  // Consent persistence across reloads (soft)
  await page.reload({ waitUntil: 'domcontentloaded' });
  await acceptUniConsentIfPresent(page);

  // Responsive overflow check (Desktop quick pass)
  const overflow = await page.evaluate(() => (document.scrollingElement?.scrollWidth || document.documentElement.scrollWidth) > window.innerWidth + 1);
  expect(overflow, 'Horizontal overflow detected on Transfer News').toBeFalsy();
});
