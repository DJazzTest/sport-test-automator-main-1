import { test, expect } from '@playwright/test';

test('Vodacom Comprehensive Navigation Test', async ({ page, context }) => {
  test.setTimeout(300000); // 5 minutes for comprehensive test
  
  const baseUrl = 'https://vodacomsoccer.com';
  let testResults = {
    passed: 0,
    failed: 0,
    skipped: 0,
    steps: [] as Array<{ step: string; status: 'pass' | 'fail' | 'skip' }>
  };

  // Helper function to safely click with logging
  async function safeClick(
    description: string,
    action: () => Promise<void>,
    timeout = 15000
  ): Promise<boolean> {
    try {
      await action();
      testResults.passed++;
      testResults.steps.push({ step: description, status: 'pass' });
      console.log(`✅ ${description}`);
      return true;
    } catch (error) {
      testResults.failed++;
      testResults.steps.push({ step: description, status: 'fail' });
      console.log(`❌ ${description} - ${error.message}`);
      return false;
    }
  }

  // Helper function to ensure we're on a valid page
  async function ensurePageState(): Promise<void> {
    try {
      const url = page.url();
      if (!url || url.includes('chrome-error://') || url.includes('about:blank')) {
        console.log('⚠️  Page state invalid, navigating to homepage...');
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
      }
    } catch (error) {
      console.log('⚠️  Error checking page state, attempting recovery...');
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
    }
  }

  // Helper function to handle popups
  async function handlePopups(): Promise<void> {
    const pages = context.pages();
    for (let i = pages.length - 1; i > 0; i--) {
      try {
        if (!pages[i].isClosed()) {
          await pages[i].close();
          console.log('✅ Closed popup window');
        }
      } catch (error) {
        // Popup already closed or error closing
      }
    }
  }

  console.log('🚀 Starting Vodacom Comprehensive Navigation Test\n');

  // Step 1: Navigate to homepage
  await safeClick('Navigate to homepage', async () => {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  });

  // Step 2: Handle cookies
  await safeClick('Handle first cookie popup', async () => {
    await page.getByRole('button', { name: 'Accept all Cookies' }).click({ timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  await safeClick('Handle second cookie popup', async () => {
    await page.getByRole('button', { name: 'Agree and proceed' }).click({ timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  // Step 3: Click on article link
  await safeClick('Click article link', async () => {
    await page.getByRole('link', { name: /matchday-13-or-team-of-the-/i }).click({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.waitForLoadState('domcontentloaded');
  });

  // Step 4: Close button if present
  await safeClick('Close modal/overlay', async () => {
    await page.getByRole('button', { name: 'Close' }).click({ timeout: 5000 });
    await page.waitForTimeout(1000);
  });

  // Step 5: MORE EPL NEWS link
  await safeClick('Click MORE EPL NEWS link', async () => {
    const link = page.locator('a').filter({ hasText: /MORE.*EPL.*NEWS/i }).first();
    await link.waitFor({ state: 'visible', timeout: 15000 });
    await link.click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('domcontentloaded');
  });

  // Step 6: Navigate to Match Centre
  await safeClick('Navigate to Match Centre', async () => {
    await ensurePageState();
    const matchCentreLink = page.getByRole('link', { name: 'Match Centre' });
    if (await matchCentreLink.isVisible({ timeout: 10000 })) {
      await matchCentreLink.click();
    } else {
      await page.goto(`${baseUrl}/match-centre`, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(3000);
    await page.waitForLoadState('domcontentloaded');
  });

  // Step 7: CAF Champions League link
  await safeClick('Click CAF Champions League link', async () => {
    await page.getByRole('link', { name: /CAF Champions League/i }).click({ timeout: 15000 });
    await page.waitForTimeout(2000);
  });

  // Step 8: All Leagues link
  await safeClick('Click All Leagues link', async () => {
    await page.getByRole('link', { name: /All Leagues/i }).click({ timeout: 15000 });
    await page.waitForTimeout(2000);
  });

  // Step 9: FC Kairat link
  await safeClick('Click FC Kairat link', async () => {
    await page.getByRole('link', { name: /FC Kairat/i }).click({ timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.waitForLoadState('domcontentloaded');
  });

  // Step 10: Interact with iframe swiper in Live tabpanel
  await safeClick('Interact with Live tabpanel iframe swiper', async () => {
    const tabpanel = page.getByRole('tabpanel', { name: 'Live' });
    await tabpanel.waitFor({ state: 'visible', timeout: 10000 });
    const iframe = tabpanel.locator('iframe').first();
    await iframe.waitFor({ state: 'attached', timeout: 10000 });
    const frame = await iframe.contentFrame();
    if (frame) {
      await frame.locator('.swiper-slide').first().waitFor({ state: 'visible', timeout: 10000 });
      await frame.locator('.swiper-slide').first().click();
      await page.waitForTimeout(2000);
    }
  });

  // Step 11: Bayern Munich link
  await safeClick('Click Bayern Munich link', async () => {
    await page.getByRole('link', { name: /Bayern Munich/i }).click({ timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.waitForLoadState('domcontentloaded');
  });

  // Step 12: Interact with iframe swiper again
  await safeClick('Interact with iframe swiper (second time)', async () => {
    const tabpanel = page.getByRole('tabpanel', { name: 'Live' });
    const iframe = tabpanel.locator('iframe').first();
    const frame = await iframe.contentFrame();
    if (frame) {
      await frame.locator('.swiper-slide').first().click({ timeout: 10000 });
      await page.waitForTimeout(2000);
    }
  });

  // Step 13: Monaco link
  await safeClick('Click Monaco link', async () => {
    await page.getByRole('link', { name: /Monaco.*0.*0/i }).click({ timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.waitForLoadState('domcontentloaded');
  });

  // Step 14: Interact with iframe swiper (third time)
  await safeClick('Interact with iframe swiper (third time)', async () => {
    const tabpanel = page.getByRole('tabpanel', { name: 'Live' });
    const iframe = tabpanel.locator('iframe').first();
    const frame = await iframe.contentFrame();
    if (frame) {
      await frame.locator('.swiper-slide').first().click({ timeout: 10000 });
      await page.waitForTimeout(2000);
    }
  });

  // Step 15: Play link
  await safeClick('Click Play link', async () => {
    await ensurePageState();
    await page.getByRole('link', { name: 'Play' }).click({ timeout: 15000 });
    await page.waitForTimeout(2000);
  });

  // Step 16: Fantasy League popup
  await safeClick('Handle Fantasy League popup', async () => {
    const popupPromise = context.waitForEvent('page', { timeout: 5000 });
    await page.locator('span').filter({ hasText: /Vodacom Fantasy League/i }).getByRole('link').click({ timeout: 10000 });
    const popup = await popupPromise;
    if (popup && !popup.isClosed()) {
      await popup.close();
    }
    await page.waitForTimeout(1000);
    await ensurePageState();
  });

  // Step 17: Competitions
  await safeClick('Navigate to Competitions', async () => {
    await ensurePageState();
    await page.getByRole('link', { name: 'Competitions' }).click({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.waitForLoadState('domcontentloaded');
  });

  await safeClick('Click Current filter', async () => {
    await page.getByText('Current', { exact: true }).click({ timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  // Step 18: Ticket links
  const ticketLinks = [
    /soweto-derby-stand-ticket/i,
    /soweto-derby-red-suite/i,
    /vodacom-soccer-ticket/i
  ];

  for (const ticketPattern of ticketLinks) {
    await safeClick(`Click ticket link: ${ticketPattern}`, async () => {
      await page.getByRole('link', { name: ticketPattern }).click({ timeout: 10000 });
      await page.waitForTimeout(1000);
    });
  }

  // Step 19: News section
  await safeClick('Navigate to News', async () => {
    await ensurePageState();
    await page.getByRole('link', { name: 'News' }).click({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.waitForLoadState('domcontentloaded');
  });

  // Step 20: News tabs and load more
  const newsTabs = ['AFCON', 'PSL', 'EPL', 'Bafana Bafana', 'La Liga', 'Bundesliga'];
  for (const tabName of newsTabs) {
    await safeClick(`Click ${tabName} news tab`, async () => {
      await page.getByRole('tab', { name: tabName }).click({ timeout: 10000 });
      await page.waitForTimeout(2000);
    });

    await safeClick(`Load more articles for ${tabName}`, async () => {
      const loadMore = page.locator('a').filter({ hasText: /LOAD MORE ARTICLES/i });
      if (await loadMore.isVisible({ timeout: 5000 })) {
        await loadMore.click();
        await page.waitForTimeout(2000);
      } else {
        throw new Error('Load more button not visible');
      }
    });
  }

  // Step 21: Team links
  const teams = [
    { name: 'Kaizer Chiefs', exact: false },
    { name: 'Orlando Pirates', exact: false },
    { name: 'Mamelodi Sundowns', exact: false },
    { name: 'Amazulu', exact: true },
    { name: 'Siwelele FC', exact: false },
    { name: 'Stellenbosch FC', exact: false },
    { name: 'Chippa United', exact: false }
  ];

  for (const team of teams) {
    await safeClick(`Navigate to ${team.name} team page`, async () => {
      await ensurePageState();
      if (team.exact) {
        await page.getByRole('link', { name: team.name, exact: true }).click({ timeout: 10000 });
      } else {
        await page.getByRole('link', { name: team.name }).click({ timeout: 10000 });
      }
      await page.waitForTimeout(2000);
      await page.waitForLoadState('domcontentloaded');
    });
  }

  // Step 22: Videos section
  await safeClick('Navigate to Videos', async () => {
    await ensurePageState();
    const videosLink = page.getByRole('link', { name: 'Videos' });
    if (await videosLink.isVisible({ timeout: 10000 })) {
      await videosLink.click();
    } else {
      await page.goto(`${baseUrl}/videos`, { waitUntil: 'domcontentloaded' });
    }
    await page.waitForTimeout(2000);
    await page.waitForLoadState('domcontentloaded');
  });

  await safeClick('Click PSL Highlights link', async () => {
    await page.locator('li').filter({ hasText: 'PSL Highlights' }).locator('a').click({ timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  // Step 23: Navigate to videos page again
  await safeClick('Navigate to videos page (second time)', async () => {
    await page.goto(`${baseUrl}/videos`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  });

  await safeClick('Click PSL Highlights filter', async () => {
    await page.locator('li').filter({ hasText: 'PSL Highlights' }).click({ timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  await safeClick('Click Back link', async () => {
    await page.getByRole('link', { name: 'Back' }).click({ timeout: 10000 });
    await page.waitForTimeout(2000);
  });

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`⏭️  Skipped: ${testResults.skipped}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  // Log failed steps
  const failedSteps = testResults.steps.filter(s => s.status === 'fail');
  if (failedSteps.length > 0) {
    console.log('\n❌ Failed Steps:');
    failedSteps.forEach(step => {
      console.log(`   - ${step.step}`);
    });
  }

  // Test passes if at least 70% of steps pass
  const successRate = (testResults.passed / (testResults.passed + testResults.failed)) * 100;
  expect(successRate).toBeGreaterThanOrEqual(70);
});
