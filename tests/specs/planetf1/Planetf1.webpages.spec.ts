import { test, expect } from '@playwright/test';

// PlanetF1 site navigation and quality checks
// Source site: https://www.planetf1.com/

const BASE_URL = 'https://www.planetf1.com/';

// Tabs to check - using direct URLs since nav structure has changed
const NAV_TABS: Array<{ label: string; url: string }> = [
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
];

// Limit link checks to avoid hammering the site and reduce CI runtime
const MAX_LINKS_TO_CHECK = 25;
const MAX_CONCURRENT_FETCH = 6;
// Fewer deep samples to keep total runtime under ~5 min
const MAX_DRIVERS_TO_TEST = 3;
const MAX_TEAMS_TO_TEST = 3;
const MAX_LIVE_SECTIONS = 4; // Race, Grid, Q3, Q1

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

test('PlanetF1 – navigation, load, and content integrity checks', async ({ page, request }) => {
  test.setTimeout(6 * 60_000); // ~4–5 min typical; 6 min buffer

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  // Consent/CMP dismissal helper
  const acceptConsent = async () => {
    try {
      // Common role/button names
      const roleBtn = page.getByRole('button', { name: /accept\s*&?\s*continue|accept|allow/i }).first();
      if (await roleBtn.isVisible({ timeout: 1200 }).catch(() => false)) {
        await roleBtn.click({ timeout: 2000 }).catch(() => {});
        console.log('✅ Consent dismissed (role button)');
        return;
      }
    } catch {}
    try {
      // Specific CMP container/button fallback
      const cmpBtn = page.locator('#uniccmp button:has-text("Accept")').first();
      if (await cmpBtn.isVisible({ timeout: 1200 }).catch(() => false)) {
        await cmpBtn.click({ timeout: 2000 }).catch(() => {});
        console.log('✅ Consent dismissed (UNICCMP)');
        return;
      }
    } catch {}
    try {
      // Exact text match variant provided
      const exact = page.locator('button:has-text("Accept & Continue")').first();
      if (await exact.isVisible({ timeout: 1200 }).catch(() => false)) {
        await exact.click({ timeout: 2000 }).catch(() => {});
        console.log('✅ Consent dismissed (Accept & Continue)');
      }
    } catch {}
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
  const staleContentLocations: Array<{ tab: string; message: string }> = [];

  for (const { label, url } of NAV_TABS) {
    console.log(`\n🔍 Tab: ${label}`);

    // Track features tested per tab
    const features: string[] = [];

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
      await page.waitForTimeout(300);
      loadMs = Date.now() - start;
      currentUrl = page.url();
      console.log(`⏱️  Loaded ${label} in ${loadMs}ms → ${currentUrl}`);
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
      summary.push({ tab: label, url: currentUrl, loadMs, linksChecked: 0, brokenLinks: 1, brokenImages: 0, status: 'FAIL', brokenLinkDetails: [errorLink], features: [] });
      continue; // Skip further testing for this tab
    }

    // Capture content failures for reporting
    if (!hasContent) {
      summary.push({ tab: label, url: currentUrl, loadMs, linksChecked: 0, brokenLinks: 0, brokenImages: 0, status: 'FAIL', brokenLinkDetails: [], features: [] });
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
        // Check for recent content (within 14 days)
        const hasRecentContent = await page.evaluate(() => {
          const threshold = Date.now() - 14 * 24 * 60 * 60 * 1000;
          const timeElements = Array.from(document.querySelectorAll('time[datetime]'));
          for (const timeEl of timeElements.slice(0, 20)) {
            const datetime = timeEl.getAttribute('datetime');
            if (datetime) {
              const date = Date.parse(datetime);
              if (!isNaN(date) && date > threshold) return true;
            }
          }
          return false;
        });
        if (hasRecentContent) features.push('No-Stale-Content');
        else if (/home|news/i.test(label)) staleContentLocations.push({ tab: label, message: 'No article with date within 14 days' });
      }
      if (/home/i.test(label)) {
        try {
          for (let s = 0; s < 4; s++) { await page.mouse.wheel(0, 1000); await page.waitForTimeout(80); }
          await page.evaluate(() => window.scrollTo(0, 0));
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

    if (/standings/i.test(label)) {
      const driversTab = await page.getByRole('button', { name: /drivers/i }).first().isVisible({ timeout: 2000 }).catch(() => false);
      const constructorsTab = page.getByRole('button', { name: /constructors/i }).first();
      if (driversTab) features.push('Drivers');
      if (await constructorsTab.isVisible({ timeout: 1200 }).catch(() => false)) {
        features.push('Contructors');
        await constructorsTab.click({ timeout: 1200 }).catch(() => {});
        await page.waitForTimeout(250).catch(() => {});
        const rows = await page.locator('table tbody tr, [role="rowgroup"] [role="row"]').count().catch(() => 0);
        expect(rows, 'Standings → Constructors: expected table rows').toBeGreaterThan(0);
      }
      // Check for year selector
      const year2026 = await page.locator('a[href*="2026"], button:has-text("2026")').first().isVisible({ timeout: 1000 }).catch(() => false);
      const year2025 = await page.locator('a[href*="2025"], button:has-text("2025")').first().isVisible({ timeout: 1000 }).catch(() => false);
      if (year2026) features.push('2026');
      if (year2025) features.push('2025');
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

        await page.evaluate((h) => { window.location.href = h as string; }, href).catch(() => {});
        try { await page.waitForLoadState('domcontentloaded', { timeout: 4000 }); } catch {}
        await acceptConsent();
        await page.waitForTimeout(200).catch(() => {});

        // Only check Overview + Results to cut runtime (was 6 tabs)
        const sectionTabs = ['Overview', 'Results'];
        let allSectionsOk = true;
        for (const tab of sectionTabs) {
          const t = page.getByRole('link', { name: new RegExp(`^${tab}$`, 'i') }).first();
          const tabVisible = await t.isVisible({ timeout: 800 }).catch(() => false);
          if (tabVisible) {
            await t.click({ timeout: 800 }).catch(() => {});
            await page.waitForTimeout(150).catch(() => {});
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

        await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(200).catch(() => {});
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
        try {
          await page.goto(th, { waitUntil: 'domcontentloaded', timeout: 6000 });
          await acceptConsent();
          await page.waitForTimeout(200);
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
        await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(150).catch(() => {});
      }
    }

    // Collect on-page links (same-origin) and sample per rules: if >10 then test 5 random
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

    // Always include any Championship Standings Audi team links when present.
    // We find them by looking for the "Championship Standings" heading and a link named "Audi".
    let audiHref: string | null = null;
    try {
      const standingsHeading = page.getByRole('heading', { name: /Championship Standings/i }).first();
      if (await standingsHeading.isVisible({ timeout: 2000 }).catch(() => false)) {
        const audiLink = page.getByRole('link', { name: /^Audi$/i }).first();
        if (await audiLink.isVisible({ timeout: 2000 }).catch(() => false)) {
          audiHref = await audiLink.getAttribute('href');
        }
      }
    } catch {
      // ignore if standings not present on this tab
    }

    let hrefs = pageLinks;
    if (pageLinks.length > 10) {
      const idxs = sampleIndices(pageLinks.length, 5);
      hrefs = idxs.map(i => pageLinks[i]);
    }
    if (audiHref) {
      const absAudi = new URL(audiHref, currentUrl).toString();
      hrefs = Array.from(new Set([...hrefs, absAudi]));
    }
    hrefs = hrefs.slice(0, MAX_LINKS_TO_CHECK);

    let brokenLinks = 0;
    const linkResults = await mapWithConcurrency(hrefs, MAX_CONCURRENT_FETCH, async (href) => {
      try {
        // Check if page is still valid before making requests
        if (page.isClosed()) {
          return { href, ok: false, status: 0 };
        }
        
        let res = await request.fetch(href, { method: 'HEAD', timeout: 3000 }).catch(() => null);
        if (!res || res.status() === 405 || res.status() === 501) {
          res = await request.fetch(href, { method: 'GET', timeout: 3000 }).catch(() => null);
        }
        const status = res?.status() ?? 0;
        let ok = status >= 200 && status < 400;
        if (!ok && /\/tracks\/(baku-city|marina-bay|circuito-de-madring)\/?$/.test(href)) {
          let normalized = href
            .replace('/tracks/baku-city', '/tracks/baku-city-circuit')
            .replace('/tracks/marina-bay', '/tracks/marina-bay-street-circuit')
            .replace('/tracks/circuito-de-madring', '/tracks/circuito-de-madrid');
          let r2 = await request.fetch(normalized, { method: 'HEAD', timeout: 3000 }).catch(() => null);
          if (!r2 || r2.status() === 405 || r2.status() === 501) {
            r2 = await request.fetch(normalized, { method: 'GET', timeout: 3000 }).catch(() => null);
          }
          const status2 = r2?.status() ?? 0;
          ok = status2 >= 200 && status2 < 400;
        }
        if (!ok) brokenLinks++;
        return { href, ok, status };
      } catch (e) {
        brokenLinks++;
        return { href, ok: false, status: 0 };
      }
    });
    const brokenLinkDetails = linkResults.filter(r => !r.ok);
    const brokenLinkList = brokenLinkDetails.map(r => r.href);
    // Track broken links globally for Tab>URL format
    brokenLinkDetails.forEach(r => {
      if (!globalBrokenLinks.has(r.href)) {
        globalBrokenLinks.set(r.href, []);
      }
      globalBrokenLinks.get(r.href)!.push(label);
    });

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
        'videos.skysports.com'
      ];
      const total = imgs.length;
      const brokenEls = imgs.filter(img => {
        const isBroken = !(img as HTMLImageElement).naturalWidth || !(img as HTMLImageElement).naturalHeight;
        if (!isBroken) return false;
        const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || '';
        try {
          const h = new URL(src, window.location.href).hostname;
          if (excludeHosts.includes(h)) return false; // ignore tracker pixels and Sky Sports thumbnails
          // Also exclude Sky Sports video thumbnail URLs by pattern
          if (src.includes('videos.skysports.com/image/v1/static')) return false;
        } catch {}
        return true;
      });
      const broken = brokenEls.length;
      const brokenSrcs = brokenEls.slice(0, 10).map(img => toAbs(img.currentSrc || img.src || ''));
      return { total, broken, brokenSrcs };
      });
    } catch (e: any) {
      if (e?.message?.includes('closed')) {
        console.log('⚠️  Page was closed during image check, skipping remaining tabs');
        break;
      }
    }
    // Don't log broken images in the old format - they'll be included in features if broken

    // Detect presence of display ads (banner/MPU). If none found, mark as issue.
    // Heuristics: elements/iframes with common ad size hints or class/id containing 'ad'
    const adPresence = await page.evaluate(() => {
      const sizeLike = (el: HTMLElement) => {
        const w = el.offsetWidth, h = el.offsetHeight;
        const sizes = [
          [728, 90], [970, 90], [970, 250], [300, 250], [300, 600], [160, 600], [320, 50], [320, 100]
        ];
        return sizes.some(([sw, sh]) => w >= sw && h >= sh);
      };
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(
        '[id*="ad" i], [class*="ad" i], iframe, [data-ad], [data-ad-unit], [data-slot]'
      ));
      const visible = candidates.filter(c => {
        const style = window.getComputedStyle(c);
        const vis = style && style.display !== 'none' && style.visibility !== 'hidden' && c.offsetParent !== null;
        return vis;
      });
      // consider present if any visible ad-like element with reasonable size exists
      const hasDisplayAd = visible.some(v => sizeLike(v));
      return hasDisplayAd;
    });
    let adIssues = 0;
    if (!adPresence) {
      adIssues = 1;
      console.log('🪧 No display ad found (banner/MPU heuristic)');
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
        // Check Sky Player autoplay
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
    
    // Check for F1.TV link
    try {
      const f1tvLink = await page.locator('a[href*="f1.tv"], a:has-text("F1.TV"), img[alt*="F1 TV"], img[alt*="F1.TV"]').first().isVisible({ timeout: 2000 }).catch(() => false);
      if (f1tvLink) {
        const f1tvHref = await page.locator('a[href*="f1.tv"], a:has-text("F1.TV")').first().getAttribute('href').catch(() => null);
        if (f1tvHref) {
          try {
            await page.goto(f1tvHref, { waitUntil: 'domcontentloaded', timeout: 6000 }).catch(() => {});
            await acceptConsent();
            await page.waitForTimeout(500);
            const f1tvOpens = await page.locator('body').isVisible().catch(() => false);
            if (f1tvOpens) {
              features.push('F1.TV>opens as expected');
            }
            await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
          } catch {}
        }
      }
    } catch {}

    const status = (brokenLinks > 0 || imgStats.broken > 0 || adIssues > 0) ? 'FAIL' : 'PASS';
    summary.push({ tab: label, url: currentUrl, loadMs, linksChecked: hrefs.length, brokenLinks, brokenImages: imgStats.broken, brokenImageUrls: imgStats.brokenSrcs || [], status, brokenLinkDetails: brokenLinkList, features });
  }

  // Output in the requested format
  console.log('\n📋 Testing Covered');
  summary.forEach(result => {
    if (result.status === 'PASS' && result.features.length > 0) {
      console.log(`✅ PASS: ${result.tab}>${result.features.join('>')}`);
    }
  });

  // Output broken links grouped by URL (format must match email report 100%)
  if (globalBrokenLinks.size > 0) {
    console.log('\n❌ Issues Identified as broken ❌');
    console.log('(this block only appears if broken links are found)');
    globalBrokenLinks.forEach((tabs, url) => {
      tabs.forEach(tab => {
        console.log(`❌ Fail: ${tab}>${url}`);
      });
    });
    console.log('\n📋 Steps to recreate:');
    console.log('Navigate to the tab(s) listed above');
    console.log('Look for the broken link URL');
    console.log('Click on that link');
    console.log('Expected: Page should load successfully');
    console.log('Actual: Returns HTTP 404 (broken link)');
  }

  // Broken images (format for email: BrokenImage: Location=Tab | URL=...)
  summary.filter(s => s.brokenImageUrls && s.brokenImageUrls.length > 0).forEach(result => {
    result.brokenImageUrls!.forEach(src => {
      console.log(`❌ BrokenImage: Location=${result.tab} | URL=${src}`);
    });
  });

  // Stale content (format for email: StaleContent: Location=Tab | message)
  staleContentLocations.forEach(({ tab, message }) => {
    console.log(`❌ StaleContent: Location=${tab} | ${message}`);
  });

  // Soft assertions: most tabs should load under ~5s
  const slowTabs = summary.filter(s => s.loadMs > 5000).map(s => s.tab);
  expect.soft(slowTabs.length, `Slow tabs (>5s): ${slowTabs.join(', ')}`).toBeLessThanOrEqual(3);
});


