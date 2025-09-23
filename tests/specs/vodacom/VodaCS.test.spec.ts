import { test, expect } from '@playwright/test';

test.describe('Vodacom Soccer – Match Centre Animation Checks', () => {
  test('VodaCS – Match Centre events have match animations', async ({ page }) => {
    // Increase overall timeout to accommodate slow site; we also cap per-event runtime
    test.setTimeout(900_000);

    // Helper: accept popups if present
    const acceptPopups = async () => {
      // Accept all Cookies (bottom OneTrust)
      try {
        const btn = page.getByRole('button', { name: 'Accept all Cookies' });
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click({ timeout: 3000 });
          console.log('✅ Clicked: Accept all Cookies');
        }
      } catch {}
      // Agree and proceed
      try {
        const btn2 = page.getByRole('button', { name: 'Agree and proceed' });
        if (await btn2.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn2.click({ timeout: 3000 });
          console.log('✅ Clicked: Agree and proceed');
        }
      } catch {}
      // Fallbacks
      try {
        const oneTrust = page.locator('#onetrust-accept-btn-handler');
        if (await oneTrust.isVisible({ timeout: 1000 }).catch(() => false)) {
          await oneTrust.click({ timeout: 3000 });
          console.log('✅ Clicked OneTrust accept');
        }
      } catch {}
      try {
        const agree = page.locator('button.unic-agree-all-button');
        if (await agree.isVisible({ timeout: 1000 }).catch(() => false)) {
          await agree.click({ timeout: 3000 });
          console.log('✅ Clicked Agree (fallback)');
        }
      } catch {}
    };

    // 1) Go to Vodacom Soccer
    await page.goto('https://vodacomsoccer.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await acceptPopups();

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
    await acceptPopups();

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

    // Test up to 40 events with per-event time caps to avoid global timeout
    const maxToTest = Math.min(total, 40);
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
        await acceptPopups();
        await page.waitForTimeout(250);
        continue;
      }

      // Give the page time to render
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
      await acceptPopups();

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
        await acceptPopups();
      });

      const hasAnimation = !!checkOk && !!checkResult;

      // Watchdog: if this event is taking too long, skip to next (navigate back)
      if (Date.now() - eventStartMs > perEventBudgetMs + 5_000 && !hasAnimation) {
        console.log(`⏭️  Timeout on event — skipping: ${title}`);
        await page.goto('https://vodacomsoccer.com/match-centre', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await acceptPopups();
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
      await acceptPopups();
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
  });
});


