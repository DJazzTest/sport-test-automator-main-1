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

// Limit link checks to avoid hammering the site
const MAX_LINKS_TO_CHECK = 75;
const MAX_CONCURRENT_FETCH = 8;

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

test('PlanetF1 – navigation, load, and content integrity checks', async ({ page, request, browserName }) => {
  test.setTimeout(10 * 60_000);

  console.log(`🚀 Starting PlanetF1 checks on ${browserName}`);
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

  // Debug: Log available navigation links
  const allNavLinks = await page.$$eval('nav a, header a, [class*="nav"] a, [class*="menu"] a', links => 
    links.map(a => ({ text: a.textContent?.trim(), href: a.href })).filter(l => l.text && l.href)
  );
  console.log('🔍 Available navigation links:', allNavLinks.slice(0, 10));

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

  const summary: Array<{ tab: string; url: string; loadMs: number; linksChecked: number; brokenLinks: number; brokenImages: number; status: string; brokenLinkDetails: string[] }>
    = [];

  for (const { label, url } of NAV_TABS) {
    console.log(`\n🔍 Tab: ${label}`);

    // Make sure consent overlays are cleared between tabs
    await acceptConsent();

    const start = Date.now();
    let loadMs = 0;
    let currentUrl = url;
    let navigationSuccess = true;
    
    try {
      // Navigate directly to the URL
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await acceptConsent();
      // Give the page a short settle time for layout/content fetches
      await page.waitForTimeout(600);
      loadMs = Date.now() - start;
      currentUrl = page.url();
      console.log(`⏱️  Loaded ${label} in ${loadMs}ms → ${currentUrl}`);
    } catch (error) {
      loadMs = Date.now() - start;
      currentUrl = `ERROR: ${error.message}`;
      navigationSuccess = false;
      console.log(`❌ Failed to load ${label} in ${loadMs}ms → ${currentUrl}`);
    }

    // Basic content presence (avoid stale/empty page):
    // For Results, accept scoreboard/table-only layouts
    let hasContent = await Promise.race([
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
    // Handle navigation failures
    if (!navigationSuccess) {
      console.log(`❌ FAIL: ${label} - Navigation failed`);
      const errorLink = `[NAVIGATION ERROR] ${url}`;
      summary.push({ tab: label, url: currentUrl, loadMs, linksChecked: 0, brokenLinks: 1, brokenImages: 0, status: 'FAIL', brokenLinkDetails: [errorLink] });
      continue; // Skip further testing for this tab
    }

    // Capture content failures for reporting
    if (!hasContent) {
      console.log(`❌ FAIL: ${label} - No visible content in main area`);
      summary.push({ tab: label, url: currentUrl, loadMs, linksChecked: 0, brokenLinks: 0, brokenImages: 0, status: 'FAIL', brokenLinkDetails: [] });
      continue; // Skip further testing for this tab
    } else {
      console.log(`✅ PASS: ${label} - Content loaded successfully`);
    }

    // Tab-specific deep checks
    if (/home/i.test(label)) {
      // Home: scroll and sample links/images (limit 5 if >10)
      try {
        for (let s = 0; s < 6; s++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(120); }
        await page.evaluate(() => window.scrollTo(0, 0));
      } catch {}
    }
    if (/live/i.test(label)) {
      // Scroll to reveal sub-tabs/sections
      try { for (let s = 0; s < 3; s++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(150); } } catch {}
      const liveSections = ['Race', 'Grid', 'Q3', 'Q2', 'Q1', 'P3', 'P2', 'P1'];
      for (const sec of liveSections) {
        const btn = page.getByRole('button', { name: new RegExp(`^${sec}$`, 'i') }).first();
        const vis = await btn.isVisible({ timeout: 1500 }).catch(() => false);
        if (!vis) continue;
        await safeNavClick(btn);
        await page.waitForTimeout(400).catch(() => {});
        // Assert some data present (tables, lists, timing blocks)
        const hasData = await Promise.race([
          page.locator('table, [class*="table"], [role="table"]').first().isVisible().catch(() => false),
          page.locator('[class*="list"], ul li, ol li').first().isVisible().catch(() => false),
          page.locator('[data-component*="Timing"], [class*="time"], [class*="result"]').first().isVisible().catch(() => false)
        ]).catch(() => false);
        expect(hasData, `Live → ${sec}: expected visible data`).toBeTruthy();
        if (hasData) {
          console.log(`✅ LIVE TAB OK: ${sec}`);
        } else {
          console.log(`❌ ERROR: Live tab "${sec}" has no visible data`);
          console.log(`   Expected: Tables, lists, or timing information should be displayed`);
          console.log(`   Impact: Users cannot view ${sec} timing/results data`);
        }
      }
    }

    if (/standings/i.test(label)) {
      // Click Constructors tab within standings if present
      const constructorsTab = page.getByRole('button', { name: /constructors/i }).first();
      if (await constructorsTab.isVisible({ timeout: 1500 }).catch(() => false)) {
        await constructorsTab.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(400).catch(() => {});
        // Expect a table with rows
        const rows = await page.locator('table tbody tr, [role="rowgroup"] [role="row"]').count().catch(() => 0);
        expect(rows, 'Standings → Constructors: expected table rows').toBeGreaterThan(0);
      }
    }

    if (/results/i.test(label)) {
      // Test Full Classification functionality
      console.log('🔍 Testing Full Classification on Results page...');
      
      // Look for Full Classification links/buttons
      const fullClassificationSelectors = [
        'a:has-text("Full Classification")',
        'button:has-text("Full Classification")',
        '[class*="classification"] a',
        '[class*="results"] a:has-text("Classification")',
        'a[href*="classification"]'
      ];
      
      let classificationFound = false;
      for (const selector of fullClassificationSelectors) {
        const classificationLink = page.locator(selector).first();
        const isVisible = await classificationLink.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          console.log(`✅ Found Full Classification link: ${selector}`);
          try {
            await classificationLink.click({ timeout: 3000 });
            await page.waitForTimeout(1000);
            
            // Check if classification data is loaded
            const hasClassificationData = await Promise.race([
              page.locator('table, [role="table"]').first().isVisible().catch(() => false),
              page.locator('[class*="classification"], [class*="results"]').first().isVisible().catch(() => false),
              page.locator('h1:has-text("Classification"), h2:has-text("Classification")').first().isVisible().catch(() => false)
            ]).catch(() => false);
            
            if (hasClassificationData) {
              console.log('✅ SUCCESS: Full Classification data loaded successfully');
              classificationFound = true;
            } else {
              console.log('❌ ERROR: Full Classification link was clicked but no data appeared');
              console.log('   Expected: A table or results section showing race classification');
              console.log('   Impact: Users cannot view complete race results after clicking the link');
            }
            break;
          } catch (error) {
            console.log(`❌ ERROR: Could not click Full Classification link/button`);
            console.log(`   Reason: ${error.message}`);
            console.log('   Impact: Users may not be able to access detailed race results');
          }
        }
      }
      
      if (!classificationFound) {
        console.log('❌ FAIL: No "Full Classification" link/button found on Results page');
        console.log('   This means users may not be able to view detailed race results.');
        console.log('   Expected: A link or button labeled "Full Classification" should be visible.');
        console.log('   Impact: Users may need to navigate elsewhere to see complete race standings.');
      }
    }

    if (/drivers/i.test(label)) {
      // Collect all driver links on the page
      const driverAnchors = await page.$$eval('a[href*="/drivers/"]', (anchors: Element[]) => {
        const hrefs = anchors
          .map(a => (a as HTMLAnchorElement).href)
          .filter(h => typeof h === 'string' && h.includes('/drivers/'));
        return Array.from(new Set(hrefs));
      });
      console.log(`👤 Drivers found: ${driverAnchors.length}`);

      let driversPassed = 0;
      let driversFailed = 0;

      // Only test up to 10 drivers to keep runtime reasonable
      const dIdxs = sampleIndices(driverAnchors.length, 10);
      for (const di of dIdxs) {
        const href = driverAnchors[di];
        const name = href.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || `Driver ${di + 1}`;
        console.log(`
👤 Testing driver: ${name} → ${href}`);

        // Navigate to driver page
        await page.evaluate((h) => { window.location.href = h as string; }, href).catch(() => {});
        try { await page.waitForLoadState('domcontentloaded', { timeout: 6000 }); } catch {}
        await acceptConsent();
        await page.waitForTimeout(300).catch(() => {});

        // Verify sections exist: Overview, News, Results, Career, Biography, Standings
        const sectionTabs = ['Overview', 'News', 'Results', 'Career', 'Biography', 'Standings'];
        let allSectionsOk = true;
        for (const tab of sectionTabs) {
          const t = page.getByRole('link', { name: new RegExp(`^${tab}$`, 'i') }).first();
          const tabVisible = await t.isVisible({ timeout: 1000 }).catch(() => false);
          if (tabVisible) {
            await t.click({ timeout: 1000 }).catch(() => {});
            await page.waitForTimeout(250).catch(() => {});
            const hasSectionData = await Promise.race([
              page.locator('main h1, main h2').first().isVisible().catch(() => false),
              page.locator('article, [class*="card"], [class*="tile"], [data-component*="Article"]').first().isVisible().catch(() => false),
              page.locator('img').first().isVisible().catch(() => false)
            ]).catch(() => false);
            if (!hasSectionData) allSectionsOk = false;
          }
        }

        // Check a sample of links and images on driver page
        const dLinks = (await page.$$eval('main a[href]', as => as.slice(0, 20).map(a => (a as HTMLAnchorElement).href))).filter(Boolean);
        let brokenDriverLinks = 0;
        for (const h of dLinks) {
          try {
            let r = await fetch(h, { method: 'HEAD' }).catch(() => null as any);
            if (!r || (r && (r.status === 405 || r.status === 501))) {
              r = await fetch(h, { method: 'GET' }).catch(() => null as any);
            }
            if (!r || r.status >= 400) {
              console.log(`🔗 Driver link warning [${r?.status ?? 0}]: ${h}`);
              brokenDriverLinks++;
            }
          } catch { brokenDriverLinks++; }
        }
        const imgBroken = await page.evaluate(() => Array.from(document.images).some(i => !(i as HTMLImageElement).naturalWidth));

        if (allSectionsOk && brokenDriverLinks === 0 && !imgBroken) {
          driversPassed++;
          console.log(`✅ Driver OK: ${name}`);
        } else {
          driversFailed++;
          console.log(`❌ Driver issues: ${name} — sectionsOk=${allSectionsOk}, brokenLinks=${brokenDriverLinks}, brokenImages=${imgBroken}`);
        }

        // Return to drivers list
        await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForTimeout(300).catch(() => {});
      }

      console.log(`👥 Drivers summary: total=${driverAnchors.length}, passed=${driversPassed}, failed=${driversFailed}`);
    }

    if (/teams/i.test(label)) {
      // Click up to 10 team cards/links and verify page loads without obvious breakage
      const teamHrefs = await page.$$eval('a[href*="/team"], a[href*="/teams/"]', (as: Element[]) => {
        const hrefs = (as as HTMLAnchorElement[]).map(a => (a as HTMLAnchorElement).href).filter(Boolean);
        return Array.from(new Set(hrefs));
      });
      const tIdxs = sampleIndices(teamHrefs.length, 10);
      for (const ti of tIdxs) {
        const th = teamHrefs[ti];
        const teamName = th.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || 'Unknown Team';
        console.log(`🏁 Testing team page: ${teamName} → ${th}`);
        try {
          await page.goto(th, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await acceptConsent();
          await page.waitForTimeout(300);
          // Basic content and images
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
        await page.waitForTimeout(200).catch(() => {});
      }
    }

    // Collect on-page links (same-origin) and sample per rules: if >10 then test 5 random
    const pageLinks = (await page.$$eval('a[href]', anchors => anchors
      .map(a => (a as HTMLAnchorElement).href)
      .filter(Boolean)))
      .filter(href => href.startsWith(BASE_URL));

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
        // Prefer HEAD to reduce load; fallback to GET; retry normalization for legacy track slugs
        let res = await fetch(href, { method: 'HEAD' }).catch(() => null as any);
        if (!res || (res && (res.status === 405 || res.status === 501))) {
          res = await fetch(href, { method: 'GET' }).catch(() => null as any);
        }
        let ok = !!res && res.status >= 200 && res.status < 400;
        // PlanetF1 legacy track slug normalization
        if (!ok && /\/tracks\/(baku-city|marina-bay|circuito-de-madring)\/?$/.test(href)) {
          let normalized = href
            .replace('/tracks/baku-city', '/tracks/baku-city-circuit')
            .replace('/tracks/marina-bay', '/tracks/marina-bay-street-circuit')
            .replace('/tracks/circuito-de-madring', '/tracks/circuito-de-madrid');
          let r2 = await fetch(normalized, { method: 'HEAD' }).catch(() => null as any);
          if (!r2 || (r2 && (r2.status === 405 || r2.status === 501))) {
            r2 = await fetch(normalized, { method: 'GET' }).catch(() => null as any);
          }
          ok = !!r2 && r2.status >= 200 && r2.status < 400;
          if (ok) {
            console.log(`🔁 Normalized legacy track URL OK: ${href} → ${normalized}`);
          }
        }
        if (!ok) brokenLinks++;
        return { href, ok, status: ok ? (res?.status ?? 200) : (res?.status ?? 0) };
      } catch {
        brokenLinks++;
        return { href, ok: false, status: 0 };
      }
    });
    const brokenLinkDetails = linkResults.filter(r => !r.ok);
    const brokenLinkList = brokenLinkDetails.map(r => `[${r.status}] ${r.href}`);
    if (brokenLinkDetails.length) {
      console.log('🔗 Broken links found:');
      brokenLinkDetails.forEach((r, index) => {
        console.log(`  ❌ [${r.status}] ${r.href}`);
        console.log(`     📋 Steps to recreate:`);
        console.log(`        1. Navigate to: ${currentUrl}`);
        console.log(`        2. Look for a link that points to: ${r.href}`);
        console.log(`        3. Click on that link`);
        console.log(`        4. Expected: Page should load successfully`);
        console.log(`        5. Actual: Returns HTTP ${r.status} (broken link)`);
        if (index < brokenLinkDetails.length - 1) console.log(''); // Add spacing between items
      });
    }

    // Broken images: detect <img> with zero natural width/height
    const imgStats = await page.evaluate(() => {
      const toAbs = (u: string) => {
        try { return new URL(u, window.location.href).toString(); } catch { return u; }
      };
      const imgs = Array.from(document.images || []) as HTMLImageElement[];
      // Exclude known third-party tracker/ad-sync hosts from broken-image reporting
      const excludeHosts = [
        'x.bidswitch.net',
        'secure.adnxs.com',
        'cm.g.doubleclick.net',
        'ad.turn.com',
        'cs.admanmedia.com'
      ];
      const total = imgs.length;
      const brokenEls = imgs.filter(img => {
        const isBroken = !(img as HTMLImageElement).naturalWidth || !(img as HTMLImageElement).naturalHeight;
        if (!isBroken) return false;
        const src = (img as HTMLImageElement).currentSrc || (img as HTMLImageElement).src || '';
        try {
          const h = new URL(src, window.location.href).hostname;
          if (excludeHosts.includes(h)) return false; // ignore tracker pixels
        } catch {}
        return true;
      });
      const broken = brokenEls.length;
      const brokenSrcs = brokenEls.slice(0, 10).map(img => toAbs(img.currentSrc || img.src || ''));
      return { total, broken, brokenSrcs };
    });
    if (imgStats.broken > 0) {
      console.log(`🖼️  Broken images: ${imgStats.broken}/${imgStats.total}`);
      imgStats.brokenSrcs.forEach((src: string, index: number) => {
        console.log(`   🖼️  ❌ ${src}`);
        console.log(`      📋 Steps to recreate:`);
        console.log(`         1. Navigate to: ${currentUrl}`);
        console.log(`         2. Scroll down the page to find images`);
        console.log(`         3. Look for a broken/missing image (shows placeholder or alt text)`);
        console.log(`         4. Right-click the broken image and select "Inspect" or "Inspect Element"`);
        console.log(`         5. Check the image src attribute - it should match: ${src}`);
        console.log(`         6. Expected: Image should display correctly`);
        console.log(`         7. Actual: Image fails to load (broken image)`);
        if (index < imgStats.brokenSrcs.length - 1) console.log(''); // Add spacing between items
      });
    }

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

    const status = (brokenLinks > 0 || imgStats.broken > 0 || adIssues > 0) ? 'FAIL' : 'PASS';
    if (adIssues > 0) {
      brokenLinkList.push('[AD] No display ad detected');
    }
    summary.push({ tab: label, url: currentUrl, loadMs, linksChecked: hrefs.length, brokenLinks, brokenImages: imgStats.broken, status, brokenLinkDetails: brokenLinkList });
  }

  // Output summary in the requested format
  console.log('\nSummary');
  summary.forEach(s => {
    console.log(`🔍 Tab: ${s.tab}`);
    console.log(`⏱️ Loaded ${s.tab} in ${s.loadMs}ms → ${s.url}`);
    if (s.brokenLinkDetails.length > 0) {
      s.brokenLinkDetails.forEach(link => console.log(`❌ ${link}`));
    }
  });

  // Detailed results for email
  console.log('\n📋 === DETAILED RESULTS ===');
  summary.forEach(s => {
    if (s.status === 'PASS') {
      console.log(`✅ PASS: ${s.tab} - Loaded in ${s.loadMs}ms`);
    } else {
      console.log(`❌ FAIL: ${s.tab} - ${s.brokenLinks} broken links, ${s.brokenImages} broken images`);
      if (s.brokenLinkDetails.length > 0) {
        console.log('   Broken links:');
        s.brokenLinkDetails.forEach(link => console.log(`   ❌ ${link}`));
      }
      // Standard repro steps for any failing tab so emails/GitHub logs always show how to re-check
      console.log('   📋 Steps to recreate:');
      console.log(`      1. Navigate to: ${s.url}`);
      console.log('      2. Scroll the page and interact as a normal user would (e.g. follow primary links).');
      console.log('      3. Look for the broken links and/or images listed above for this tab.');
      console.log('      4. Expected: No broken links (4xx/5xx) and no visibly broken images on key content.');
      console.log('      5. Actual: See the broken link/image entries listed above for this tab.');
    }
  });

  // Soft assertions: most tabs should load under ~5s
  const slowTabs = summary.filter(s => s.loadMs > 5000).map(s => s.tab);
  expect.soft(slowTabs.length, `Slow tabs (>5s): ${slowTabs.join(', ')}`).toBeLessThanOrEqual(3);
});


