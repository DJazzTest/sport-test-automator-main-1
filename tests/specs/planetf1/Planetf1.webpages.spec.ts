import { test, expect } from '@playwright/test';

// PlanetF1 site navigation and quality checks
// Source site: https://www.planetf1.com/

const BASE_URL = 'https://www.planetf1.com/';

// Tabs to check from the global nav bar
const NAV_TABS: Array<{ label: string; match: RegExp }> = [
  { label: 'News', match: /news/i },
  { label: 'Live', match: /live/i },
  { label: 'Drivers', match: /drivers/i },
  { label: 'Teams', match: /teams/i },
  { label: 'Standings', match: /standings/i },
  { label: 'Schedule', match: /schedule/i },
  { label: 'Results', match: /results/i },
  { label: 'Data', match: /data/i },
  { label: 'Tech', match: /tech/i },
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

  const summary: Array<{ tab: string; url: string; loadMs: number; linksChecked: number; brokenLinks: number; brokenImages: number }>
    = [];

  for (const { label, match } of NAV_TABS) {
    console.log(`\n🔍 Tab: ${label}`);

    // Make sure consent overlays are cleared between tabs
    await acceptConsent();

    // Locate nav link by accessible name
    const navLink = page.getByRole('link', { name: match }).first();
    const linkVisible = await navLink.isVisible({ timeout: 5000 }).catch(() => false);
    if (!linkVisible) {
      console.log(`⚠️  Nav link not visible: ${label} — skipping`);
      continue;
    }

    const start = Date.now();
    // Try click; if blocked by consent modal, dismiss and retry once
    await safeNavClick(navLink);
    // Give the page a short settle time for layout/content fetches
    await page.waitForTimeout(600);
    const loadMs = Date.now() - start;
    const currentUrl = page.url();
    console.log(`⏱️  Loaded ${label} in ${loadMs}ms → ${currentUrl}`);

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
    expect(hasContent, `${label}: expected visible content in main area`).toBeTruthy();

    // Tab-specific deep checks
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

      for (let di = 0; di < driverAnchors.length; di++) {
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

    // Collect on-page links (same-origin preferred) and test status codes (HEAD or GET fallback)
    const hrefs = (await page.$$eval('a[href]', anchors => anchors
      .map(a => (a as HTMLAnchorElement).href)
      .filter(Boolean)))
      .filter(href => href.startsWith(BASE_URL))
      .slice(0, MAX_LINKS_TO_CHECK);

    let brokenLinks = 0;
    const linkResults = await mapWithConcurrency(hrefs, MAX_CONCURRENT_FETCH, async (href) => {
      try {
        // Prefer HEAD to reduce load; some servers may not support HEAD → fallback to GET
        let res = await fetch(href, { method: 'HEAD' }).catch(() => null as any);
        if (!res || (res && (res.status === 405 || res.status === 501))) {
          res = await fetch(href, { method: 'GET' }).catch(() => null as any);
        }
        const ok = !!res && res.status >= 200 && res.status < 400;
        if (!ok) brokenLinks++;
        return { href, ok, status: res?.status ?? 0 };
      } catch {
        brokenLinks++;
        return { href, ok: false, status: 0 };
      }
    });
    const brokenLinkDetails = linkResults.filter(r => !r.ok).slice(0, 10);
    if (brokenLinkDetails.length) {
      console.log('🔗 Broken links (sample):');
      brokenLinkDetails.forEach(r => console.log(`  - [${r.status}] ${r.href}`));
    }

    // Broken images: detect <img> with zero natural width/height
    const imgStats = await page.evaluate(() => {
      const imgs = Array.from(document.images || []);
      const total = imgs.length;
      const broken = imgs.filter(img => !(img as HTMLImageElement).naturalWidth || !(img as HTMLImageElement).naturalHeight).length;
      return { total, broken };
    });
    if (imgStats.broken > 0) {
      console.log(`🖼️  Broken images: ${imgStats.broken}/${imgStats.total}`);
    }

    summary.push({ tab: label, url: currentUrl, loadMs, linksChecked: hrefs.length, brokenLinks, brokenImages: imgStats.broken });
  }

  // Output summary
  console.log('\n🧪 === PLANETF1 SUMMARY ===');
  summary.forEach(s => {
    console.log(`• ${s.tab} → ${s.url}`);
    console.log(`  ⏱️ ${s.loadMs}ms | Links checked: ${s.linksChecked} (broken: ${s.brokenLinks}) | Broken images: ${s.brokenImages}`);
  });

  // Soft assertions: most tabs should load under ~5s
  const slowTabs = summary.filter(s => s.loadMs > 5000).map(s => s.tab);
  expect.soft(slowTabs.length, `Slow tabs (>5s): ${slowTabs.join(', ')}`).toBeLessThanOrEqual(3);
});


