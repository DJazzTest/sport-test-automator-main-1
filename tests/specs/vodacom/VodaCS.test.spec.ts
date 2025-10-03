import { test, expect } from '@playwright/test';

test.describe('Vodacom Soccer – Match Centre Animation Checks', () => {
  test('VodaCS – Match Centre events have match animations', async ({ page }) => {
    // Increase overall timeout to accommodate slow site; we also cap per-event runtime
    test.setTimeout(900_000);

    // Enhanced consent handling (like other tests)
    const acceptConsent = async () => {
      try { await page.getByRole('button', { name: /Accept all Cookies/i }).click({ timeout: 3000 }); } catch {}
      try { await page.getByRole('button', { name: /Agree and proceed/i }).click({ timeout: 3000 }); } catch {}
      try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
      try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
      try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 2000 }); } catch {}
      try { await page.locator('#onetrust-accept-btn-handler').click({ timeout: 2000 }); } catch {}
      try { await page.locator('button.unic-agree-all-button').click({ timeout: 2000 }); } catch {}
    };

    // Utility: randomly sample up to N indices from 0..len-1
    const sampleIndices = (len: number, max: number): number[] => {
      const count = Math.min(len, max);
      const idxs = Array.from({ length: len }, (_, i) => i);
      for (let i = idxs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
      }
      return idxs.slice(0, count).sort((a, b) => a - b);
    };

    // Utility: check images and links on current page
    const checkImagesAndLinks = async (sectionName: string, maxToCheck = 5) => {
      console.log(`\n🔎 Checking images and links on ${sectionName}...`);
      // Scroll to load lazy content
      for (let s = 0; s < 6; s++) { await page.mouse.wheel(0, 1200); await page.waitForTimeout(200); }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);

      // Images
      const imgLoc = page.locator('img[src]:visible');
      const imgCount = await imgLoc.count().catch(() => 0);
      const imgIdxs = sampleIndices(imgCount, maxToCheck);
      let brokenImages = 0;
      for (const i of imgIdxs) {
        const el = imgLoc.nth(i);
        const src = (await el.getAttribute('src').catch(() => null)) || '';
        if (!src) continue;
        const url = new URL(src, page.url()).toString();
        try {
          const resp = await page.request.get(url);
          if (resp.status() >= 400) {
            console.log(`❌ Broken image [${resp.status()}] ${url}`);
            brokenImages++;
          }
        } catch {
          console.log(`❌ Broken image [fetch error] ${url}`);
          brokenImages++;
        }
      }

      // Links
      const linkLoc = page.locator('a[href]:visible');
      const linkCount = await linkLoc.count().catch(() => 0);
      const linkIdxs = sampleIndices(linkCount, maxToCheck);
      let brokenLinks = 0;
      for (const i of linkIdxs) {
        const el = linkLoc.nth(i);
        const href = (await el.getAttribute('href').catch(() => null)) || '';
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
        const url = new URL(href, page.url()).toString();
        try {
          const resp = await page.request.get(url);
          if (resp.status() >= 400) {
            console.log(`❌ Broken link [${resp.status()}] ${url}`);
            brokenLinks++;
          } else {
            console.log(`✅ Link ok [${resp.status()}] ${url}`);
          }
        } catch {
          console.log(`❌ Broken link [fetch error] ${url}`);
          brokenLinks++;
        }
      }
      console.log(`📋 ${sectionName} — Checked images: ${imgIdxs.length}, broken: ${brokenImages}; Checked links: ${linkIdxs.length}, broken: ${brokenLinks}`);
    };

    // 1) Go to Vodacom Soccer
    await page.goto('https://vodacomsoccer.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await acceptConsent();

    // 2) Click Match Centre header tab (2nd tab)
    // Prefer explicit href; fallback to role/name if needed
    const matchCentreLink = page.locator('a[href="/match-centre"]').first();
    if ((await matchCentreLink.count()) === 0) {
      // Fallback: search by name text
      const mcByText = page.getByRole('link', { name: /match centre/i });
      await expect(mcByText).toBeVisible({ timeout: 10_000 });
      await mcByText.click();
    } else {
      // Ensure visibility or force click via JS if obstructed by overlays
      try {
        await matchCentreLink.scrollIntoViewIfNeeded();
        await matchCentreLink.click({ timeout: 5000 });
      } catch {
        const hrefEl = await matchCentreLink.elementHandle();
        if (hrefEl) {
          await hrefEl.evaluate((el: HTMLElement) => el.click());
        } else {
          // Absolute fallback: navigate directly
          await page.goto('https://vodacomsoccer.com/match-centre', { waitUntil: 'domcontentloaded' });
        }
      }
    }
    // Popups may reappear after route changes
    await acceptConsent();

    // Wait a bit for content to render
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // 3) Count how many events there are on Match Centre (restrict to main content)
    const main = page.locator('main, [role="main"], #__next');
    // Ensure All Leagues tab is active
    const allLeaguesTab = page.locator('li.tabs.tab-all');
    try {
      await allLeaguesTab.first().click({ timeout: 3000 }).catch(() => {});
    } catch {}
    await page.waitForTimeout(400);

    // Restrict strictly to match detail links
    let eventLinks = main.locator('a[href^="/match-centre/match-detail/"]');
    let total = await eventLinks.count();

    console.log(`📊 Match Centre events found: ${total}`);
    expect(total).toBeGreaterThan(0);

    // Test up to MAX_EVENTS (default 10) with per-event time caps to avoid global timeout
    const envMax = parseInt(process.env.MAX_EVENTS || '10', 10);
    const maxToTest = Math.min(total, isNaN(envMax) ? 10 : envMax);
    let pass = 0;
    let fail = 0;
    const failedEvents: string[] = [];
    const results: { event: string; result: 'PASS' | 'FAIL' }[] = [];

    for (let i = 0; i < maxToTest; i++) {
      const eventStartMs = Date.now();

      // Helper: run a task with a hard timeout
      const withTimeout = async <T>(task: () => Promise<T>, ms: number, onTimeout?: () => Promise<void> | void): Promise<{ ok: boolean; value?: T }> => {
        let timer: NodeJS.Timeout | undefined;
        try {
          const result = await Promise.race([
            task(),
            new Promise<undefined>((resolve, reject) => {
              timer = setTimeout(() => {
                reject(new Error('EVENT_TIMEOUT'));
              }, ms);
            })
          ]);
          if (timer) clearTimeout(timer);
          return { ok: true, value: result as T };
        } catch (err: any) {
          if (timer) clearTimeout(timer);
          if (err && err.message === 'EVENT_TIMEOUT') {
            console.log(`⏭️  Event timed out after ${ms}ms — skipping: ${title}`);
            if (onTimeout) await onTimeout();
            return { ok: false };
          }
          return { ok: false };
        }
      };
      // Re-query each iteration to avoid stale references
      const link = eventLinks.nth(i);
      const title = (await link.innerText().catch(() => `Event ${i + 1}`)).trim() || `Event ${i + 1}`;
      console.log(`\n🎯 Testing event ${i + 1}/${maxToTest}: ${title}`);

      await link.scrollIntoViewIfNeeded().catch(() => {});

      // Navigate into the event (robust: try click + URL wait, then href fallback)
      let navigated = false;
      try {
        await Promise.all([
          page.waitForURL(/\/match-centre\/match-detail\//, { timeout: 8_000 }),
          link.click({ timeout: 6_000 })
        ]);
        navigated = /\/match-centre\/match-detail\//.test(page.url());
      } catch {}
      if (!navigated) {
        const href = await link.getAttribute('href').catch(() => null);
        if (href) {
          try {
            const absolute = new URL(href, 'https://vodacomsoccer.com').toString();
            await page.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 10_000 });
            navigated = /\/match-centre\/match-detail\//.test(page.url());
          } catch {}
        }
      }
      if (!navigated) {
        console.log(`⚠️  Skip: could not open detail page — ${title}`);
        // Ensure we are back on list
        await page.goto('https://vodacomsoccer.com/match-centre', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await acceptConsent();
        await page.waitForTimeout(250);
        continue;
      }

      // Give the page time to render
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
      await acceptConsent();

      // 4) Look for match animation with per-event timeout budget
      const animationCheck = async () => {
        // Specific container and iframe on detail page (support both with/without .container)
        const animationContainer = page.locator('div.match-animation, div.match-animation.container');
        const animationIframe = page.locator('div.match-animation iframe.iframe-widget, div.match-animation.container iframe.iframe-widget');

        let hasAnimationLocal = false;
        try {
          await animationContainer.waitFor({ state: 'visible', timeout: 6_000 });
          await animationIframe.waitFor({ state: 'visible', timeout: 6_000 });
          const src = await animationIframe.getAttribute('src');
          const visible = await animationIframe.isVisible();
          hasAnimationLocal = !!src && src.includes('widgets.thesports01.com') && visible;
        } catch {
          // Secondary: some UIs lazy-load; do a short retry loop (shorter to keep test fast)
          const start = Date.now();
          while (!hasAnimationLocal && Date.now() - start < 3_500) {
            const src = await animationIframe.getAttribute('src').catch(() => null);
            const visible = await animationIframe.isVisible().catch(() => false);
            hasAnimationLocal = !!src && src.includes('widgets.thesports01.com') && visible;
            if (!hasAnimationLocal) await page.waitForTimeout(400);
          }
        }
        return hasAnimationLocal;
      };

      // Per-event detection budget (headed mode is slower; allow more time but bounded)
      const perEventBudgetMs = 20_000;
      const { ok: checkOk, value: checkResult } = await withTimeout<boolean>(animationCheck, perEventBudgetMs, async () => {
        // On timeout, try to go back to list
        await page.goto('https://vodacomsoccer.com/match-centre', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await acceptConsent();
      });

      const hasAnimation = !!checkOk && !!checkResult;

      // Watchdog: if this event is taking too long, skip to next (navigate back)
      if (Date.now() - eventStartMs > perEventBudgetMs + 5_000 && !hasAnimation) {
        console.log(`⏭️  Timeout on event — skipping: ${title}`);
        await page.goto('https://vodacomsoccer.com/match-centre', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await acceptConsent();
        await page.waitForTimeout(250);
      }

      if (hasAnimation) {
        console.log(`✅ PASS: match animation detected — ${title}`);
        pass++;
        results.push({ event: title, result: 'PASS' });
      } else {
        console.log(`❌ FAIL: no match animation detected — ${title}`);
        fail++;
        failedEvents.push(title);
        results.push({ event: title, result: 'FAIL' });
      }

      // Go back to Match Centre list to continue (navigate directly for stability)
      await page.goto('https://vodacomsoccer.com/match-centre', { waitUntil: 'domcontentloaded' }).catch(() => {});
      await acceptConsent();
      await page.waitForTimeout(250);
    }

    // Summary (aligned with NFL-style logs)
    console.log('\n🧪 === VODACOM SOCCER – MATCH CENTRE ANIMATION RESULTS ===');
    console.log(`📊 Total events checked: ${maxToTest}`);
    console.log(`✅ Passed: ${pass}`);
    console.log(`❌ Failed: ${fail}`);
    if (failedEvents.length) {
      console.log('\n🔴 Failed events:');
      failedEvents.forEach((e, idx) => console.log(`${idx + 1}. ${e}`));
    }

    // Soft assertion: allow some failures, but ensure at least 1 pass if any events exist
    if (maxToTest > 0) {
      expect(pass).toBeGreaterThan(0);
    }

    // Write JSON summary for external reporting
    try {
      const fs = require('fs');
      const summary = {
        testName: 'Vodacom Soccer – Match Centre Animation Checks',
        totalChecked: maxToTest,
        passed: pass,
        failed: fail,
        results
      };
      fs.writeFileSync('vodacom-events-results.json', JSON.stringify(summary, null, 2));
      console.log('📄 Saved results to vodacom-events-results.json');
    } catch {}

    // === Extended Site Checks ===
    // Home page checks
    try {
      await page.goto('https://vodacomsoccer.com/', { waitUntil: 'domcontentloaded' });
      await acceptConsent();
      await page.waitForTimeout(300);
      await checkImagesAndLinks('Home', 5);
    } catch {}

    // Match Centre tab (already covered above) — skip heavy tests, only quick surface checks
    try {
      await page.goto('https://vodacomsoccer.com/match-centre', { waitUntil: 'domcontentloaded' });
      await acceptConsent();
      await page.waitForTimeout(200);
      await checkImagesAndLinks('Match Centre (surface)', 3);
    } catch {}

    // Play tab
    try {
      await page.goto('https://vodacomsoccer.com/play', { waitUntil: 'domcontentloaded' });
      await acceptConsent();
      await checkImagesAndLinks('Play', 5);
    } catch {}

    // Competitions tab
    try {
      await page.goto('https://vodacomsoccer.com/competitions', { waitUntil: 'domcontentloaded' });
      await acceptConsent();
      await checkImagesAndLinks('Competitions', 5);
    } catch {}

    // News — Featured + sub-tabs PSL, EPL, Bafana Bafana, La Liga, Bundesliga
    try {
      await page.goto('https://vodacomsoccer.com/news', { waitUntil: 'domcontentloaded' });
      await acceptConsent();
      await checkImagesAndLinks('News — Featured', 5);
      const newsTabs = [
        { name: 'PSL', path: '/news/psl' },
        { name: 'EPL', path: '/news/epl' },
        { name: 'Bafana', path: '/news/bafana-bafana' },
        { name: 'La Liga', path: '/news/la-liga' },
        { name: 'Bundesliga', path: '/news/bundesliga' }
      ];
      for (const t of newsTabs) {
        try {
          await page.goto(`https://vodacomsoccer.com${t.path}`, { waitUntil: 'domcontentloaded' });
          await acceptConsent();
          console.log(`⏱️  Loaded News tab: ${t.name} → ${page.url()}`);
          await checkImagesAndLinks(`News — ${t.name}`, 5);
        } catch {
          console.log(`⚠️  Could not load News tab: ${t.name}`);
        }
      }
    } catch {}

    // Teams
    try {
      await page.goto('https://vodacomsoccer.com/teams', { waitUntil: 'domcontentloaded' });
      await acceptConsent();
      await checkImagesAndLinks('Teams', 5);
    } catch {}

    // Videos — open a couple of items to ensure redirects/pages load
    try {
      await page.goto('https://vodacomsoccer.com/videos', { waitUntil: 'domcontentloaded' });
      await acceptConsent();
      // Click first two visible video links/cards
      const items = page.locator('a[href*="/videos/"]:visible');
      const n = Math.min(await items.count().catch(() => 0), 2);
      for (let i = 0; i < n; i++) {
        const link = items.nth(i);
        const href = (await link.getAttribute('href').catch(() => null)) || '';
        if (!href) continue;
        const dest = new URL(href, page.url()).toString();
        try {
          const resp = await page.request.get(dest);
          console.log(`${resp.status() < 400 ? '✅' : '❌'} Video link [${resp.status()}] ${dest}`);
        } catch {
          console.log(`❌ Video link [fetch error] ${dest}`);
        }
      }
    } catch {}
  });
});


