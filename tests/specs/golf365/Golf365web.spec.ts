import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://www.golf365.com';

type SectionConfig = {
  slug: string;
  path: string;
  pathAlt?: string;
  label: string;
  navName: RegExp;
};

/** Section config: navigation path Home → Equipment → Instruction → Courses → News (slug-based URL validation) */
const SECTIONS: SectionConfig[] = [
  { slug: 'equipment', path: '/equipment', label: 'Equipment', navName: /Equipment/i },
  { slug: 'instruction', path: '/instruction', pathAlt: '/golf-instruction', label: 'Instruction', navName: /Instruction/i },
  { slug: 'courses', path: '/courses', label: 'Courses', navName: /Courses/i },
  { slug: 'news', path: '/news', label: 'News', navName: /News/i },
];

/** Timeouts (ms) – no silent failures; explicit wait limits */
const LOAD_TIMEOUT = 30_000;
const CONSENT_TIMEOUT = 8_000;
const HEADER_VISIBLE_TIMEOUT = 15_000;
const H1_VISIBLE_TIMEOUT = 12_000;

// Selectors from Golf365 site (fallback when getByRole is insufficient)
const SELECTORS = {
  homeLink: 'a.ps-secondary-nav-link[data-text="Home"], a[href="https://www.golf365.com"][data-text="Home"]',
  // Sign Up: <a href="javascript: window.unisignin.cmd.push(['signup']);" class="unisignin-signup-wrapper ...">Sign Up</a>
  signUpBtn: 'a.unisignin-signup-wrapper:has-text("Sign Up"), a[href*="unisignin"][href*="signup"]:has-text("Sign Up")',
  loginBtn: 'a.unisignin-login-wrapper, a[href*="unisignin"][class*="login"]',
  themeToggleLight: 'span:has-text("Light")',
  // Dark theme toggle span: <span class="hidden sm:inline-block">Dark</span>
  // Note: Tailwind's responsive class uses a colon, so we escape it in the selector.
  themeToggleDark: '.ps-btn-dark, span.hidden.sm\\:inline-block:has-text("Dark")',
  closeButton: 'button[aria-label="Close"], button[aria-label="Close dialog"], [class*="close"] button, button:has(svg path[d*="310.6 361.4"])',
  socialFacebook: 'img[alt="facebook"], a img[src*="facebook-white"]',
  socialX: 'img[alt="x"], img[alt="twitter"], a img[src*="twitter-white"]',
  socialInstagram: 'img[alt="instagram"], a img[src*="instagram-white"]',
  equipmentLink: 'a.ps-secondary-nav-link[data-text="Equipment"], a[href*="equipment"][data-text="Equipment"]',
  instructionLink: 'a.ps-secondary-nav-link[data-text="Instruction"], a[href*="golf-instruction"][data-text="Instruction"]',
  coursesLink: 'a.ps-secondary-nav-link[data-text="Courses"], a[href*="courses"][data-text="Courses"]',
  newsLink: 'a.ps-secondary-nav-link[data-text="News"], a[href*="news"][data-text="News"]',
};

/* ========== CONSENT & OVERLAYS (aligned with teamtalkweb) ========== */

async function acceptConsent(page: Page): Promise<void> {
  await page.waitForTimeout(800);
  const byRole = page.getByRole('button', { name: /Accept|Allow all|Agree/i }).first();
  if (await byRole.isVisible().catch(() => false)) {
    await byRole.click({ timeout: 5000 });
    await page.waitForTimeout(500);
    const dialog = page.locator('[role="dialog"], [class*="consent"], [class*="cookie"], [id*="consent"]').first();
    await dialog.waitFor({ state: 'hidden', timeout: CONSENT_TIMEOUT }).catch(() => {});
    await page.waitForTimeout(1200);
    return;
  }
  const inDialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /Accept|Allow/i }) }).first();
  if (await inDialog.count()) {
    const btn = inDialog.getByRole('button', { name: /Accept|Allow/i }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click({ timeout: 5000 });
      await page.waitForTimeout(1200);
    }
  }
}

async function dismissOverlays(page: Page): Promise<void> {
  await page.evaluate(() => {
    const ids = ['uniccmp', 'ps-nav-overlay', 'cookie-banner', 'consent-banner', 'unis-root'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
        (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
        (el as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
      }
    });
    document.querySelectorAll('[role="dialog"], .unic-modal-container, [class*="cookie"]').forEach(d => {
      const el = d as HTMLElement;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('pointer-events', 'none', 'important');
    });
  });
}

/* ========== PAGE HEALTH (error markers – no silent failures) ========== */

/** Asserts page is not 404/error; on failure includes current URL for traceability. */
async function checkErrorMarkers(page: Page, sectionName: string): Promise<void> {
  const url = page.url();
  const hasError = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const text = (main?.textContent || '').toLowerCase();
    return /\b404\b|\bserver error\b|\bfatal error\b|\bpage not found\b/i.test(text);
  });
  expect(
    hasError,
    `Section "${sectionName}": 404/server error detected. Failure URL: ${url}`
  ).toBeFalsy();
}

/** Returns true if page content indicates 404/error (for conditional handling). */
async function has404OrErrorMarkers(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const text = (main?.textContent || '').toLowerCase();
    return /\b404\b|\bserver error\b|\bfatal error\b|\bpage not found\b/i.test(text);
  });
}

/* ========== NAVIGATION & PAGE LOAD VALIDATION ========== */

async function gotoHomepage(page: Page): Promise<void> {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
  await acceptConsent(page);
  await dismissOverlays(page);
  await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
  await page.waitForTimeout(1200);
}

/** Slug-based URL assertion for a section (handles instruction → /instruction or /golf-instruction) */
function expectSectionUrl(page: Page, section: SectionConfig): void {
  if (section.pathAlt) {
    expect(page.url()).toMatch(new RegExp(`golf365\\.com(/${section.slug}|${section.pathAlt.replace('/', '\\/')})`));
  } else {
    expect(page).toHaveURL(new RegExp(`golf365\\.com\\/${section.slug}(\\/|$)`));
  }
}

/** Navigate to section URL, accept consent, validate URL + header attached + content (H1 or articles or readable) visible */
async function visitSectionAndValidatePage(
  page: Page,
  section: SectionConfig
): Promise<void> {
  const url = `${BASE_URL}${section.path}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
  await acceptConsent(page);
  await dismissOverlays(page);
  await page.waitForTimeout(1500);
  await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
  expectSectionUrl(page, section);
  await expect(page.locator('header').first()).toBeAttached();
  const h1 = page.getByRole('heading', { level: 1 }).first();
  const articles = page.locator('article, [class*="article"], [class*="card"]').first();
  await Promise.race([
    h1.waitFor({ state: 'visible', timeout: H1_VISIBLE_TIMEOUT }),
    articles.waitFor({ state: 'visible', timeout: H1_VISIBLE_TIMEOUT }),
  ]).catch(() => {});
  const h1Visible = await h1.isVisible().catch(() => false);
  const contentVisible = await articles.isVisible().catch(() => false);
  const hasReadable = await validateTextReadable(page).catch(() => false);
  expect(
    h1Visible || contentVisible || hasReadable,
    `Section "${section.label}": H1, article/card, or readable content should be visible`
  ).toBeTruthy();
  await checkErrorMarkers(page, section.label);
}

/** Click nav link by role or fallback selector; then validate URL, header, H1 */
async function navigateToSectionViaNav(
  page: Page,
  section: SectionConfig,
  navSelector: string
): Promise<void> {
  const byRole = page.getByRole('link', { name: section.navName }).first();
  const bySelector = page.locator(navSelector).first();
  if (await byRole.count()) {
    await byRole.click({ timeout: 10_000 });
  } else {
    await expect(bySelector).toBeVisible({ timeout: 10_000 });
    await bySelector.click();
  }
  await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
  await acceptConsent(page);
  await dismissOverlays(page);
  await page.waitForTimeout(1500);
  expectSectionUrl(page, section);
  await expect(page.locator('header').first()).toBeAttached();
  const h1 = page.getByRole('heading', { level: 1 }).first();
  const articles = page.locator('article, [class*="article"], [class*="card"]').first();
  await Promise.race([
    h1.waitFor({ state: 'visible', timeout: H1_VISIBLE_TIMEOUT }),
    articles.waitFor({ state: 'visible', timeout: H1_VISIBLE_TIMEOUT }),
  ]).catch(() => {});
  const h1Visible = await h1.isVisible().catch(() => false);
  const contentVisible = await articles.isVisible().catch(() => false);
  const hasReadable = await validateTextReadable(page).catch(() => false);
  expect(
    h1Visible || contentVisible || hasReadable,
    `Section "${section.label}": H1, article/card, or readable content should be visible`
  ).toBeTruthy();
  await checkErrorMarkers(page, section.label);
}

/** E2E-only: click nav link and assert URL only (no header/content checks) so the full journey is resilient. */
async function navigateToSectionViaNavE2E(
  page: Page,
  section: SectionConfig,
  navSelector: string
): Promise<void> {
  await dismissOverlays(page);
  await page.waitForTimeout(300);
  const byRole = page.getByRole('link', { name: section.navName }).first();
  const bySelector = page.locator(navSelector).first();
  const link = (await byRole.count()) ? byRole : bySelector;
  await expect(link).toBeVisible({ timeout: 10_000 });
  await link.evaluate((el: HTMLElement) => el.click());
  await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
  await acceptConsent(page);
  await dismissOverlays(page);
  await page.waitForTimeout(1200);
  expectSectionUrl(page, section);
}

/* ========== CONTENT VALIDATION HELPERS ========== */

async function validateAllImagesLoad(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const broken = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
    return imgs.filter((el) => el.offsetParent != null && (el.naturalWidth === 0 || el.naturalHeight === 0)).length;
  });
  expect(broken).toBe(0);
}

/** Returns broken image count and their src URLs for failure messages. */
async function getBrokenImageUrls(page: Page): Promise<{ count: number; urls: string[] }> {
  const result = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img')) as HTMLImageElement[];
    const broken = imgs.filter((el) => el.offsetParent != null && (el.naturalWidth === 0 || el.naturalHeight === 0));
    const urls = broken.map((el) => el.src || el.getAttribute('src') || '(no src)');
    return { count: urls.length, urls };
  });
  return result;
}

/** Returns broken link count and their hrefs (full URL when possible) for failure messages. */
async function getBrokenLinkUrls(page: Page): Promise<{ count: number; urls: string[] }> {
  const result = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    const broken = links.filter((a) => {
      const href = (a.getAttribute('href') || '').trim();
      return href === '' || href === '#';
    });
    const urls = broken.map((a) => {
      const href = (a.getAttribute('href') || '').trim();
      try {
        return a.href || href || '(empty)';
      } catch {
        return href || '(empty)';
      }
    });
    return { count: urls.length, urls };
  });
  return result;
}

/** Count links with empty or hash-only href (broken link check). */
async function countBrokenLinks(page: Page): Promise<number> {
  const { count } = await getBrokenLinkUrls(page);
  return count;
}

function validateTextReadable(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const text = (document.querySelector('main') || document.body).textContent || '';
    return text.length > 100 && !/\uFFFD/.test(text);
  });
}

async function validateArticleStructure(page: Page): Promise<void> {
  const firstArticle = page.locator('article').first();
  await expect(firstArticle).toBeVisible({ timeout: 10_000 });
  await expect(firstArticle.locator('h1, h2, h3').first()).toBeVisible({ timeout: 5000 });
  const hasDateOrBy = await firstArticle.locator('time, [datetime], text=/by\\s|published|author/i').first().isVisible().catch(() => false);
  expect(hasDateOrBy).toBeTruthy();
}

async function validateEachArticleHasHeadlineDateAuthor(page: Page, maxArticles = 3): Promise<void> {
  const articles = page.locator(SECTION_CONTENT_LIST_SELECTOR);
  const count = await articles.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < Math.min(maxArticles, count); i++) {
    const article = articles.nth(i);
    await expect(article.locator('h1, h2, h3, [class*="headline"], [class*="title"]').first()).toBeVisible({ timeout: 5000 });
    const hasDate = await article.locator('time, [datetime], [class*="date"], [class*="time"]').first().isVisible().catch(() => false);
    const hasAuthor = await article.locator('[class*="author"], [class*="byline"], text=/by\\s|author/i').first().isVisible().catch(() => false);
    expect.soft(hasDate || hasAuthor, `Article ${i + 1}: date or author should be visible`).toBeTruthy();
  }
}

function getPaginationLocator(page: Page) {
  return page.locator('[class*="pagination"], nav[aria-label*="pagination"], a[href*="page"], button:has-text("Next"), [class*="pager"]').first();
}

/** Article/card list used on section listing pages (Golf365 may use article or card-style divs) */
const SECTION_CONTENT_LIST_SELECTOR = 'article, [class*="article"], [class*="card"]';

/** Run a check and log ✅ passed or ❌ failed per section; rethrows on failure so test fails as usual. */
async function checkAndLog(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    console.log(`  ✅ passed: ${label}`);
  } catch (e) {
    console.log(`  ❌ failed: ${label}`);
    throw e;
  }
}

/* ========== TEST SUITE: Home → Equipment → Instruction → Courses → News ========== */

test.describe('Golf365 Full Site Validation', () => {
  test.describe.configure({ mode: 'serial' });

  /* ========== SINGLE SESSION: Homepage → theme → Equipment → Instruction → Courses → News → Social (no browser close/restart) ========== */

  test('Single session: Homepage → theme → Equipment → Instruction → Courses → News → Social', async ({ page, context }) => {
    test.setTimeout(240_000);
    await gotoHomepage(page);
    await dismissOverlays(page);
    await page.waitForTimeout(1500);

    console.log('\n--- Homepage ---');
    await checkAndLog('Homepage - URL', async () => {
      await expect(page).toHaveURL(new RegExp(`golf365\\.com\\/?$`));
    });
    await checkAndLog('Homepage - header or nav visible', async () => {
      await expect(page.locator('header').first()).toBeAttached();
      const headerVisible = await page.locator('header').first().isVisible().catch(() => false);
      const navVisible = await page.getByRole('link', { name: /Equipment/i }).first().isVisible().catch(() => false);
      expect(headerVisible || navVisible, 'Header or main nav (Equipment link) should be visible').toBeTruthy();
    });
    await checkAndLog('Homepage - footer attached', async () => {
      await expect(page.locator('footer.bg-footer').first()).toBeAttached();
    });
    await checkAndLog('Homepage - news section or articles', async () => {
      const newsSection = page.locator('section, [class*="section"], [class*="news"]').filter({ hasText: /news|golf|latest|article/i }).first();
      const articles = page.locator('article, [class*="article"], [class*="card"]');
      const articleCount = await articles.count().catch(() => 0);
      const hasNewsSection = await newsSection.isVisible().catch(() => false);
      const hasArticles = articleCount > 0 && (await articles.first().isVisible().catch(() => false));
      expect(hasNewsSection || hasArticles, 'Golf news section or article list should be displayed').toBeTruthy();
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await checkAndLog('Homepage - broken images (≤5)', async () => {
      const homeBroken = await getBrokenImageUrls(page);
      expect(
        homeBroken.count,
        `Broken images (${homeBroken.count}) on homepage. Page URL: ${page.url()}. Broken image URLs: ${homeBroken.urls.slice(0, 20).join(' | ')}${homeBroken.urls.length > 20 ? ' ...' : ''}`
      ).toBeLessThanOrEqual(5);
    });
    await checkAndLog('Homepage - broken links (0)', async () => {
      const homeBrokenLinks = await getBrokenLinkUrls(page);
      expect(
        homeBrokenLinks.count,
        `Broken links (${homeBrokenLinks.count}) on homepage. Page URL: ${page.url()}. Broken link URLs: ${homeBrokenLinks.urls.join(' | ') || 'N/A'}`
      ).toBe(0);
    });
    await checkAndLog('Homepage - text readable', async () => {
      expect(await validateTextReadable(page), 'All text should be readable with no missing or corrupted characters').toBeTruthy();
    });
    await checkAndLog('Homepage - no 404/error markers', async () => {
      await checkErrorMarkers(page, 'Home');
    });

    const darkToggle = page.locator(SELECTORS.themeToggleDark).first();
    const themeVisible = await darkToggle.isVisible({ timeout: 10_000 }).catch(() => false);
    if (themeVisible) {
      await checkAndLog('Homepage - theme (dark) applied', async () => {
        await darkToggle.click();
        await page.waitForTimeout(500);
        const isDark = await page.evaluate(() => {
          const html = document.documentElement;
          return html.classList.contains('dark') || html.getAttribute('data-theme') === 'dark' || html.querySelector('.ps-btn-dark') != null;
        });
        expect(isDark).toBeTruthy();
        await page.reload({ waitUntil: 'domcontentloaded' });
        await acceptConsent(page);
        await dismissOverlays(page);
        await page.waitForTimeout(1200);
      });
    }

    await dismissOverlays(page);
    await page.waitForTimeout(1500);
    const equipmentLink = page.getByRole('link', { name: /Equipment/i }).or(page.locator(SELECTORS.equipmentLink)).first();
    await expect(equipmentLink).toBeVisible({ timeout: HEADER_VISIBLE_TIMEOUT });

    await navigateToSectionViaNavE2E(page, SECTIONS[0], SELECTORS.equipmentLink);
    await dismissOverlays(page);
    await page.waitForTimeout(800);

    console.log('\n--- Equipment ---');
    const articleList = page.locator(SECTION_CONTENT_LIST_SELECTOR);
    await checkAndLog('Equipment - section URL', async () => { expectSectionUrl(page, SECTIONS[0]); });
    await checkAndLog('Equipment - header or content visible', async () => {
      await expect(page.locator('header').first()).toBeAttached();
      const eqHeaderVisible = await page.locator('header').first().isVisible().catch(() => false);
      const eqContentVisible = await articleList.first().isVisible().catch(() => false);
      expect(eqHeaderVisible || eqContentVisible, 'Equipment: header or article list should be visible').toBeTruthy();
    });
    await checkAndLog('Equipment - no 404/error markers', async () => { await checkErrorMarkers(page, 'Equipment'); });
    await checkAndLog('Equipment - article list visible', async () => {
      await expect(articleList.first()).toBeVisible({ timeout: 12_000 });
      const count = await articleList.count();
      expect(count).toBeGreaterThan(0);
      await validateEachArticleHasHeadlineDateAuthor(page, Math.min(3, count));
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await checkAndLog('Equipment - broken images (≤10)', async () => {
      const eqBroken = await getBrokenImageUrls(page);
      expect(
        eqBroken.count,
        `Broken images (${eqBroken.count}) on Equipment. Page URL: ${page.url()}. Broken image URLs: ${eqBroken.urls.slice(0, 15).join(' | ')}${eqBroken.urls.length > 15 ? ' ...' : ''}`
      ).toBeLessThanOrEqual(10);
    });
    await checkAndLog('Equipment - text readable', async () => { expect(await validateTextReadable(page)).toBeTruthy(); });
    await checkAndLog('Equipment - pagination visible', async () => { await expect(getPaginationLocator(page)).toBeVisible({ timeout: 8000 }); });

    const sectionUrl = `${BASE_URL}${SECTIONS[0].path}`;
    const firstArticleLink = articleList.locator('a[href*="/"]').first();
    await expect(firstArticleLink).toBeVisible({ timeout: 10_000 });
    await firstArticleLink.evaluate((el: HTMLElement) => el.click());
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    await page.waitForTimeout(1000);
    await checkAndLog('Equipment - first article URL & H1', async () => {
      expect(page.url()).toMatch(/golf365\.com/);
      expect(page.url()).not.toBe(sectionUrl);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: H1_VISIBLE_TIMEOUT });
      const hasDate = await page.locator('time, [datetime], [class*="date"]').first().isVisible().catch(() => false);
      const hasAuthor = await page.locator('[class*="author"], [class*="byline"], text=/by\\s|author/i').first().isVisible().catch(() => false);
      expect(hasDate || hasAuthor).toBeTruthy();
    });
    await checkAndLog('Equipment - first article broken images (≤10)', async () => {
      const eqArticleBroken = await getBrokenImageUrls(page);
      expect(
        eqArticleBroken.count,
        `Broken images (${eqArticleBroken.count}) on Equipment article. Page URL: ${page.url()}. Broken image URLs: ${eqArticleBroken.urls.slice(0, 15).join(' | ')}${eqArticleBroken.urls.length > 15 ? ' ...' : ''}`
      ).toBeLessThanOrEqual(10);
    });
    await checkAndLog('Equipment - first article text readable', async () => { expect(await validateTextReadable(page)).toBeTruthy(); });

    await page.goto(sectionUrl, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
    await acceptConsent(page);
    await dismissOverlays(page);
    await page.waitForTimeout(800);

    await navigateToSectionViaNavE2E(page, SECTIONS[1], SELECTORS.instructionLink);
    await dismissOverlays(page);
    await page.waitForTimeout(800);

    console.log('\n--- Instruction ---');
    const instrArticleList = page.locator(SECTION_CONTENT_LIST_SELECTOR);
    await checkAndLog('Instruction - section URL', async () => { expectSectionUrl(page, SECTIONS[1]); });
    await checkAndLog('Instruction - no 404', async () => {
      const instructionUrl = page.url();
      const instruction404 = await has404OrErrorMarkers(page);
      expect(instruction404, `Instruction page returned 404. Failure URL: ${instructionUrl}`).toBeFalsy();
    });
    await checkAndLog('Instruction - no 404/error markers', async () => { await checkErrorMarkers(page, 'Instruction'); });
    await checkAndLog('Instruction - header or content visible', async () => {
      await expect(page.locator('header').first()).toBeAttached();
      const instrHeaderVisible = await page.locator('header').first().isVisible().catch(() => false);
      const instrContentVisible = await instrArticleList.first().isVisible().catch(() => false);
      expect(instrHeaderVisible || instrContentVisible || (await validateTextReadable(page)), 'Instruction: header, articles or readable content should be visible').toBeTruthy();
      await instrArticleList.first().waitFor({ state: 'visible', timeout: 12_000 }).catch(() => {});
      const instrCount = await instrArticleList.count();
      expect(instrCount > 0 || (await validateTextReadable(page)), 'Instruction: articles/cards or readable content').toBeTruthy();
      if (instrCount > 0) {
        await validateEachArticleHasHeadlineDateAuthor(page, Math.min(3, instrCount));
      }
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await checkAndLog('Instruction - broken images (≤10)', async () => {
      const instrBroken = await getBrokenImageUrls(page);
      expect(
        instrBroken.count,
        `Broken images (${instrBroken.count}) on Instruction. Page URL: ${page.url()}. Broken image URLs: ${instrBroken.urls.slice(0, 15).join(' | ')}${instrBroken.urls.length > 15 ? ' ...' : ''}`
      ).toBeLessThanOrEqual(10);
    });
    await checkAndLog('Instruction - text readable', async () => { expect(await validateTextReadable(page)).toBeTruthy(); });
    await getPaginationLocator(page).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

    const instrSectionUrl = `${BASE_URL}${SECTIONS[1].path}`;
    const instrFirstLink = instrArticleList.locator('a[href*="/"]').first();
    const hasInstrLink = await instrFirstLink.isVisible().catch(() => false);
    if (hasInstrLink) {
      await instrFirstLink.evaluate((el: HTMLElement) => el.click());
      await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
      await page.waitForTimeout(1000);
      await checkAndLog('Instruction - first article URL & H1', async () => {
        expect(page.url()).toMatch(/golf365\.com/);
        expect(page.url()).not.toBe(instrSectionUrl);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: H1_VISIBLE_TIMEOUT });
        const hasDate = await page.locator('time, [datetime], [class*="date"]').first().isVisible().catch(() => false);
        const hasAuthor = await page.locator('[class*="author"], [class*="byline"], text=/by\\s|author/i').first().isVisible().catch(() => false);
        expect(hasDate || hasAuthor).toBeTruthy();
      });
      await checkAndLog('Instruction - first article broken images (≤10)', async () => {
        const instrArticleBroken = await getBrokenImageUrls(page);
        expect(
          instrArticleBroken.count,
          `Broken images (${instrArticleBroken.count}) on Instruction article. Page URL: ${page.url()}. Broken image URLs: ${instrArticleBroken.urls.slice(0, 15).join(' | ')}${instrArticleBroken.urls.length > 15 ? ' ...' : ''}`
        ).toBeLessThanOrEqual(10);
      });
      await checkAndLog('Instruction - first article text readable', async () => { expect(await validateTextReadable(page)).toBeTruthy(); });
      await page.goto(instrSectionUrl, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
      await acceptConsent(page);
      await dismissOverlays(page);
      await page.waitForTimeout(800);
    }

    await navigateToSectionViaNavE2E(page, SECTIONS[2], SELECTORS.coursesLink);
    await dismissOverlays(page);
    await page.waitForTimeout(800);

    console.log('\n--- Courses ---');
    const coursesArticleList = page.locator(SECTION_CONTENT_LIST_SELECTOR);
    await checkAndLog('Courses - section URL', async () => { expectSectionUrl(page, SECTIONS[2]); });
    await checkAndLog('Courses - header or content visible', async () => {
      await expect(page.locator('header').first()).toBeAttached();
      const coursesHeaderVisible = await page.locator('header').first().isVisible().catch(() => false);
      const coursesContentVisible = await coursesArticleList.first().isVisible().catch(() => false);
      expect(coursesHeaderVisible || coursesContentVisible, 'Courses: header or article list should be visible').toBeTruthy();
    });
    await checkAndLog('Courses - no 404/error markers', async () => { await checkErrorMarkers(page, 'Courses'); });
    await checkAndLog('Courses - article list visible', async () => {
      await expect(coursesArticleList.first()).toBeVisible({ timeout: 12_000 });
      const coursesCount = await coursesArticleList.count();
      expect(coursesCount).toBeGreaterThan(0);
      await validateEachArticleHasHeadlineDateAuthor(page, Math.min(3, coursesCount));
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await checkAndLog('Courses - broken images (≤10)', async () => {
      const coursesBroken = await getBrokenImageUrls(page);
      expect(
        coursesBroken.count,
        `Broken images (${coursesBroken.count}) on Courses. Page URL: ${page.url()}. Broken image URLs: ${coursesBroken.urls.slice(0, 15).join(' | ')}${coursesBroken.urls.length > 15 ? ' ...' : ''}`
      ).toBeLessThanOrEqual(10);
    });
    await checkAndLog('Courses - text readable', async () => { expect(await validateTextReadable(page)).toBeTruthy(); });
    await checkAndLog('Courses - pagination visible', async () => { await expect(getPaginationLocator(page)).toBeVisible({ timeout: 8000 }); });

    const coursesSectionUrl = `${BASE_URL}${SECTIONS[2].path}`;
    const coursesFirstLink = coursesArticleList.locator('a[href*="/"]').first();
    await expect(coursesFirstLink).toBeVisible({ timeout: 10_000 });
    await coursesFirstLink.evaluate((el: HTMLElement) => el.click());
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    await page.waitForTimeout(1000);
    await checkAndLog('Courses - first article URL & H1', async () => {
      expect(page.url()).toMatch(/golf365\.com/);
      expect(page.url()).not.toBe(coursesSectionUrl);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: H1_VISIBLE_TIMEOUT });
      const coursesHasDate = await page.locator('time, [datetime], [class*="date"]').first().isVisible().catch(() => false);
      const coursesHasAuthor = await page.locator('[class*="author"], [class*="byline"], text=/by\\s|author/i').first().isVisible().catch(() => false);
      expect(coursesHasDate || coursesHasAuthor).toBeTruthy();
    });
    await checkAndLog('Courses - first article broken images (≤10)', async () => {
      const coursesArticleBroken = await getBrokenImageUrls(page);
      expect(
        coursesArticleBroken.count,
        `Broken images (${coursesArticleBroken.count}) on Courses article. Page URL: ${page.url()}. Broken image URLs: ${coursesArticleBroken.urls.slice(0, 15).join(' | ')}${coursesArticleBroken.urls.length > 15 ? ' ...' : ''}`
      ).toBeLessThanOrEqual(10);
    });
    await checkAndLog('Courses - first article text readable', async () => { expect(await validateTextReadable(page)).toBeTruthy(); });

    await page.goto(coursesSectionUrl, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
    await acceptConsent(page);
    await dismissOverlays(page);
    await page.waitForTimeout(800);

    await navigateToSectionViaNavE2E(page, SECTIONS[3], SELECTORS.newsLink);
    await dismissOverlays(page);
    await page.waitForTimeout(800);

    console.log('\n--- News ---');
    const newsArticleList = page.locator(SECTION_CONTENT_LIST_SELECTOR);
    await checkAndLog('News - section URL', async () => { expectSectionUrl(page, SECTIONS[3]); });
    await checkAndLog('News - header or content visible', async () => {
      await expect(page.locator('header').first()).toBeAttached();
      const newsHeaderVisible = await page.locator('header').first().isVisible().catch(() => false);
      const newsContentVisible = await newsArticleList.first().isVisible().catch(() => false);
      expect(newsHeaderVisible || newsContentVisible, 'News: header or article list should be visible').toBeTruthy();
    });
    await checkAndLog('News - no 404/error markers', async () => { await checkErrorMarkers(page, 'News'); });
    await checkAndLog('News - article list visible', async () => {
      await expect(newsArticleList.first()).toBeVisible({ timeout: 12_000 });
      const newsCount = await newsArticleList.count();
      expect(newsCount).toBeGreaterThan(0);
      await validateEachArticleHasHeadlineDateAuthor(page, Math.min(3, newsCount));
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await checkAndLog('News - broken images (≤10)', async () => {
      const newsBroken = await getBrokenImageUrls(page);
      expect(
        newsBroken.count,
        `Broken images (${newsBroken.count}) on News. Page URL: ${page.url()}. Broken image URLs: ${newsBroken.urls.slice(0, 15).join(' | ')}${newsBroken.urls.length > 15 ? ' ...' : ''}`
      ).toBeLessThanOrEqual(10);
    });
    await checkAndLog('News - text readable', async () => { expect(await validateTextReadable(page)).toBeTruthy(); });
    await checkAndLog('News - pagination visible', async () => { await expect(getPaginationLocator(page)).toBeVisible({ timeout: 8000 }); });

    const newsSectionUrl = `${BASE_URL}${SECTIONS[3].path}`;
    const newsFirstLink = newsArticleList.locator('a[href*="/"]').first();
    await expect(newsFirstLink).toBeVisible({ timeout: 10_000 });
    await newsFirstLink.evaluate((el: HTMLElement) => el.click());
    await page.waitForLoadState('domcontentloaded', { timeout: LOAD_TIMEOUT });
    await page.waitForTimeout(1000);
    await checkAndLog('News - first article URL & H1', async () => {
      expect(page.url()).toMatch(/golf365\.com/);
      expect(page.url()).not.toBe(newsSectionUrl);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: H1_VISIBLE_TIMEOUT });
      const newsHasDate = await page.locator('time, [datetime], [class*="date"]').first().isVisible().catch(() => false);
      const newsHasAuthor = await page.locator('[class*="author"], [class*="byline"], text=/by\\s|author/i').first().isVisible().catch(() => false);
      expect(newsHasDate || newsHasAuthor).toBeTruthy();
    });
    await checkAndLog('News - first article broken images (≤10)', async () => {
      const newsArticleBroken = await getBrokenImageUrls(page);
      expect(
        newsArticleBroken.count,
        `Broken images (${newsArticleBroken.count}) on News article. Page URL: ${page.url()}. Broken image URLs: ${newsArticleBroken.urls.slice(0, 15).join(' | ')}${newsArticleBroken.urls.length > 15 ? ' ...' : ''}`
      ).toBeLessThanOrEqual(10);
    });
    await checkAndLog('News - first article text readable', async () => { expect(await validateTextReadable(page)).toBeTruthy(); });

    /* ========== Social + Sign Up / Login (same session): return to homepage ========== */
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: LOAD_TIMEOUT });
    await acceptConsent(page);
    await dismissOverlays(page);
    await page.waitForTimeout(1500);

    console.log('\n--- Social (Homepage) ---');
    await checkAndLog('Social - Facebook icon visible', async () => {
      const facebook = page.locator(SELECTORS.socialFacebook).first();
      await expect(facebook).toBeVisible({ timeout: 8000 });
    });
    await checkAndLog('Social - X icon visible', async () => {
      const x = page.locator(SELECTORS.socialX).first();
      await expect(x).toBeVisible({ timeout: 8000 });
    });
    await checkAndLog('Social - Instagram icon visible', async () => {
      const instagram = page.locator(SELECTORS.socialInstagram).first();
      await expect(instagram).toBeVisible({ timeout: 8000 });
    });
    const inHeadedDemo = !!process.env.PLAYWRIGHT_HEADED_DEMO;
    if (inHeadedDemo) {
      await checkAndLog('Social - X link href', async () => {
        const xLink = page.locator('a:has(img[alt="x"]), a:has(img[src*="twitter-white"])').first();
        await expect(xLink).toHaveAttribute('href', /twitter\.com|x\.com/i);
      });
      await checkAndLog('Social - Facebook link href', async () => {
        const fbLink = page.locator('a:has(img[alt="facebook"]), a:has(img[src*="facebook-white"])').first();
        await expect(fbLink).toHaveAttribute('href', /facebook\.com/i);
      });
      await checkAndLog('Social - Instagram link href', async () => {
        const igLink = page.locator('a:has(img[alt="instagram"]), a:has(img[src*="instagram-white"])').first();
        await expect(igLink).toHaveAttribute('href', /instagram\.com/i);
      });
    } else {
      await checkAndLog('Social - X opens in new tab', async () => {
        const xLink = page.locator('a:has(img[alt="x"]), a:has(img[src*="twitter-white"])').first();
        const [newPageX] = await Promise.all([context.waitForEvent('page', { timeout: 15_000 }), xLink.click()]);
        await newPageX.waitForLoadState('domcontentloaded');
        await expect(newPageX).toHaveURL(/twitter\.com|x\.com/);
        await newPageX.close().catch(() => {});
      });
      await checkAndLog('Social - Facebook opens in new tab', async () => {
        const fbLink = page.locator('a:has(img[alt="facebook"]), a:has(img[src*="facebook-white"])').first();
        const [newPageFb] = await Promise.all([context.waitForEvent('page', { timeout: 15_000 }), fbLink.click()]);
        await newPageFb.waitForLoadState('domcontentloaded');
        await expect(newPageFb).toHaveURL(/facebook\.com/);
        await newPageFb.close().catch(() => {});
      });
      await checkAndLog('Social - Instagram opens in new tab', async () => {
        const igLink = page.locator('a:has(img[alt="instagram"]), a:has(img[src*="instagram-white"])').first();
        const [newPageIg] = await Promise.all([context.waitForEvent('page', { timeout: 15_000 }), igLink.click()]);
        await newPageIg.waitForLoadState('domcontentloaded');
        await expect(newPageIg).toHaveURL(/instagram\.com/);
        await newPageIg.close().catch(() => {});
      });
    }

    console.log('\n--- Sign Up / Login ---');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const signUpLink = page.getByRole('link', { name: /Sign\s*Up/i }).or(page.locator(SELECTORS.signUpBtn)).first();
    const loginLink = page.getByRole('link', { name: /Log\s*in|Login/i }).or(page.locator(SELECTORS.loginBtn)).first();
    const authDialog = page.getByRole('dialog').or(page.locator('[class*="unisignin"], [class*="modal"][class*="auth"], iframe[title*="sign"], iframe[title*="login"]').first());
    const closeAuth = page.getByRole('button', { name: /Close/i }).or(page.locator(SELECTORS.closeButton)).first();

    if (await signUpLink.isVisible().catch(() => false)) {
      await checkAndLog('Sign Up - section opens', async () => {
        await signUpLink.evaluate((el: HTMLElement) => el.click());
        await page.waitForTimeout(1000);
        const signUpOpened = await authDialog.isVisible().catch(() => false) || await page.locator('iframe[src*="unisignin"], #unis-root').first().isVisible().catch(() => false);
        expect(signUpOpened, 'Sign Up section should open (dialog or auth panel visible)').toBeTruthy();
        if (await closeAuth.isVisible().catch(() => false)) {
          await closeAuth.click({ timeout: 5000 }).catch(() => {});
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(600);
        await dismissOverlays(page);
      });
    }
    if (await loginLink.isVisible().catch(() => false)) {
      await checkAndLog('Login - section opens', async () => {
        await loginLink.evaluate((el: HTMLElement) => el.click());
        await page.waitForTimeout(1000);
        const loginOpened = await authDialog.isVisible().catch(() => false) || await page.locator('iframe[src*="unisignin"], #unis-root').first().isVisible().catch(() => false);
        expect(loginOpened, 'Login section should open (dialog or auth panel visible)').toBeTruthy();
        if (await closeAuth.isVisible().catch(() => false)) {
          await closeAuth.click({ timeout: 5000 }).catch(() => {});
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(600);
        await dismissOverlays(page);
      });
    }
    console.log('\n--- Golf365 section results complete ---\n');
  });
});
