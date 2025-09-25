import { test, expect, Page } from '@playwright/test';

test('PlanetSportBet – Tennis Tab Animation Check', async ({ page, context }) => {
  test.setTimeout(10 * 60_000);
  // 1) Land on PlanetSportBet and navigate to Tennis via left-hand pane
  await page.goto('https://planetsportbet.com/');
  const acceptPopups = async (p: Page) => {
    try { await p.getByRole('button', { name: /Allow all/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
    try { await p.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
    try { await p.locator('[data-test="landing-page"] [data-test="close-icon"] path').click({ timeout: 1500 }); } catch {}
    try {
      const uni = p.locator('[id^="uniccmp"], div:has-text("Accept & Continue")');
      if (await uni.isVisible({ timeout: 1000 }).catch(() => false)) {
        await p.getByRole('button', { name: /Accept/i }).click({ timeout: 1500 }).catch(() => {});
      }
    } catch {}
  };
  await acceptPopups(page);

  // Left-pane Tennis
  const tennisLink = page.getByRole('link', { name: /^Tennis$/ });
  await expect(tennisLink).toBeVisible({ timeout: 8000 });
  await tennisLink.click();
  await page.waitForLoadState('domcontentloaded');

  // 2) Prefer Today/Tomorrow tabs; else stay on All
  const clickTabIfVisible = async (name: string): Promise<boolean> => {
    const btn = page.getByRole('button', { name });
    const visible = await btn.isVisible({ timeout: 1500 }).catch(() => false);
    if (!visible) return false;
    await btn.click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(600);
    return true;
  };
  let activeTab: 'Today' | 'Tomorrow' | 'All' = 'All';
  if (await clickTabIfVisible('Today')) activeTab = 'Today';
  else if (await clickTabIfVisible('Tomorrow')) activeTab = 'Tomorrow';
  else activeTab = 'All';
  console.log(`🎾 Tennis active tab: ${activeTab}`);

  // 3) Get tennis events and count them
  console.log('🔍 Looking for tennis events...');
  await page.screenshot({ path: 'tennis-page-debug.png' });
  console.log('📸 Screenshot saved as tennis-page-debug.png');

  let eventWrappers = page.locator('a[href*="/event/"]');
  const count = await eventWrappers.count();
  console.log(`🎾 Number of Tennis event links found: ${count}`);
  if (count === 0) {
    console.log('❌ No tennis events found');
    return;
  }

  const results: {event: string, result: string}[] = [];
  const failedEvents: string[] = [];
  const passedEvents: string[] = [];

  const maxEvents = Math.min(20, count);
  for (let i = 0; i < maxEvents; i++) {
    eventWrappers = page.locator('a[href*="/event/"]');
    const event = eventWrappers.nth(i);
    let title = `Tennis Event ${i + 1}`;
    try { title = await event.textContent() || title; } catch {}

    await event.scrollIntoViewIfNeeded();

    // Open event in a new page for stability
    const href = await event.getAttribute('href').catch(() => null);
    if (!href) {
      results.push({ event: title, result: 'FAIL' });
      failedEvents.push(title);
      continue;
    }
    const absolute = new URL(href, 'https://planetsportbet.com').toString();
    const detail = await context.newPage();
    await detail.goto(absolute, { waitUntil: 'domcontentloaded', timeout: 12000 }).catch(() => {});
    await detail.waitForTimeout(600).catch(() => {});
    await acceptPopups(detail);

    console.log(`📊 Checking Live tracker status for ${title}...`);
    let liveTrackerOpen = false;
    let liveTrackerClicked = false;

    try {
      await detail.waitForSelector('.animated_widget', { state: 'visible', timeout: 2000 });
      liveTrackerOpen = true;
      console.log(`✅ Live tracker already open for ${title}`);
    } catch {
      console.log('ℹ️ Live tracker not open, attempting to click...');
      try {
        await detail.getByRole('heading', { name: /Live tracker/i }).click({ timeout: 5000 });
        console.log(`✅ Live tracker clicked for ${title}`);
        liveTrackerClicked = true;
        await detail.waitForTimeout(800);
      } catch (error) {
        console.log(`⚠️ Could not find Live tracker button for ${title}: ${String(error)}`);
      }
    }

    let animPassed = false;
    if (liveTrackerOpen || liveTrackerClicked) {
      try {
        await detail.waitForSelector('.animated_widget', { state: 'visible', timeout: 12000 });
        await detail.waitForSelector('.animated_widget iframe', { state: 'visible', timeout: 12000 });

        // Poll for iframe src
        let iframeSrc: string | null = null;
        for (let attempt = 0; attempt < 12 && !iframeSrc; attempt++) {
          await detail.waitForTimeout(800);
          iframeSrc = await detail.locator('.animated_widget iframe').getAttribute('src');
          console.log(`   Attempt ${attempt + 1}/12: src = ${iframeSrc}`);
        }

        let iframe = detail.locator('.animated_widget iframe');
        let isIframeVisible = await iframe.isVisible().catch(() => false);
        if (!isIframeVisible && !iframeSrc) {
          iframe = detail.locator('iframe[src*="widgets.thesports01.com"]');
          isIframeVisible = await iframe.isVisible().catch(() => false);
          if (isIframeVisible) iframeSrc = await iframe.getAttribute('src');
        }

        if (iframeSrc && iframeSrc.includes('widgets.thesports01.com') && isIframeVisible) {
          animPassed = true;
          console.log(`✅ PASS: Live tracker open and animation loaded for — ${title}`);
          console.log(`🔗 Iframe src: ${iframeSrc}`);
          passedEvents.push(title);
        } else {
          console.log(`❌ FAIL: Live tracker open but no animation for — ${title}`);
          failedEvents.push(title);
        }
      } catch (error) {
        console.log(`❌ FAIL: Live tracker not accessible for — ${title}`);
        failedEvents.push(title);
      }
    } else {
      console.log(`❌ FAIL: Could not access Live tracker for — ${title}`);
      failedEvents.push(title);
    }

    results.push({ event: title, result: animPassed ? 'PASS' : 'FAIL' });

    try { await detail.close(); } catch {}
    await page.bringToFront().catch(() => {});
    await page.waitForTimeout(200).catch(() => {});
  }

  // Report
  console.log('\n🧪 === TENNIS ANIMATION TEST RESULTS ===');
  const passCount = results.filter(r => r.result === 'PASS').length;
  const failCount = results.filter(r => r.result === 'FAIL').length;
  const passRate = maxEvents > 0 ? Math.round((passCount / maxEvents) * 100) : 0;
  console.log(`📊 Total Tennis Events Tested: ${maxEvents}`);
  console.log(`✅ Events with Animations (PASS): ${passCount}`);
  console.log(`❌ Events without Animations (FAIL): ${failCount}`);
  console.log(`📈 Animation Success Rate: ${passRate}%`);

  console.log('\n📋 === DETAILED RESULTS ===');
  results.forEach(r => console.log(`${r.result}: ${r.event}`));
});
