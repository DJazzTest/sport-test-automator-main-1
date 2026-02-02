import { test, expect, Page } from '@playwright/test';

async function acceptConsent(page: Page): Promise<void> {
  try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 2500 }); } catch {}
  try { await page.getByRole('button', { name: /Accept & Continue/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 2000 }); } catch {}
  try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 1500 }); } catch {}
}

async function detectNflAnimation(page: Page): Promise<boolean> {
  // Look for animated_widget div with iframe
  const container = page.locator('div.animated_widget');
  try {
    await container.scrollIntoViewIfNeeded().catch(() => {});
    const isVis = await container.isVisible({ timeout: 2_000 }).catch(() => false);
    if (!isVis) return false;
    
    const iframe = container.locator('iframe');
    const iframeVis = await iframe.isVisible({ timeout: 2_000 }).catch(() => false);
    if (!iframeVis) return false;
    
    const src = await iframe.getAttribute('src').catch(() => null);
    if (src && /widgets.*thesports01\.com/i.test(src)) return true;
  } catch {}
  return false;
}

test('DragonSport – NFL Animation Check (US NFL only)', async ({ page }) => {
  test.setTimeout(8 * 60_000);

  await page.goto('https://dragonbet.co.uk/', { waitUntil: 'domcontentloaded' });
  await acceptConsent(page);

  // Navigate to American Football
  console.log('🏈 Navigating to American Football...');
  try { await page.getByRole('link', { name: 'American Football' }).first().click({ timeout: 4000 }); } catch {}
  await page.waitForTimeout(1500);

  // Tabs prioritization similar to StarSports: All/Today/Tomorrow/Weekend if present
  const tabs = ['All', 'Today', 'Tomorrow', 'Weekend'];
  const visibleTabs: string[] = [];
  for (const t of tabs) {
    const vis = await page.getByRole('button', { name: t }).first().isVisible({ timeout: 1200 }).catch(() => false);
    if (vis) visibleTabs.push(t);
  }

  let pass = 0, fail = 0; const results: string[] = [];

  const testTab = async (tab: string) => {
    console.log(`\n🔍 Testing NFL – ${tab}`);
    const tabButton = page.getByRole('button', { name: tab }).first();
    const tabVisible = await tabButton.isVisible({ timeout: 1500 }).catch(() => false);
    if (!tabVisible) {
      console.log(`ℹ️ ${tab} tab not visible, skipping...`);
      return;
    }
    await tabButton.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);

    // Check for "no events" message
    const noEvents = await page.getByText(/Sorry,? we haven't found any/i).isVisible({ timeout: 1000 }).catch(() => false);
    if (noEvents) { console.log(`ℹ️ No NFL events on ${tab} (no events message shown)`); return; }

    // Look for event links that contain EventRowParticipantName (actual event rows only)
    let eventLinks = page.locator('a:has(div[class*="EventRowParticipantName"])');
    let total = await eventLinks.count();

    if (!total) { console.log(`ℹ️ No NFL events on ${tab}`); return; }
    console.log(`📊 NFL events on ${tab}: ${total}`);

    const maxToTest = Math.min(total, 10);
    for (let i = 0; i < maxToTest; i++) {
      // Re-query event links each iteration
      eventLinks = page.locator('a:has(div[class*="EventRowParticipantName"])');
      const freshCount = await eventLinks.count();
      if (i >= freshCount) break;
      
      const link = eventLinks.nth(i);
      const title = (await link.innerText().catch(() => `Event ${i+1}`)).trim();
      
      await link.click();
      await page.waitForTimeout(400);

      // Find Live Tracker collapse section
      const liveTrackerCollapse = page.locator('div[class*="CollapseLabel"]').filter({ hasText: /Live tracker/i }).first();
      const isVisible = await liveTrackerCollapse.isVisible({ timeout: 2000 }).catch(() => false);
      
      if (isVisible) {
        // Check if collapsed by looking for the animated_widget - if not visible, click to expand
        let widgetVisible = await page.locator('div.animated_widget').isVisible({ timeout: 500 }).catch(() => false);
        
        if (!widgetVisible) {
          // Click to expand
          await liveTrackerCollapse.click({ timeout: 1000 }).catch(() => {});
          await page.waitForTimeout(500);
          
          // Check again after clicking
          widgetVisible = await page.locator('div.animated_widget').isVisible({ timeout: 500 }).catch(() => false);
          
          // If still not visible, try clicking again (might need double click)
          if (!widgetVisible) {
            await liveTrackerCollapse.click({ timeout: 1000 }).catch(() => {});
            await page.waitForTimeout(500);
          }
        }
      }
      
      const hasAnim = await detectNflAnimation(page);
      if (hasAnim) { pass++; results.push(`PASS: ${title}`); } else { fail++; results.push(`FAIL: ${title}`); }
      
      // Click American Football link to go back
      await page.getByRole('link', { name: 'American Football' }).click();
      await page.waitForTimeout(300);
      // Re-click tab
      const tabAgain = page.getByRole('button', { name: tab }).first();
      if (await tabAgain.isVisible({ timeout: 1500 }).catch(() => false)) {
        await tabAgain.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    }
  };

  // Test Today, Tomorrow, Weekend in order, fallback to All if none have events
  await testTab('Today');
  await testTab('Tomorrow');
  await testTab('Weekend');
  
  // If we have no results, try All tab
  if ((pass + fail) === 0) {
    await testTab('All');
  }

  console.log(`\n🧪 NFL RESULTS — PASS: ${pass} | FAIL: ${fail}`);
  results.forEach(r => console.log(r));
});











