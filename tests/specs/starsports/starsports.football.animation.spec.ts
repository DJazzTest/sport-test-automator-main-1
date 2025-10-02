import { test, expect } from '@playwright/test';

test('StarSports – Football Animation Check', async ({ page, context }) => {
  // Longer timeout to iterate many events with per-event caps
  test.setTimeout(10 * 60_000);

  // Helper: accept cookies if shown
  const acceptCookies = async () => {
    try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
    try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
  };

  // 1) Go to StarSports homepage and click Football in the left navigation
  await page.goto('https://starsports.bet/', { waitUntil: 'domcontentloaded' });
  await acceptCookies();
  
  // Click Football in the popular section (left navigation)
  await page.locator('[data-test="popular"]').getByRole('link', { name: 'Football' }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(800);
  
  // Click Today tab
  await page.getByRole('button', { name: 'Today' }).click();
  await page.waitForTimeout(600);

  // 2) Locate football events links using specific selectors
  // Use the same selectors as the working test
  let eventLinks = page.locator('a[href*="/event/"]').filter({ hasText: /vs|v/ });
  let total = await eventLinks.count().catch(() => 0);
  
  // If no events found, try broader search but filter out non-event links
  if (total === 0) {
    eventLinks = page.locator('a[href*="/event/"]').filter(link => {
      return link.evaluate(el => {
        const text = el.textContent?.trim() || '';
        // Filter out privacy policy, CMP, and other non-event links
        return !text.includes('Privacy Policy') && 
               !text.includes('Learn more') && 
               !text.includes('#IAB') &&
               !text.includes('Settings') &&
               (text.includes('vs') || text.includes('v') || text.includes(' - '));
      });
    });
    total = await eventLinks.count().catch(() => 0);
  }

  console.log(`📊 StarSports Football events found: ${total}`);
  expect(total).toBeGreaterThan(0);

  const maxToTest = Math.min(total, 30);
  let pass = 0;
  let fail = 0;
  const failedEvents: string[] = [];

  for (let i = 0; i < maxToTest; i++) {
    const link = eventLinks.nth(i);
    const title = (await link.innerText().catch(() => `Event ${i + 1}`)).trim() || `Event ${i + 1}`;
    console.log(`\n🎯 Testing event ${i + 1}/${maxToTest}: ${title}`);

    const eventStart = Date.now();

    // Open event in a separate page to isolate and prevent closing the main list page
    const href = await link.getAttribute('href').catch(() => null);
    if (!href) {
      console.log(`⚠️  Skip: no href for detail page — ${title}`);
      continue;
    }
    const absolute = new URL(href, 'https://starsports.bet').toString();
    const detail = await context.newPage();
    await detail.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {});
    await detail.waitForTimeout(600).catch(() => {});

    // 3) Check for animation widgets
    const animationCheck = async () => {
      // Check if Live tracker is already open by looking for animation elements
      let hasAnimLocal = false;
      
      // First check for existing animation elements
      const existingWidget = detail.locator('#the-football-sport-widget iframe, .animated_widget iframe');
      hasAnimLocal = await existingWidget.isVisible({ timeout: 1000 }).catch(() => false);
      
      // If no animation found, try to open Live tracker
      if (!hasAnimLocal) {
        console.log('🖱️ Live tracker not open, clicking to open...');
        const liveTracker = detail.getByRole('heading', { name: 'Live tracker' });
        const trackerVisible = await liveTracker.isVisible({ timeout: 3000 }).catch(() => false);
        if (trackerVisible) {
          await liveTracker.click({ timeout: 2000 }).catch(() => {});
          await detail.waitForTimeout(1000);
          console.log('✅ Live tracker clicked');
        } else {
          console.log('⚠️ Live tracker heading not found');
        }
      } else {
        console.log('✅ Live tracker already open');
      }

      // Now check for the football widget iframe
      const widget = detail.locator('#the-football-sport-widget iframe');
      const start = Date.now();
      while (Date.now() - start < 6000) {
        const visible = await widget.isVisible({ timeout: 500 }).catch(() => false);
        if (visible) {
          const src = await widget.getAttribute('src').catch(() => null);
          if (src && src.includes('thesports01.com')) {
            console.log(`✅ Animation iframe detected: ${src}`);
            hasAnimLocal = true;
            break;
          }
        }
        await detail.waitForTimeout(400).catch(() => {});
      }

      if (hasAnimLocal) return true;

      // Fallbacks: generic widget ids and expanding Live tracker section
      const sportWidget = detail.locator('[id*="sport-widget"] iframe, [id*="widget"] iframe');
      const sportVisible = await sportWidget.isVisible({ timeout: 3000 }).catch(() => false);
      if (sportVisible) return true;

      const liveTrackerHeading = detail.getByRole('heading', { name: /Live tracker/i }).first();
      await liveTrackerHeading.click({ timeout: 2000 }).catch(() => {});
      // After expanding, retry container path briefly
      try {
        await widgetContainer.waitFor({ state: 'visible', timeout: 4_000 });
        const iframe = widgetContainer.locator('iframe');
        const start2 = Date.now();
        while (Date.now() - start2 < 5_000) {
          const src = await iframe.getAttribute('src').catch(() => null);
          const visible = await iframe.isVisible().catch(() => false);
          if (src && src.includes('widgets.thesports01.com') && visible) return true;
          await detail.waitForTimeout(400).catch(() => {});
        }
      } catch {}
      return false;
    };

    let hasAnim = false;
    try {
      hasAnim = await Promise.race([
        animationCheck(),
        new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('EVENT_TIMEOUT')), 18_000))
      ]) as boolean;
    } catch {
      hasAnim = false;
    }

    if (hasAnim) {
      console.log(`✅ PASS: animation detected — ${title}`);
      pass++;
    } else {
      console.log(`❌ FAIL: no animation detected — ${title}`);
      fail++;
      failedEvents.push(title);
    }

    // 4) Navigate back to listing to continue
    // Close the detail page to return focus to the list (do not navigate the main page)
    try { await detail.close(); } catch {}
    try { await page.bringToFront(); } catch {}
    // Small settle wait; avoid interacting if page got closed unexpectedly
    try { if (!page.isClosed()) await page.waitForTimeout(250); } catch {}

    // Watchdog per-event overhead
    if (Date.now() - eventStart > 25_000 && !hasAnim) {
      console.log(`⏭️  Event exceeded time budget — ${title}`);
    }
  }

  console.log('\n🧪 === STARSPORTS – FOOTBALL ANIMATION RESULTS ===');
  console.log(`📊 Total events checked: ${maxToTest}`);
  console.log(`✅ Passed: ${pass}`);
  console.log(`❌ Failed: ${fail}`);
});


