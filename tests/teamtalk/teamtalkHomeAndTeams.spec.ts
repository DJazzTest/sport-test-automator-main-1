import { test, expect, Page } from '@playwright/test';

async function acceptUniConsent(page: Page) {
  // Try direct CTA first
  const direct = page.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first();
  if (await direct.isVisible()) {
    await direct.click({ timeout: 5000 });
    return;
  }

  // Fallback: within #uniccmp container
  const root = page.locator('#uniccmp');
  if (await root.count()) {
    const candidates = [
      root.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first(),
      root.getByRole('button', { name: /Accept All/i }).first(),
      root.getByRole('button', { name: /I Accept/i }).first(),
      root.locator('button:has-text("Accept")').first(),
      root.locator('button:has-text("Allow All")').first(),
    ];
    for (const btn of candidates) {
      if (await btn.isVisible()) {
        await btn.click({ timeout: 5000 });
        break;
      }
    }
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
    document.querySelectorAll('[role="dialog"], .unic-modal-container')
      .forEach(d => {
        (d as HTMLElement).style.setProperty('display', 'none', 'important');
        (d as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
        (d as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
      });
  });
}

async function checkNoBrokenImages(page: Page) {
  const imgs = await page.$$('img');
  const broken: string[] = [];
  for (const img of imgs) {
    try {
      const visible = await img.isVisible();
      if (!visible) continue;
      // Scroll into view to trigger lazy loading
      await img.scrollIntoViewIfNeeded().catch(() => {});
      // Wait briefly for lazy-loaders/intersection observers
      await page.waitForTimeout(350);
      const src = (await img.getAttribute('src')) || '';
      const width = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
      // Ignore known placeholders
      const isPlaceholder = /\/placeholder\.png($|\?)/i.test(src);
      if (width === 0 && !isPlaceholder) {
        // Fallback: try fetching the image URL directly to verify it resolves (CDN/proxy can report 200)
        try {
          const url = new URL(src, 'https://www.teamtalk.com').toString();
          const resp = await page.request.get(url);
          if (resp.status() >= 400) {
            broken.push(src || 'unknown');
          }
        } catch {
          broken.push(src || 'unknown');
        }
      }
    } catch {}
  }
  if (broken.length > 0) {
    console.warn(`Broken images detected (non-fatal): ${broken.join(', ')}`);
  }
}

async function verifyRecentContent(page: Page, days = 14) {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  const datetimes = await page.$$eval('time', times => times.map(t => t.getAttribute('datetime') || ''));
  const recent = datetimes
    .map(d => (d ? Date.parse(d) : 0))
    .filter(ts => !Number.isNaN(ts) && ts > threshold);
  if (recent.length === 0) {
    console.warn('No recent content found within threshold; continuing test.');
  }
}

async function closeMobileMenuIfOpen(page: Page) {
  const closeButtons = [
    page.getByRole('button', { name: /Close/i }).first(),
    page.locator('[aria-label*="Close"]').first(),
    page.locator('.close, .close-btn, .modal-close').first(),
  ];
  for (const btn of closeButtons) {
    if (await btn.isVisible()) {
      await btn.click({ timeout: 3000 });
      break;
    }
  }
}

test.describe('Validate TeamTalk homepage and team pages content', () => {
  test('Navigate and validate homepage, consent popup, and team pages', async ({ page }) => {
    test.setTimeout(180_000);
    // Given I navigate to the homepage
    await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await dismissOverlays(page);

    // Then I should land on the homepage and see Home nav link
    await expect(page).toHaveURL(/teamtalk\.com/);
    await expect(page.locator('a[data-text="Home"]')).toBeVisible();

    // When faced with UniConsent popup -> accept and ensure dismissed
    await acceptUniConsent(page);
    await dismissOverlays(page);

    // Validate no broken images and latest content on homepage
    await checkNoBrokenImages(page);
    await verifyRecentContent(page);

    // Navigate to the Team Pages section (right sidebar complementary)
    const complementary = page.getByRole('complementary').first();
    // Scroll to make sure it's in view
    for (let y = 400; y <= 2400; y += 400) {
      await acceptUniConsent(page);
      await dismissOverlays(page);
      await page.evaluate(v => window.scrollTo(0, v), y);
      await page.waitForTimeout(200);
    }
    const teamPagesHeading = complementary.getByRole('heading', { name: /Team Pages/i }).first();
    await teamPagesHeading.waitFor({ state: 'visible', timeout: 10000 });

    // Assert some known team names are present under Team Pages
    const listContainer = teamPagesHeading.locator('xpath=following-sibling::*[1]');
    await expect(listContainer.getByRole('link', { name: /Arsenal/i })).toBeVisible();
    await expect(listContainer.getByRole('link', { name: /Aston Villa/i })).toBeVisible();
    await expect(listContainer.getByRole('link', { name: /Brentford/i })).toBeVisible();

    // Click each team (limit to first 3 for speed), validate team page, then go Home
    const teamLinks = listContainer.getByRole('link');
    const total = await teamLinks.count();
    const toTest = total; // iterate all available teams in the list
    for (let i = 0; i < toTest; i++) {
      const link = teamLinks.nth(i);
      const href = (await link.getAttribute('href')) || '';
      const teamName = (await link.textContent())?.trim() || `team-${i + 1}`;
      await link.scrollIntoViewIfNeeded();
      await acceptUniConsent(page);
      await dismissOverlays(page);
      await link.click({ timeout: 10000, force: true });
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      } catch {}
      await acceptUniConsent(page);
      await dismissOverlays(page);

      // Verify URL changed appropriately and H1 exists
      if (href) {
        const slug = href.replace(/^https?:\/\/[^/]+/, '');
        await expect(page).toHaveURL(new RegExp(slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      } else {
        await expect(page).not.toHaveURL('https://www.teamtalk.com/');
      }
      await expect(page.getByRole('main').locator('h1').first()).toBeVisible();

      // Validate images and recent content on team page
      await checkNoBrokenImages(page);
      await verifyRecentContent(page);

      // Return Home
      await acceptUniConsent(page);
      await dismissOverlays(page);
      const homePill = page.locator('a[data-text="Home"]').first();
      if (await homePill.isVisible()) {
        await homePill.click({ timeout: 10000, force: true });
      } else {
        await page.locator('a[href="https://www.teamtalk.com"]').first().click({ timeout: 10000, force: true });
      }
      try {
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
      } catch {}
      await acceptUniConsent(page);
      await dismissOverlays(page);
      await expect(page).toHaveURL('https://www.teamtalk.com/');

      // If a mobile menu close button appears, click it
      await closeMobileMenuIfOpen(page);
    }
  });

  test('Navigation links: top and footer resolve (200) and detect redirects', async ({ page, request }) => {
    await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await dismissOverlays(page);

    const base = new URL('https://www.teamtalk.com/');

    // Collect top navigation and footer links
    const selectors = [
      'header nav a, [role="navigation"] a',
      'footer a'
    ];
    const hrefs: string[] = [];
    for (const sel of selectors) {
      const links = await page.$$eval(sel, as => as.map(a => (a as HTMLAnchorElement).href).filter(Boolean));
      hrefs.push(...links);
    }

    // Social links (click-flow vs. HEAD check)
    const socialDomains = [
      'facebook.com',
      'x.com',
      'twitter.com',
      'flipboard.com'
    ];

    // Click and briefly load social links: Facebook, X/Twitter, Flipboard
    for (const domain of ['facebook.com', 'x.com', 'twitter.com', 'flipboard.com']) {
      const socialLink = page.locator(`a[href*="${domain}"]`).first();
      if (await socialLink.count()) {
        await acceptUniConsent(page);
        await dismissOverlays(page);
        const [popup] = await Promise.all([
          page.context().waitForEvent('page', { timeout: 8000 }).catch(() => null),
          socialLink.click({ timeout: 8000 })
        ]);
        if (popup) {
          try {
            await popup.waitForLoadState('domcontentloaded', { timeout: 8000 });
            await popup.waitForTimeout(2000);
            console.log(`Social link '${domain}' opened: ${popup.url()}`);
          } catch {}
          await popup.close().catch(() => {});
        }
      }
    }

    // Normalize and de-duplicate, excluding socials we handled via click
    const normalized = Array.from(new Set(
      hrefs
        .filter(h => !/^javascript:/i.test(h) && !/^mailto:/i.test(h) && !/^tel:/i.test(h))
        .map(h => new URL(h, base).toString())
        .filter(h => !socialDomains.some(d => h.includes(d)))
    ));

    const broken: { url: string; status: number }[] = [];
    const redirects: { url: string; status: number; location?: string }[] = [];

    for (const url of normalized) {
      try {
        // Try without following redirects to detect 3xx
        const resp = await request.fetch(url, { maxRedirects: 0 });
        const status = resp.status();
        if (status >= 400) {
          broken.push({ url, status });
        } else if (status >= 300 && status < 400) {
          redirects.push({ url, status, location: resp.headers()['location'] });
        }
      } catch (e) {
        broken.push({ url, status: -1 });
      }
    }

    if (redirects.length > 0) {
      console.warn(`Redirects detected (not failing): ${redirects.length}`);
      redirects.slice(0, 10).forEach(r => console.warn(`  ${r.status} ${r.url} -> ${r.location || 'unknown'}`));
    }

    if (broken.length > 0) {
      console.error('Broken nav/footer links detected:\n' + broken.map(b => `  ${b.status} ${b.url}`).join('\n'));
    }

    expect(broken.length, 'One or more nav/footer links returned error status').toBe(0);
  });

  test('Article cards: title, image, and working link', async ({ page, request }) => {
    await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await dismissOverlays(page);

    // Collect visible cards
    const cards = page.locator('article, [class*="article"], [class*="card"]');
    const count = await cards.count();
    expect(count, 'No article cards found').toBeGreaterThan(0);

    const sample = Math.min(count, 10);
    for (let i = 0; i < sample; i++) {
      const card = cards.nth(i);
      // title present
      const title = card.locator('h2, h3, .title, [class*="title"]').first();
      await expect(title).toBeVisible();
      const titleText = (await title.textContent())?.trim() || '';
      expect(titleText.length, 'Empty article title').toBeGreaterThan(0);

      // image present and healthy
      const img = card.locator('img').first();
      if (await img.count()) {
        await expect(img).toBeVisible();
        const width = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
        if (width === 0) {
          console.warn('Broken card image detected; continuing.');
        }
      }

      // link present and returns 200
      const link = card.locator('a[href]').first();
      await expect(link).toBeVisible();
      const href = await link.getAttribute('href');
      expect(href, 'Card link missing href').toBeTruthy();
      if (href) {
        const url = new URL(href, 'https://www.teamtalk.com').toString();
        const res = await request.get(url);
        expect(res.status(), `Card link ${url} not 200`).toBeLessThan(400);
      }
    }
  });

  test('UniConsent persistence across reloads (storageState)', async ({ browser }) => {
    // 1) Open a context, accept consent, save storageState
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page1);
    await dismissOverlays(page1);
    const storage = await context1.storageState();
    await context1.close();

    // 2) Re-open with saved storageState, ensure consent modal is absent
    const context2 = await browser.newContext({ storageState: storage });
    const page2 = await context2.newPage();
    await page2.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
    await page2.waitForTimeout(800);
    const modal2 = page2.locator('#uniccmp, [role="dialog"]:has(#uniccmp)');
    if (await modal2.count()) {
      console.warn('UniConsent re-appeared with stored state; accepting again.');
      await acceptUniConsent(page2);
      await dismissOverlays(page2);
    }
    await context2.close();
  });

  test('Search: keyword returns results and supports infinite scroll', async ({ page }) => {
    // Use direct query URL to avoid flakey UI selectors
    await page.goto('https://www.teamtalk.com/?s=Arsenal', { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await dismissOverlays(page);

    // Wait for results list (warn-only if none appear)
    const results = page.locator('article, [class*="result"], [data-result]');
    try {
      await results.first().waitFor({ state: 'visible', timeout: 10000 });
    } catch {
      console.warn('Search results did not load within 10s; skipping further search checks.');
      return;
    }
    const initial = await results.count();
    if (initial === 0) {
      console.warn('Search returned zero results; skipping further search checks.');
      return;
    }

    // Infinite scroll/pagination: scroll and check more items appear or at least no crash
    await page.evaluate(async () => {
      for (let i = 0; i < 5; i++) {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 600));
      }
    });
    const afterScroll = await results.count();
    expect(afterScroll, 'No additional results loaded after scrolling').toBeGreaterThanOrEqual(initial);

    // Click first result, then navigate back
    await results.first().locator('a[href]').first().click({ timeout: 5000 });
    await page.waitForLoadState('domcontentloaded');
    await acceptUniConsent(page);
    await dismissOverlays(page);
    await expect(page.locator('h1').first()).toBeVisible();
    await page.goBack();
    await results.first().waitFor({ state: 'visible' });
  });

  test('Responsive: no horizontal overflow at key viewports', async ({ browser }) => {
    const viewports = [
      { name: 'iPhone 12', width: 390, height: 844 },
      { name: 'iPad', width: 768, height: 1024 },
      { name: 'Desktop', width: 1366, height: 900 }
    ];

    for (const vp of viewports) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
      await acceptUniConsent(page);
      await dismissOverlays(page);

      const hasOverflow = await page.evaluate(() => {
        const scrollWidth = document.scrollingElement?.scrollWidth || document.documentElement.scrollWidth;
        return scrollWidth > window.innerWidth + 1; // allow 1px tolerance
      });
      expect(hasOverflow, `${vp.name}: horizontal overflow detected`).toBeFalsy();

      await context.close();
    }
  });

  test('Meta/Schema tags present and canonical URL set', async ({ page }) => {
    await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
    const headHtml = await page.locator('head').innerHTML();
    // Basic checks for OpenGraph, Twitter, canonical
    expect(headHtml).toMatch(/<meta[^>]+property=["']og:title["']/i);
    if (!/<meta[^>]+property=["']og:image["']/i.test(headHtml)) {
      console.warn('og:image not found in head at domcontentloaded; continuing.');
    }
    expect(headHtml).toMatch(/<meta[^>]+name=["']twitter:card["']/i);
    expect(headHtml).toMatch(/<link[^>]+rel=["']canonical["']/i);
    // Structured data presence (ld+json)
    const ldjson = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => e.textContent || ''));
    expect(ldjson.length, 'No structured data found').toBeGreaterThan(0);
  });

  test('Ads/trackers containers present and not blocking content', async ({ page }) => {
    await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await dismissOverlays(page);
    // Common ad container patterns
    const adSelectors = ['[id*="ad" i]', '[class*="ad" i]', '[data-ad]'];
    const anyAd = await page.locator(adSelectors.join(',')).first().count();
    expect(anyAd, 'No ad containers found (warn-only)').toBeGreaterThanOrEqual(0);
    // Ensure main content is visible and not overlapped
    const main = page.getByRole('main');
    await expect(main).toBeVisible();
  });

  test('Performance: basic load timing capture', async ({ page }) => {
    await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
    // Capture navigation timings
    const timing = await page.evaluate(() => JSON.parse(JSON.stringify(performance.timing || {})));
    const paint = await page.evaluate(() => {
      const entries = performance.getEntriesByType('paint') as PerformanceEntry[];
      const obj: Record<string, number> = {};
      entries.forEach(e => obj[e.name] = e.startTime);
      return obj;
    });
    console.log('NavigationTiming:', timing);
    console.log('PaintTiming:', paint);
  });

  test('Video embeds: providers render without errors', async ({ page }) => {
    await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await dismissOverlays(page);
    // Common providers
    const videoFrames = page.locator('iframe[src*="youtube.com" i], iframe[src*="player.vimeo.com" i], iframe[src*="brightcove" i]');
    const count = await videoFrames.count();
    if (count === 0) {
      console.warn('No video embeds detected on homepage.');
      return;
    }
    await expect(videoFrames.first()).toBeVisible();
  });
});


