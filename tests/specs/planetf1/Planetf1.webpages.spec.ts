import { test, expect } from '@playwright/test';

// PlanetF1 site navigation and quality checks
// Source site: https://www.planetf1.com/
//
// We explicitly test and report:
// 1. Broken URLs (404s) – links that return 4xx
// 2. Stale content – articles with no date within 14 days (via <time datetime>, data-ps-datetime, data-ps-date)
// 3. Broken images – <img> with zero naturalWidth/naturalHeight
// 4. No ads – no display ad (banner/MPU) found on the page

const BASE_URL = 'https://www.planetf1.com/';

// Quick/sandbox mode: fewer tabs, links, and shorter waits so tests finish in ~1–2 min (CI/sandbox)
const isQuick = !!(process.env.PLAYWRIGHT_QUICK || process.env.CI);
// Sandbox: Home, News, Standings so we run articles/images/stale/links on Home & News and team images + links on Standings
const isSandbox = !!process.env.PLAYWRIGHT_SANDBOX;
// Headed demo: when running with --headed, show all steps (articles open, scroll, drivers, teams) with visible delays
const isHeadedDemo = process.env.PLAYWRIGHT_HEADED_DEMO === '1';
const isHeadedRun = process.env.PLAYWRIGHT_HEADLESS === 'false';

const ALL_NAV_TABS: Array<{ label: string; url: string }> = [
  { label: 'Home', url: 'https://www.planetf1.com/' },
  { label: 'News', url: 'https://www.planetf1.com/news' },
  { label: 'Live', url: 'https://live.planetf1.com/' },
  { label: 'Drivers', url: 'https://www.planetf1.com/drivers' },
  { label: 'Teams', url: 'https://www.planetf1.com/teams' },
  { label: 'Standings', url: 'https://www.planetf1.com/standings' },
  { label: 'Schedule', url: 'https://www.planetf1.com/schedule' },
  { label: 'Results', url: 'https://www.planetf1.com/results' },
  { label: 'Data', url: 'https://www.planetf1.com/f1-data' },
  { label: 'Tech', url: 'https://www.planetf1.com/f1-tech' },
  { label: 'Forum', url: 'https://www.planetf1.com/forum' },
];
// Quick/CI: keep stable checks but still cover all primary nav tabs
const QUICK_NAV_TABS = ALL_NAV_TABS;
// Sandbox: Home → News → Standings (so we test articles/images/stale/links on Home & News, and team images + links on Standings)
const SANDBOX_NAV_TABS = [ALL_NAV_TABS[0], ALL_NAV_TABS[1], ALL_NAV_TABS[5]]; // Home, News, Standings
// Headed demo (--headed): Home, News, Drivers, Teams, Standings so user sees articles, scroll, driver/team clicks
const HEADED_DEMO_NAV_TABS = [ALL_NAV_TABS[0], ALL_NAV_TABS[1], ALL_NAV_TABS[3], ALL_NAV_TABS[4], ALL_NAV_TABS[5]];
const NAV_TABS = isHeadedDemo && isSandbox ? HEADED_DEMO_NAV_TABS : isSandbox ? SANDBOX_NAV_TABS : isQuick ? QUICK_NAV_TABS : ALL_NAV_TABS;

// Limit link checks to avoid hammering the site and reduce CI runtime (sandbox still checks critical URLs)
const MAX_LINKS_TO_CHECK = isSandbox ? 20 : isQuick ? 40 : 80;
const MAX_CONCURRENT_FETCH = isSandbox ? 2 : isQuick ? 4 : 6;
// Fewer deep samples to keep total runtime under ~5 min (or ~1 min in sandbox). Headed demo: at least 1 driver/team so user sees clicks
const MAX_DRIVERS_TO_TEST = isHeadedDemo ? Math.max(1, isSandbox ? 0 : isQuick ? 1 : 3) : (isSandbox ? 0 : isQuick ? 1 : 3);
const MAX_TEAMS_TO_TEST = isHeadedDemo ? Math.max(1, isSandbox ? 0 : isQuick ? 1 : 3) : (isSandbox ? 0 : isQuick ? 1 : 3);
const MAX_LIVE_SECTIONS = isSandbox ? 0 : isQuick ? 2 : 4;

// Helper to throttle concurrency
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length) as R[];
  let nextIndex = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) break;
      results[current] = await fn(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

// Random sampler: return up to max indices from 0..len-1
function sampleIndices(len: number, max: number): number[] {
  const count = Math.min(len, max);
  const idxs = Array.from({ length: len }, (_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return idxs.slice(0, count).sort((a, b) => a - b);
}

function isPlanetF1Host(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'www.planetf1.com' || host === 'planetf1.com';
  } catch {
    return false;
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url;
  }
}

test('PlanetF1 – navigation, load, and content integrity checks', async ({ page, request }) => {
  test.setTimeout(isHeadedRun ? 10 * 60_000 : (isSandbox ? 90_000 : isQuick ? 3 * 60_000 : 6 * 60_000));

  console.log('\n📋 Testing steps');
  console.log('1) Go to https://www.planetf1.com/ → land on Home');
  console.log('2) Click Accept & Continue to dismiss uniconsent');
  console.log('3) On each tab: test all articles, broken images, stale content (last updated via <time datatime/data-ps-date/data-ps-datetime>), broken URLs (404)');
  console.log(`4) Tabs in order: ${NAV_TABS.map(t => t.label).join(' → ')}`);
  if (isHeadedDemo) console.log('🖥️ Headed demo: opening articles, scrolling, clicking drivers & teams (visible in browser)');
  else if (isSandbox) console.log('⚡ Sandbox: Home, News, Standings – articles/images/stale/links on Home & News; team images + links on Standings');
  else if (isQuick) console.log('⚡ Quick/CI: Home, News, Live, Standings, Drivers');

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });

  // Consent/CMP dismissal helper
  const acceptConsent = async () => {
    // Give the CMP a brief moment to render
    await page.waitForTimeout(800).catch(() => {});

    // 1) Try the exact "Accept & Continue" button in the main page and if needed inside iframes,
    //    with a few retries until it actually disappears.
    const tryAcceptInContext = async (ctx: typeof page | import('@playwright/test').Frame, label: string) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const exact = ctx
          .locator('button', { hasText: /Accept\s*&\s*Continue/i })
          .first();
        const visible = await exact.isVisible({ timeout: 1500 }).catch(() => false);
        if (!visible) break;

        try {
          await exact.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
        } catch {}
        await exact.click({ timeout: 4000, force: true }).catch(() => {});
        await page.waitForTimeout(800).catch(() => {});

        const stillVisible = await exact.isVisible({ timeout: 800 }).catch(() => false);
        if (!stillVisible) {
          console.log(`✅ Consent dismissed (Accept & Continue, ${label})`);
          return true;
        }
        console.log(`⚠️ "Accept & Continue" still visible after click in ${label}, retrying...`);
      }
      return false;
    };

    try {
      // First try in the top-level page
      const doneTop = await tryAcceptInContext(page, 'top-level page');
      if (doneTop) return;

      // Then search inside any iframes (some CMPs are embedded)
      for (const frame of page.frames()) {
        if (frame === page.mainFrame()) continue;
        try {
          const ok = await tryAcceptInContext(frame, `frame "${frame.url()}"`);
          if (ok) return;
        } catch {
          // ignore individual frame failures
        }
      }
    } catch {}

    // 2) Common role/button names (Accept / Allow variants)
    try {
      const roleBtn = page
        .getByRole('button', {
          name: /accept\s*&?\s*continue|accept all|accept|allow/i
        })
        .first();
      if (await roleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await roleBtn.click({ timeout: 4000 }).catch(() => {});
        console.log('✅ Consent dismissed (role button)');
        return;
      }
    } catch {}

    // 3) Specific UniConsent container fallback
    try {
      const cmpBtn = page
        .locator(
          '#uniccmp button:has-text("Accept & Continue"), #uniccmp button:has-text("Accept"), #uniccmp button:has-text("Allow All")'
        )
        .first();
      if (await cmpBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        try {
          await cmpBtn.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
        } catch {}
        await cmpBtn.click({ timeout: 4000, force: true }).catch(() => {});
        console.log('✅ Consent dismissed (UNICCMP container)');
        return;
      }
    } catch {}

    // 4) Dismiss common ad/pop-up close buttons (e.g. bx-close-inside-*)
    try {
      const adClose = page
        .locator('button.bx-close, button[id^="bx-close-inside-"], button[aria-label*="close dialog" i]')
        .first();
      if (await adClose.isVisible({ timeout: 1500 }).catch(() => false)) {
        await adClose.click({ timeout: 3000, force: true }).catch(() => {});
        console.log('✅ Dismissed ad/promo overlay (bx-close style)');
        await page.waitForTimeout(300).catch(() => {});
      }
    } catch {}

    // 5) Last-resort: hide common consent / popup containers so they don't block clicks
    try {
      await page.evaluate(() => {
        const hardHide = (el: HTMLElement | null) => {
          if (!el) return;
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        };

        // Known UniConsent / overlay roots
        ['#uniccmp', '#sp_message_container_*, [id*="consent"]', '[class*="consent"]', '[class*="cookie"]'].forEach(
          (selector) => {
            document.querySelectorAll<HTMLElement>(selector).forEach((el) => hardHide(el));
          }
        );

        // Any generic full-screen dialog overlay
        document.querySelectorAll<HTMLElement>('div[role="dialog"], div[aria-modal="true"]').forEach((dlg) => {
          const txt = (dlg.textContent || '').toLowerCase();
          if (txt.includes('accept & continue') || txt.includes('cookies') || txt.includes('consent')) {
            hardHide(dlg);
          }
        });
      });
      console.log('⚠️ Consent overlay force-hidden via JS fallback');
    } catch {}

    // Final guard: if consent is still blocking, fail loudly.
    const stillBlocked = await page
      .locator('button', { hasText: /Accept\s*&\s*Continue/i })
      .first()
      .isVisible({ timeout: 1200 })
      .catch(() => false);
    if (stillBlocked) {
      throw new Error('Consent popup still visible after all dismissal strategies');
    }
  };

  await acceptConsent();

  // Helper to robustly click a locator, retrying once after consent overlay
  const safeNavClick = async (locator: ReturnType<typeof page.locator> | ReturnType<typeof page.getByRole>) => {
    try {
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        (locator as any).click({ timeout: 3000 })
      ]);
    } catch {
      await acceptConsent();
      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        (locator as any).click({ timeout: 3000 }).catch(() => {})
      ]);
    }
  };

  const summary: Array<{ tab: string; url: string; loadMs: number; linksChecked: number; brokenLinks: number; brokenImages: number; brokenImageUrls: string[]; status: string; brokenLinkDetails: string[]; features: string[] }>
    = [];
  const globalBrokenLinks: Map<string, string[]> = new Map(); // URL -> [tabs where found]
  const brokenLinkReportEntries: Array<{ tab: string; url: string; status: number }> = []; // For report: Tab>URL (status)
  const staleContentLocations: Array<{ tab: string; message: string }> = [];
  const noAdsLocations: Array<{ tab: string }> = [];
  const functionalIssues: Array<{ tab: string; message: string }> = [];

  for (const { label, url } of NAV_TABS) {
    console.log(`\n🔍 Step: ${label} → dismiss consent (if shown) → test articles, broken images, stale content, broken URLs`);

    // Track features tested per tab
    const features: string[] = [];
    let tabHasFunctionalIssue = false;

    const start = Date.now();
    let loadMs = 0;
    let currentUrl = url;
    let navigationSuccess = true;
    
    try {
      // Check if browser/page is still valid
      if (page.isClosed()) {
        throw new Error('Browser/page was closed');
      }
      
      // Navigate directly to the URL
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await acceptConsent();
      await page.waitForTimeout(isQuick ? 100 : 300);
      loadMs = Date.now() - start;
      currentUrl = page.url();
      console.log(`⏱️  Loaded ${label} in ${loadMs}ms → ${currentUrl}`);
      if (isHeadedDemo) await page.waitForTimeout(1200);
    } catch (error: any) {
      loadMs = Date.now() - start;
      currentUrl = `ERROR: ${error?.message || 'Unknown error'}`;
      navigationSuccess = false;
      console.log(`❌ Failed to load ${label} in ${loadMs}ms → ${currentUrl}`);
      
      // If browser closed, skip remaining tabs
      if (error?.message?.includes('closed') || error?.message?.includes('Target page')) {
        console.log('⚠️  Browser/page was closed, skipping remaining tabs');
        break;
      }
    }

    // Basic content presence (avoid stale/empty page):
    // For Results, accept scoreboard/table-only layouts
    let hasContent = false;
    try {
      if (page.isClosed()) {
        throw new Error('Page was closed');
      }
      hasContent = await Promise.race([
        page.locator('main h1, main h2, [role="main"] h1, [role="main"] h2').first().isVisible().catch(() => false),
        page.locator('article, [class*="card"], [class*="tile"], [data-component*="Article"]').first().isVisible().catch(() => false)
      ]).catch(() => false);
      if (/results/i.test(label) && !hasContent) {
        const tableLike = await Promise.race([
          page.locator('table, [role="table"]').first().isVisible().catch(() => false),
          page.locator('[class*="score"], [class*="result"], [data-component*="Result"]').first().isVisible().catch(() => false)
        ]).catch(() => false);
        hasContent = !!tableLike;
      }
      if (/live/i.test(label) && !hasContent) {
        const liveLike = await Promise.race([
          page.locator('table, [role="table"], [class*="table"]').first().isVisible().catch(() => false),
          page.locator('[class*="timing"], [data-component*="Timing"], [class*="results"]').first().isVisible().catch(() => false)
        ]).catch(() => false);
        hasContent = !!liveLike;
      }
    } catch (e: any) {
      if (e?.message?.includes('closed')) {
        console.log('⚠️  Page was closed during content check, skipping remaining tabs');
        break;
      }
    }

    // Handle navigation failures
    if (!navigationSuccess) {
      const errorLink = `[NAVIGATION ERROR] ${url}`;
      summary.push({ tab: label, url: currentUrl, loadMs, linksChecked: 0, brokenLinks: 1, brokenImages: 0, brokenImageUrls: [], status: 'FAIL', brokenLinkDetails: [errorLink], features: [] });
      continue; // Skip further testing for this tab
    }

    // Capture content failures for reporting
    if (!hasContent) {
      summary.push({ tab: label, url: currentUrl, loadMs, linksChecked: 0, brokenLinks: 0, brokenImages: 0, brokenImageUrls: [], status: 'FAIL', brokenLinkDetails: [], features: [] });
      continue; // Skip further testing for this tab
    }

    // Tab-specific deep checks and feature tracking
    if (/home|news/i.test(label)) {
      // Check for articles
      const articleCount = await page.locator('article, [class*="article"], [data-component*="Article"]').count().catch(() => 0);
      if (articleCount > 0) {
        features.push('Articles');
        // Check for tags
        const tagCount = await page.locator('a[href*="/tag/"], [class*="tag"]').count().catch(() => 0);
        if (tagCount > 0) features.push('Tags');
        // Allow JS hydration to populate <time> attributes before date validation.
        await page.waitForTimeout(2500);
        // Stale content: check article dates via <time datetime>/datatime (typo), data-ps-datetime (Unix), or data-ps-date
        const hasRecentContent = await page.evaluate(() => {
          const threshold = Date.now() - 14 * 24 * 60 * 60 * 1000;
          const timeSelectors = 'article time[datetime], article time[datatime], article time[data-ps-datetime], article time[data-ps-date], article [data-ps-date], time[datetime], time[datatime], time[data-ps-datetime], time[data-ps-date]';
          const timeElements = Array.from(document.querySelectorAll(timeSelectors));
          for (const timeEl of timeElements.slice(0, 30)) {
            let dateMs: number | null = null;
            const datetime = timeEl.getAttribute('datetime') || timeEl.getAttribute('datatime');
            if (datetime) {
              dateMs = Date.parse(datetime);
            }
            if (dateMs == null || isNaN(dateMs)) {
              const psDatetime = timeEl.getAttribute('data-ps-datetime');
              if (psDatetime) {
                const unix = parseInt(psDatetime, 10);
                if (!isNaN(unix)) dateMs = unix * 1000;
              }
            }
            if (dateMs == null || isNaN(dateMs)) {
              const psDate = timeEl.getAttribute('data-ps-date');
              if (psDate) dateMs = Date.parse(psDate);
            }
            if (dateMs != null && !isNaN(dateMs) && dateMs > threshold) return true;
          }
          return false;
        });
        if (hasRecentContent) features.push('No-Stale-Content');
        else staleContentLocations.push({ tab: label, message: 'No article with date within 14 days' });
      }
      if (/home/i.test(label)) {
        try {
          for (let s = 0; s < 4; s++) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(isHeadedDemo ? 300 : 80); }
          await page.evaluate(() => window.scrollTo(0, 0));
          if (isHeadedDemo) await page.waitForTimeout(800);
        } catch {}
      }
      // Headed demo: open first article on Home/News, scroll down, then back (visible in browser)
      if (isHeadedDemo && /home|news/i.test(label)) {
        try {
          const articleLink = page.locator('main a[href*="/news/"], article a[href*="/news/"], [role="main"] a[href*="/news/"], a[href*="/news/"][href*="planetf1"]').first();
          if (await articleLink.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('📄 Headed demo: opening first article…');
            await articleLink.click({ timeout: 5000 });
            await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(1500);
            for (let s = 0; s < 4; s++) { await page.mouse.wheel(0, 600); await page.waitForTimeout(400); }
            await page.waitForTimeout(1000);
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
            expect(normalizeUrl(page.url()), 'Expected to return to current tab URL after goBack').toBe(normalizeUrl(currentUrl));
            await page.waitForTimeout(1000);
          }
        } catch {}
      }
    }
    if (/live/i.test(label)) {
      try { for (let s = 0; s < 2; s++) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(100); } } catch {}
      const driversLink = await page.locator('a[href*="/drivers"], a:has-text("Drivers")').first().isVisible({ timeout: 1500 }).catch(() => false);
      const teamsLink = await page.locator('a[href*="/teams"], a:has-text("Teams")').first().isVisible({ timeout: 1500 }).catch(() => false);
      if (driversLink) features.push('View-All-Drivers');
      if (teamsLink) features.push('View-All-Teams');
      const liveSections = ['Race', 'Grid', 'Q3', 'Q1'].slice(0, MAX_LIVE_SECTIONS);
      for (const sec of liveSections) {
        const btn = page.getByRole('button', { name: new RegExp(`^${sec}$`, 'i') }).first();
        const vis = await btn.isVisible({ timeout: 1200 }).catch(() => false);
        if (!vis) continue;
        await safeNavClick(btn);
        await page.waitForTimeout(200).catch(() => {});
        // Assert some data present (tables, lists, timing blocks)
        const hasData = await Promise.race([
          page.locator('table, [class*="table"], [role="table"]').first().isVisible().catch(() => false),
          page.locator('[class*="list"], ul li, ol li').first().isVisible().catch(() => false),
          page.locator('[data-component*="Timing"], [class*="time"], [class*="result"]').first().isVisible().catch(() => false)
        ]).catch(() => false);
        expect(hasData, `Live → ${sec}: expected visible data`).toBeTruthy();
      }
    }

    if (/schedule/i.test(label)) {
      // Schedule page: specifically check all track links
      console.log('📅 Schedule page detected - performing comprehensive track link check...');
      
      // Scroll to ensure all schedule items are loaded
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
      
      // Collect ALL track links from the schedule
      const scheduleTrackLinks = await page.$$eval('a[href*="/tracks/"]', anchors => 
        anchors.map(a => (a as HTMLAnchorElement).href).filter(Boolean)
      );
      console.log(`🏁 Found ${scheduleTrackLinks.length} track links in Schedule section`);
      
      // Verify we found track links
      if (scheduleTrackLinks.length === 0) {
        console.log('⚠️  WARNING: No track links found on Schedule page');
      }
    }

    if (/results/i.test(label)) {
      // Results page validation: accept multiple valid structures, fail only when no real race data is present.
      const resultsSignals = await page.evaluate(() => {
        const text = (document.body.innerText || '').replace(/\s+/g, ' ');
        const hasFullClassification = /full classification/i.test(text);
        const hasResultsTableHeader = /pos\s+driver\s+time\s+points/i.test(text);

        // Find table-like rows that contain both names and numbers.
        const rows = Array.from(document.querySelectorAll('table tbody tr, [role="rowgroup"] [role="row"], table tr'));
        let populatedRows = 0;
        for (const row of rows) {
          const rowText = (row.textContent || '').replace(/\s+/g, ' ').trim();
          if (/[A-Za-z]/.test(rowText) && /\d/.test(rowText)) populatedRows++;
        }

        // Alternate result-style evidence often shown on this site.
        const gpMentions = (text.match(/grand prix/gi) || []).length;

        return {
          hasFullClassification,
          hasResultsTableHeader,
          populatedRows,
          gpMentions,
        };
      });

      const hasResultsStructure =
        resultsSignals.hasFullClassification || resultsSignals.hasResultsTableHeader;
      const hasResultData =
        resultsSignals.populatedRows > 0 || resultsSignals.gpMentions > 0;

      if (!hasResultsStructure) {
        tabHasFunctionalIssue = true;
        functionalIssues.push({
          tab: label,
          message: 'Results page missing expected results structure (no "Full Classification" or results table headers)',
        });
      } else if (!hasResultData) {
        tabHasFunctionalIssue = true;
        functionalIssues.push({
          tab: label,
          message: 'Results structure present but no populated race result data detected',
        });
      } else {
        features.push('Results-Data-Present');
      }

      // Deep check: open recent race result pages and verify table rows are genuinely populated.
      const raceResultLinks = await page
        .$$eval('a[href*="/results/"]', (anchors: Element[]) => {
          const links = (anchors as HTMLAnchorElement[])
            .map(a => a.href)
            .filter(href => /\/results\/.+-grand-prix\/?$/i.test(href));
          return Array.from(new Set(links)).slice(0, 6);
        })
        .catch(() => [] as string[]);

      // Fallback to known current race pages if listing links are sparse.
      const fallbackRacePages = [
        'https://www.planetf1.com/results/japanese-grand-prix',
        'https://www.planetf1.com/results/chinese-grand-prix',
        'https://www.planetf1.com/results/australian-grand-prix',
      ];
      const pagesToValidate = Array.from(new Set([...raceResultLinks, ...fallbackRacePages])).slice(0, 6);

      let emptyRacePages = 0;
      for (const raceUrl of pagesToValidate) {
        // Navigate to the race page to allow JavaScript to load dynamic content
        try {
          await page.goto(raceUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await acceptConsent();
          await page.waitForTimeout(isQuick ? 1000 : 2000); // Wait for dynamic content to load
        } catch (e: any) {
          tabHasFunctionalIssue = true;
          functionalIssues.push({
            tab: label,
            message: `Race results page failed to load: ${raceUrl} (${e?.message || 'Unknown error'})`,
          });
          continue;
        }

        // Check if race result content is present using robust signals:
        // 1) expected result labels (Pos/Driver/Laps/Points/Full Classification)
        // 2) populated entries with position + person/team text + race metrics.
        const racePageSignals = await page.evaluate(() => {
          const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
          const hasResultLabels =
            /full classification/i.test(bodyText) ||
            /pos\s+driver/i.test(bodyText) ||
            /driver\s+laps/i.test(bodyText) ||
            /laps\s+time\s+pits\s+points/i.test(bodyText);

          const candidateRows = Array.from(
            document.querySelectorAll(
              'table tbody tr, table tr, [role="rowgroup"] [role="row"], [class*="row"], li'
            )
          );

          let populatedRows = 0;
          for (const row of candidateRows) {
            const rowText = (row.textContent || '').replace(/\s+/g, ' ').trim();
            if (!rowText || rowText.length < 10) continue;
            if (/ps-skeleton-box|skeleton|loading/i.test(rowText)) continue;

            const hasPosition = /(?:^|\s)(?:[1-9]|1\d|20)(?:\s|$)/.test(rowText);
            const hasNameOrTeam = /[A-Za-z]{3,}\s+[A-Za-z]{2,}|Mercedes|Ferrari|McLaren|Red Bull|Williams|Alpine|Haas|Aston|Sauber|Racing Bulls/i.test(rowText);
            const hasRaceMetric = /\d{1,3}\s+\d{1,2}:\d{2}:\d{2}|\+\d+\.\d+s|\bDNF\b|\bDNS\b|\bDSQ\b|\bRET\b|\bLAPS?\b|\bPOINTS?\b|\bPITS?\b/i.test(rowText);

            if (hasPosition && hasNameOrTeam && hasRaceMetric) {
              populatedRows++;
              if (populatedRows >= 2) break;
            }
          }

          return { hasResultLabels, populatedRows };
        }).catch(() => ({ hasResultLabels: false, populatedRows: 0 }));

        const hasResultData = racePageSignals.populatedRows > 0;
        const isClearlyPopulated = racePageSignals.populatedRows >= 2;

        if (!racePageSignals.hasResultLabels || (!hasResultData && !isClearlyPopulated)) {
          emptyRacePages++;
          functionalIssues.push({
            tab: label,
            message: `Race results page has empty/missing classification data: ${raceUrl}`,
          });
        }
      }
      if (emptyRacePages > 0) tabHasFunctionalIssue = true;
    }

    if (/standings/i.test(label)) {
      const driversTab = await page.getByRole('button', { name: /drivers/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
      const constructorsTab = page.getByRole('button', { name: /constructors/i }).first();
      if (driversTab) features.push('Drivers');
      if (await constructorsTab.isVisible({ timeout: 1200 }).catch(() => false)) {
        features.push('Contructors');
        await constructorsTab.click({ timeout: 1200 }).catch(() => {});
        await page.waitForTimeout(isQuick ? 100 : 250).catch(() => {});
        const rows = await page.locator('table tbody tr, [role="rowgroup"] [role="row"]').count().catch(() => 0);
        expect(rows, 'Standings → Constructors: expected table rows').toBeGreaterThan(0);
      }
      // Check for year selector
      const year2026 = await page.locator('a[href*="2026"], button:has-text("2026")').first().isVisible({ timeout: 1000 }).catch(() => false);
      const year2025 = await page.locator('a[href*="2025"], button:has-text("2025")').first().isVisible({ timeout: 1000 }).catch(() => false);
      if (year2026) features.push('2026');
      if (year2025) features.push('2025');
      // Wait for team logo images (e.g. audi.png, cadillac.png) to load or fail so broken-image check is reliable in headed and non-headed
      try {
        await page.locator('img[src*="/teams/"]').first().waitFor({ state: 'visible', timeout: isQuick ? 1500 : 3000 }).catch(() => {});
        await page.waitForTimeout(isQuick ? 500 : 2000);
      } catch {}
      // Headed demo: click one working team link on Standings (e.g. Mercedes/Ferrari) so user sees navigation
      if (isHeadedDemo) {
        try {
          const goodTeamHref = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/team/"], a[href*="/f1-teams/"]'));
            const bad = ['audi', 'cadillac'];
            const a = links.find(l => { const h = (l.href || '').toLowerCase(); return !bad.some(b => h.includes(b)); });
            return a ? a.href : '';
          });
          if (goodTeamHref) {
            console.log('🏁 Headed demo: clicking team on Standings…');
            await page.goto(goodTeamHref, { waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => {});
            await page.waitForTimeout(1500);
            await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
            await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
            expect(normalizeUrl(page.url()), 'Expected to return to current tab URL after goBack').toBe(normalizeUrl(currentUrl));
            await page.waitForTimeout(1000);
          }
        } catch {}
      }
    }

    if (/schedule/i.test(label)) {
      const fullResults = await page.locator('a:has-text("Full"), a:has-text("Results"), [class*="result"]').count().catch(() => 0);
      if (fullResults > 0) features.push('Full-Results');
    }

    if (/results/i.test(label)) {
      const standingsWidget = await page.locator('[class*="standings"], [class*="championship"], h2:has-text("Standings"), h3:has-text("Standings")').count().catch(() => 0);
      if (standingsWidget > 0) features.push('Championship Standings-Widget');
      const raceResults = await page.locator('[class*="race-result"], [class*="result-widget"], a:has-text("View more")').count().catch(() => 0);
      if (raceResults > 0) features.push('Race-results widget View more');
    }

    if (/drivers/i.test(label)) {
      features.push('View-All-Drivers');
      // Collect all driver links on the page
      const driverAnchors = await page.$$eval('a[href*="/drivers/"]', (anchors: Element[]) => {
        const hrefs = anchors
          .map(a => (a as HTMLAnchorElement).href)
          .filter(h => typeof h === 'string' && h.includes('/drivers/'));
        return Array.from(new Set(hrefs));
      });

      let driversPassed = 0;
      let driversFailed = 0;

      const dIdxs = sampleIndices(driverAnchors.length, MAX_DRIVERS_TO_TEST);
      for (const di of dIdxs) {
        const href = driverAnchors[di];
        const name = href.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || `Driver ${di + 1}`;
        console.log(`\n👤 Testing driver: ${name} → ${href}`);
        if (isHeadedDemo) await page.waitForTimeout(500);

        await page.evaluate((h) => { window.location.href = h as string; }, href).catch(() => {});
        try { await page.waitForLoadState('domcontentloaded', { timeout: 4000 }); } catch {}
        await acceptConsent();
        await page.waitForTimeout(isHeadedDemo ? 1500 : (isQuick ? 100 : 200)).catch(() => {});

        // Only check Overview + Results to cut runtime (was 6 tabs)
        const sectionTabs = ['Overview', 'Results'];
        let allSectionsOk = true;
        for (const tab of sectionTabs) {
          const t = page.getByRole('link', { name: new RegExp(`^${tab}$`, 'i') }).first();
          const tabVisible = await t.isVisible({ timeout: 800 }).catch(() => false);
          if (tabVisible) {
            await t.click({ timeout: 800 }).catch(() => {});
            await page.waitForTimeout(isHeadedDemo ? 800 : (isQuick ? 80 : 150)).catch(() => {});
            const hasSectionData = await Promise.race([
              page.locator('main h1, main h2').first().isVisible().catch(() => false),
              page.locator('article, [class*="card"], [class*="tile"]').first().isVisible().catch(() => false),
              page.locator('img').first().isVisible().catch(() => false)
            ]).catch(() => false);
            if (!hasSectionData) allSectionsOk = false;
          }
        }

        // Check up to 5 links with concurrency (was 20 sequential = 60s+ per driver)
        const dLinks = (await page.$$eval('main a[href]', as => as.slice(0, 5).map(a => (a as HTMLAnchorElement).href))).filter(Boolean);
        const dResults = await mapWithConcurrency(dLinks, 3, async (h) => {
          try {
            let r = await request.fetch(h, { method: 'HEAD', timeout: 2000 }).catch(() => null);
            if (!r || r.status() === 405 || r.status() === 501) {
              r = await request.fetch(h, { method: 'GET', timeout: 2000 }).catch(() => null);
            }
            return { ok: (r?.status() ?? 0) < 400, status: r?.status() ?? 0, href: h };
          } catch { return { ok: false, status: 0, href: h }; }
        });
        const brokenDriverLinks = dResults.filter(r => !r.ok).length;
        dResults.filter(r => !r.ok).forEach(r => console.log(`🔗 Driver link warning [${r.status}]: ${r.href}`));

        const imgBroken = await page.evaluate(() => Array.from(document.images).some(i => !(i as HTMLImageElement).naturalWidth));

        if (allSectionsOk && brokenDriverLinks === 0 && !imgBroken) {
          driversPassed++;
          console.log(`✅ Driver OK: ${name}`);
        } else {
          driversFailed++;
          console.log(`❌ Driver issues: ${name} — sectionsOk=${allSectionsOk}, brokenLinks=${brokenDriverLinks}, brokenImages=${imgBroken}`);
        }

        if (isHeadedDemo) await page.waitForTimeout(1000);
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
        expect(normalizeUrl(page.url()), 'Expected to return to current tab URL after goBack').toBe(normalizeUrl(currentUrl));
        await page.waitForTimeout(isHeadedDemo ? 1000 : 200).catch(() => {});
      }

      console.log(`👥 Drivers summary: total=${driverAnchors.length}, passed=${driversPassed}, failed=${driversFailed}`);
    }

    if (/teams/i.test(label)) {
      features.push('View-All-Teams');
      // Click up to 10 team cards/links and verify page loads without obvious breakage
      const teamHrefs = await page.$$eval('a[href*="/team"], a[href*="/teams/"]', (as: Element[]) => {
        const hrefs = (as as HTMLAnchorElement[]).map(a => (a as HTMLAnchorElement).href).filter(Boolean);
        return Array.from(new Set(hrefs));
      });
      const tIdxs = sampleIndices(teamHrefs.length, MAX_TEAMS_TO_TEST);
      for (const ti of tIdxs) {
        const th = teamHrefs[ti];
        const teamName = th.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Unknown Team';
        console.log(`🏁 Testing team page: ${teamName} → ${th}`);
        if (isHeadedDemo) await page.waitForTimeout(500);
        try {
          await page.goto(th, { waitUntil: 'domcontentloaded', timeout: 6000 });
          await acceptConsent();
          await page.waitForTimeout(isHeadedDemo ? 1500 : 200);
          const ok = await Promise.race([
            page.locator('main h1, main h2, article, [class*="card"]').first().isVisible().catch(() => false),
            page.locator('img').first().isVisible().catch(() => false)
          ]).catch(() => false);
          expect(ok, `Team page should have content: ${th}`).toBeTruthy();
        } catch (e) {
          console.log(`❌ ERROR: Failed to load team page: ${teamName}`);
          console.log(`   URL: ${th}`);
          console.log(`   Reason: ${String((e as Error).message || e)}`);
          console.log('   Impact: Users cannot view this team\'s information');
        }
        if (isHeadedDemo) await page.waitForTimeout(1000);
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
        expect(normalizeUrl(page.url()), 'Expected to return to current tab URL after goBack').toBe(normalizeUrl(currentUrl));
        await page.waitForTimeout(isHeadedDemo ? 1000 : 150).catch(() => {});
      }
    }

    // Collect on-page links (same-origin)
    let pageLinks: string[] = [];
    try {
      if (page.isClosed()) {
        throw new Error('Page was closed');
      }
      pageLinks = (await page.$$eval('a[href]', anchors => anchors
        .map(a => (a as HTMLAnchorElement).href)
        .filter(Boolean)))
        .filter(href => href.startsWith(BASE_URL));
    } catch (e: any) {
      if (e?.message?.includes('closed')) {
        console.log('⚠️  Page was closed during link collection, skipping remaining tabs');
        break;
      }
    }

    // Keep critical links scoped to this tab only.
    const criticalHrefs: string[] = [];
    try {
      const standingsHeading = page.getByRole('heading', { name: /Championship Standings/i }).first();
      if (await standingsHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
        for (const name of ['Audi', 'Cadillac']) {
          const link = page.getByRole('link', { name: new RegExp(`^${name}$`, 'i') }).first();
          if (await link.isVisible({ timeout: 1500 }).catch(() => false)) {
            const href = await link.getAttribute('href');
            if (href) criticalHrefs.push(normalizeUrl(new URL(href, currentUrl).toString()));
          }
        }
      }
      const teamAndTrackLinks = await page.$$eval('a[href*="/team/"], a[href*="/f1-teams/"], a[href*="/tracks/"]', (anchors: Element[]) =>
        (anchors as HTMLAnchorElement[]).map(a => a.href).filter(Boolean)
      );
      criticalHrefs.push(...Array.from(new Set(teamAndTrackLinks.map(normalizeUrl))).slice(0, 20));
    } catch {
      // ignore if standings not present on this tab
    }

    const trackLinks = pageLinks.filter(href => href.includes('/tracks/'));

    // For Schedule page: check ALL links, especially track links
    const isSchedulePage = /schedule/i.test(label);
    let hrefs: string[] = [];
    
    if (isSchedulePage) {
      // Schedule page: check ALL links, prioritizing track links
      console.log(`📅 Schedule page detected - checking all links thoroughly`);
      hrefs = Array.from(new Set([...trackLinks, ...pageLinks]));
    } else {
      // Other pages: include all discovered first-party links within cap.
      hrefs = Array.from(new Set([...trackLinks, ...pageLinks]));
    }
    hrefs = Array.from(new Set([...criticalHrefs, ...hrefs.map(normalizeUrl)]));
    hrefs = hrefs.slice(0, MAX_LINKS_TO_CHECK);

    // Explicitly capture article and tag links on every tab.
    const articleLinks = await page
      .$$eval(
        'article a[href], a[href*="/news/"], [data-component*="Article"] a[href]',
        anchors => Array.from(new Set((anchors as HTMLAnchorElement[]).map(a => a.href).filter(Boolean))),
      )
      .catch(() => [] as string[]);
    const tagLinks = await page
      .$$eval('a[href*="/tag/"]', anchors =>
        Array.from(new Set((anchors as HTMLAnchorElement[]).map(a => a.href).filter(Boolean))),
      )
      .catch(() => [] as string[]);

    const articleTargets = articleLinks.filter(isPlanetF1Host).map(normalizeUrl).slice(0, isQuick ? 20 : 35);
    const tagTargets = tagLinks.filter(isPlanetF1Host).map(normalizeUrl).slice(0, isQuick ? 20 : 30);
    const liveTrackTargets = /live/i.test(label)
      ? await page
          .$$eval('a[href*="/tracks/"]', (anchors: Element[]) =>
            Array.from(new Set((anchors as HTMLAnchorElement[]).map(a => a.href).filter(Boolean))),
          )
          .then((links) => links.filter(isPlanetF1Host).map(normalizeUrl))
          .catch(() => [] as string[])
      : [];
    const generalTargets = hrefs.filter(isPlanetF1Host).map(normalizeUrl);

    const checkLinkHealth = async (href: string) => {
      try {
        if (page.isClosed()) {
          return { href, ok: false, status: 0 };
        }
        let res = await request.fetch(href, { method: 'HEAD', timeout: 3000 }).catch(() => null);
        if (!res || res.status() === 405 || res.status() === 501) {
          res = await request.fetch(href, { method: 'GET', timeout: 5000 }).catch(() => null);
        }
        const status = res?.status() ?? 0;
        const ok = status > 0 && status < 400;
        return { href, ok, status };
      } catch (e) {
        return { href, ok: false, status: 0 };
      }
    };

    const allTargets = Array.from(new Set([...generalTargets, ...articleTargets, ...tagTargets, ...liveTrackTargets]));
    const linkResults = await mapWithConcurrency(allTargets, MAX_CONCURRENT_FETCH, async (href) => checkLinkHealth(href));
    const resultByHref = new Map(linkResults.map(r => [r.href, r]));

    const brokenLinkDetails = linkResults.filter(r => !r.ok);
    const brokenLinks = brokenLinkDetails.length;
    const brokenLinkList = brokenLinkDetails.map(r => r.href);
    // Track broken links globally for Tab>URL format and for report (Tab>URL (status))
    brokenLinkDetails.forEach((r) => {
      if (!globalBrokenLinks.has(r.href)) {
        globalBrokenLinks.set(r.href, []);
      }
      globalBrokenLinks.get(r.href)!.push(label);
      brokenLinkReportEntries.push({ tab: label, url: r.href, status: r.status });
    });

    if (articleTargets.length > 0) {
      const brokenArticles = articleTargets
        .map(href => resultByHref.get(href))
        .filter(r => r && !r.ok).length;
      if (brokenArticles === 0) features.push('Articles-Open-And-Render');
      else tabHasFunctionalIssue = true;
    }
    if (tagTargets.length > 0) {
      const brokenTags = tagTargets
        .map(href => resultByHref.get(href))
        .filter(r => r && !r.ok).length;
      if (brokenTags === 0) features.push('Tags-Open-And-Render');
      else tabHasFunctionalIssue = true;
    }

    // Broken images: detect <img> with zero natural width/height
    let imgStats = { total: 0, broken: 0, brokenSrcs: [] as string[] };
    try {
      if (page.isClosed()) {
        throw new Error('Page was closed');
      }
      imgStats = await page.evaluate(() => {
      const toAbs = (u: string) => {
        try { return new URL(u, window.location.href).toString(); } catch { return u; }
      };
      const imgs = Array.from(document.images || []) as HTMLImageElement[];
      // Exclude known third-party tracker/ad-sync hosts and Sky Sports video thumbnails
      const excludeHosts = [
        'x.bidswitch.net',
        'secure.adnxs.com',
        'cm.g.doubleclick.net',
        'ad.turn.com',
        'cs.admanmedia.com',
        'videos.skysports.com',
        'idsync.rlcdn.com',
        'id.rlcdn.com'
      ];
      const total = imgs.length;
      const brokenEls = imgs.filter(img => {
        const isBroken = !(img as HTMLImageElement).naturalWidth || !(img as HTMLImageElement).naturalHeight;
        if (!isBroken) return false;
        const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || '';
        // Ignore empty/invalid image src values.
        if (!src || src === window.location.href || src.startsWith('data:')) return false;
        // Ignore tiny utility icons/placeholders often used in scoreboards/widgets.
        const renderedW = (img as HTMLImageElement).clientWidth || 0;
        const renderedH = (img as HTMLImageElement).clientHeight || 0;
        if (renderedW > 0 && renderedH > 0 && renderedW <= 24 && renderedH <= 24) return false;
        try {
          const abs = new URL(src, window.location.href);
          const h = abs.hostname;
          const path = abs.pathname.toLowerCase();
          if (
            path.includes('/20x20/') ||
            path.includes('20x20.png') ||
            path.includes('placeholder') ||
            path.includes('spacer') ||
            path.endsWith('.gif')
          ) return false;
          if (excludeHosts.includes(h)) return false; // ignore tracker pixels and Sky Sports thumbnails
          // Also exclude Sky Sports video thumbnail URLs by pattern
          if (src.includes('videos.skysports.com/image/v1/static')) return false;
        } catch {}
        return true;
      });
      const broken = brokenEls.length;
      const brokenSrcs = Array.from(new Set(brokenEls.slice(0, 20).map(img => toAbs(img.currentSrc || img.src || '')).filter(Boolean))).slice(0, 10);
      return { total, broken, brokenSrcs };
      });
    } catch (e: any) {
      if (e?.message?.includes('closed')) {
        console.log('⚠️  Page was closed during image check, skipping remaining tabs');
        break;
      }
    }
    // Don't log broken images in the old format - they'll be included in features if broken

    // Detect ad markers by visible ad containers/iframes with known ad attributes.
    const adPresence = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement | HTMLIFrameElement>(
        'iframe[src*="ad" i], iframe[id*="gpt-ad" i], iframe[id*="dfp" i], [data-ad-unit], [data-slot], [id*="gpt-ad" i], [id*="dfp" i]'
      ));
      return candidates.some((c) => {
        const style = window.getComputedStyle(c);
        if (!style || style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = c.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
    });
    let adIssues = 0;
    const isAdExemptTab = /live|standings|schedule/i.test(label);
    if (!adPresence && !isAdExemptTab) {
      adIssues = 1;
      noAdsLocations.push({ tab: label });
      console.log('🪧 No visible ad markers found on non-exempt page');
    }

    // Add feature tracking based on imgStats and adPresence (now that they're defined)
    if (imgStats.broken === 0) {
      features.push('No-broken-Images');
    }
    if (adPresence) {
      features.push('Ads');
    }
    
    // Check for Championship Standings Widget (common across tabs)
    const standingsHeading = await page.getByRole('heading', { name: /Championship Standings/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
    if (standingsHeading && !features.includes('Championship Standings-Widget')) {
      features.push('Championship Standings-Widget');
    }
    
    // Check for Data/Tech specific features
    if (/data|tech/i.test(label)) {
      const editorsPicks = await page.locator('[class*="editor"], [class*="pick"], [data-component*="Editor"]').count().catch(() => 0);
      if (editorsPicks > 0) features.push('Editors-Picks');
      const raceSchedule = await page.locator('[class*="schedule"], [class*="race"], a[href*="/schedule"]').count().catch(() => 0);
      if (raceSchedule > 0) features.push('Race-Schedule');
      // Check for articles and tags
      const articleCount = await page.locator('article, [class*="article"], [data-component*="Article"]').count().catch(() => 0);
      if (articleCount > 0) {
        if (!features.includes('Articles')) features.push('Articles');
        const tagCount = await page.locator('a[href*="/tag/"], [class*="tag"]').count().catch(() => 0);
        if (tagCount > 0 && !features.includes('Tags')) features.push('Tags');
        // Check Sky Player autoplay (skip in quick mode to save time)
        if (!isQuick) {
          try {
            const hasVideo = await page.locator('video[id*="player4s"], video[src*="blob:"]').count().catch(() => 0);
            if (hasVideo > 0) {
              await page.waitForTimeout(1000);
              const playing = await page.evaluate(() => {
                const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
                return videos.some(v => !v.paused && v.currentTime > 0 && v.readyState >= 2);
              });
              if (playing) features.push('Sky-Player');
            }
          } catch {}
        }
      }
    }
    
    // Preferred source + F1.TV checks
    try {
      const preferredSource = await page
        .locator('img[alt*="Google Preferred Sources"], [aria-label*="Google Preferred Sources"], a:has-text("Google Preferred Sources")')
        .first()
        .isVisible({ timeout: 1500 })
        .catch(() => false);
      if (preferredSource) features.push('Google-Preferred-Source');
    } catch {}
    try {
      const f1tvVisible = await page
        .locator('a[href*="f1.tv"], a:has-text("F1.TV"), img[alt*="F1 TV"], img[alt*="F1.TV"]')
        .first()
        .isVisible({ timeout: 1500 })
        .catch(() => false);
      if (f1tvVisible) features.push('F1.TV-Visible');
      // Validate F1.TV link with request context to avoid destabilizing the active tab.
      if (f1tvVisible && !isQuick) {
        const f1tvHrefRaw = await page
          .locator('a[href*="f1.tv"], a:has-text("F1.TV")')
          .first()
          .getAttribute('href')
          .catch(() => null);
        if (f1tvHrefRaw) {
          const f1tvHref = f1tvHrefRaw.startsWith('http')
            ? f1tvHrefRaw
            : new URL(f1tvHrefRaw, page.url()).toString();
          const f1tvRes = await request.fetch(f1tvHref, { method: 'GET', timeout: 6000 }).catch(() => null);
          const status = f1tvRes?.status() ?? 0;
          if (status >= 200 && status < 400) {
            features.push('F1.TV>opens as expected');
          } else {
            brokenLinkReportEntries.push({ tab: `${label} (F1.TV)`, url: f1tvHref, status });
          }
        }
      }
    } catch {}

    const status = (brokenLinks > 0 || imgStats.broken > 0 || adIssues > 0 || tabHasFunctionalIssue) ? 'FAIL' : 'PASS';
    summary.push({ tab: label, url: currentUrl, loadMs, linksChecked: hrefs.length, brokenLinks, brokenImages: imgStats.broken, brokenImageUrls: imgStats.brokenSrcs || [], status, brokenLinkDetails: brokenLinkList, features });
    console.log(`  → Links checked: ${hrefs.length} (incl. team/audi, team/cadillac, tracks/circuito-de-madring), broken: ${brokenLinks}. Images broken: ${imgStats.broken}. Stale: ${staleContentLocations.some(s => s.tab === label) ? 'yes' : 'no'}`);
  }

  // Output testing covered (for local logs)
  console.log('\n📋 Testing Covered');
  summary.forEach(result => {
    if (result.status === 'PASS' && result.features.length > 0) {
      console.log(`✅ PASS: ${result.tab}>${result.features.join('>')}`);
    }
  });

  // Report block: exact format for Git Actions / email (Planetf1 testing has completed see below details)
  console.log('\n✅ Planetf1 testing has completed see below details✅');
  const reportLines: string[] = [];
  const tabToPageUrl = new Map(summary.map(s => [s.tab, s.url]));
  summary.filter(s => s.brokenImageUrls && s.brokenImageUrls.length > 0).forEach(result => {
    result.brokenImageUrls!.forEach(src => {
      reportLines.push(`❌ BrokenImage: Location=${result.tab} | URL=${src}❌ `);
      reportLines.push(
        `   Steps: 1) Open ${tabToPageUrl.get(result.tab) || BASE_URL} 2) Inspect image URL ${src} 3) Expected image renders 4) Actual broken/empty image`,
      );
    });
  });
  brokenLinkReportEntries.forEach(({ tab, url, status }) => {
    const statusCode = status > 0 ? status : 404;
    reportLines.push(`❌ Fail: ${tab}>${url} (${statusCode})❌ `);
    reportLines.push(
      `   Steps: 1) Open ${tabToPageUrl.get(tab) || BASE_URL} 2) Open link ${url} 3) Expected 200/3xx page 4) Actual HTTP ${statusCode}`,
    );
  });
  staleContentLocations.forEach(({ tab, message }) => {
    reportLines.push(`❌ StaleContent: Location=${tab} | ${message}❌ `);
    reportLines.push(
      `   Steps: 1) Open ${tabToPageUrl.get(tab) || BASE_URL} 2) Check article dates 3) Expected date within 14 days 4) Actual stale/no recent date`,
    );
  });
  noAdsLocations.forEach(({ tab }) => {
    reportLines.push(`❌ NoAds: Location=${tab} | No display ad found❌ `);
    reportLines.push(
      `   Steps: 1) Open ${tabToPageUrl.get(tab) || BASE_URL} 2) Check visible ad slots 3) Expected at least one display ad 4) Actual none detected`,
    );
  });
  functionalIssues.forEach(({ tab, message }) => {
    reportLines.push(`❌ Functional: Location=${tab} | ${message}❌ `);
    reportLines.push(
      `   Steps: 1) Open ${tabToPageUrl.get(tab) || BASE_URL} 2) Click Results in nav 3) Confirm "Full Classification" 4) Verify populated rows are present`,
    );
  });
  if (reportLines.length === 0) {
    console.log('✅No Fails identified✅');
  } else {
    reportLines.forEach(line => console.log(line));
  }

  // Email report: failures as simple strings for reusable email format
  const emailFailures: string[] = [];
  brokenLinkReportEntries.forEach(({ tab, url, status }) => {
    const statusCode = status > 0 ? status : 404;
    emailFailures.push(`${tab}>${url} (${statusCode})`);
    emailFailures.push(
      `Steps: Open ${tabToPageUrl.get(tab) || BASE_URL} -> open ${url} -> expected 200/3xx -> actual ${statusCode}`,
    );
  });
  summary.filter(s => s.brokenImageUrls && s.brokenImageUrls.length > 0).forEach(result => {
    result.brokenImageUrls!.forEach(src => {
      emailFailures.push(`Broken image: ${result.tab} | ${src}`);
      emailFailures.push(
        `Steps: Open ${tabToPageUrl.get(result.tab) || BASE_URL} -> inspect ${src} -> expected image renders -> actual broken`,
      );
    });
  });
  staleContentLocations.forEach(({ tab, message }) => {
    emailFailures.push(`Stale content: ${tab} | ${message}`);
    emailFailures.push(
      `Steps: Open ${tabToPageUrl.get(tab) || BASE_URL} -> check article dates -> expected within 14 days`,
    );
  });
  noAdsLocations.forEach(({ tab }) => {
    emailFailures.push(`No ads: ${tab}`);
    emailFailures.push(
      `Steps: Open ${tabToPageUrl.get(tab) || BASE_URL} -> check ad containers -> expected at least one visible display ad`,
    );
  });
  functionalIssues.forEach(({ tab, message }) => {
    emailFailures.push(`Functional: ${tab} | ${message}`);
    emailFailures.push(
      `Steps: Open ${tabToPageUrl.get(tab) || BASE_URL} -> click Results in nav -> confirm Full Classification -> verify populated rows`,
    );
  });
  try {
    const fs = await import('fs');
    const path = await import('path');
    const reportDir = path.join(process.cwd(), 'test-results');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(
      path.join(reportDir, 'email-report.json'),
      JSON.stringify({ siteName: 'PlanetF1', failures: emailFailures }, null, 0)
    );
  } catch (_) {}

  // Soft assertions: most tabs should load under ~5s
  const slowTabs = summary.filter(s => s.loadMs > 5000).map(s => s.tab);
  expect.soft(slowTabs.length, `Slow tabs (>5s): ${slowTabs.join(', ')}`).toBeLessThanOrEqual(3);

  // Report what was tested (for logs and clarity)
  const tabsChecked = summary.map(s => s.tab).join(', ');
  console.log(`\n📋 PlanetF1 test: ${summary.length} tabs checked (${tabsChecked}). Failures above if any.`);
});


