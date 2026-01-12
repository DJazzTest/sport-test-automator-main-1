import { test, expect, Page } from '@playwright/test';

async function acceptUniConsent(page: Page) {
  // Try direct CTA first
  const direct = page.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first();
  if (await direct.isVisible()) {
    await direct.click({ timeout: 5000 });
    return;
  }

  // Fallback: within #uniccmp container
  const root = page.locator('#uniccmp');
  if (await root.count()) {
    const candidates = [
      root.getByRole('button', { name: /Accept\s*&\s*Continue/i }).first(),
      root.getByRole('button', { name: /Accept All/i }).first(),
      root.getByRole('button', { name: /I Accept/i }).first(),
      root.locator('button:has-text("Accept")').first(),
      root.locator('button:has-text("Allow All")').first(),
    ];
    for (const btn of candidates) {
      if (await btn.isVisible()) {
        await btn.click({ timeout: 5000 });
        break;
      }
    }
  }
}

async function dismissOverlays(page: Page) {
  await page.evaluate(() => {
    const ids = ['uniccmp', 'ps-nav-overlay'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        (el as HTMLElement).style.setProperty('display', 'none', 'important');
        (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
        (el as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
      }
    });
    document.querySelectorAll('[role="dialog"], .unic-modal-container')
      .forEach(d => {
        (d as HTMLElement).style.setProperty('display', 'none', 'important');
        (d as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
        (d as HTMLElement).style.setProperty('pointer-events', 'none', 'important');
      });
  });
}

async function validatePsTags(page: Page, request: any, sectionName: string) {
  console.log(`\n🔍 Testing ps-tag elements in ${sectionName}...`);
  
  // Find all elements with ps-tag class or data attributes
  const psTagSelectors = [
    '[class*="ps-tag"]',
    '[data-ps-tag]',
    '.ps-tag',
    '[class*="tag"]'
  ];
  
  const psTagElements = await page.locator(psTagSelectors.join(', ')).all();
  console.log(`Found ${psTagElements.length} ps-tag elements in ${sectionName}`);
  
  const brokenLinks: Array<{ url: string; status: number; element: string }> = [];
  
  for (let i = 0; i < psTagElements.length; i++) {
    const element = psTagElements[i];
    try {
      // Check if element has a link
      const link = element.locator('a[href]').first();
      if (await link.count() > 0) {
        const href = await link.getAttribute('href');
        if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, 'https://www.teamtalk.com').toString();
          
          try {
            const response = await request.get(fullUrl);
            const status = response.status();
            
            if (status >= 400) {
              const elementText = await element.textContent() || 'unknown';
              brokenLinks.push({
                url: fullUrl,
                status: status,
                element: elementText.trim()
              });
              console.log(`❌ [${status}] ${fullUrl} - Element: "${elementText.trim()}"`);
            } else {
              console.log(`✅ [${status}] ${fullUrl}`);
            }
          } catch (error) {
            const elementText = await element.textContent() || 'unknown';
            brokenLinks.push({
              url: fullUrl,
              status: -1,
              element: elementText.trim()
            });
            console.log(`❌ [ERROR] ${fullUrl} - Element: "${elementText.trim()}" - ${error}`);
          }
        }
      }
    } catch (error) {
      console.log(`Error processing element ${i}: ${error}`);
    }
  }
  
  return brokenLinks;
}

async function validateTeamsSection(page: Page, request: any) {
  console.log('\n⚽ Testing Teams section with w-6 h-6 elements...');
  
  const allBrokenLinks: Array<{ section: string; url: string; status: number; element: string }> = [];
  
  // Find all elements with w-6 h-6 classes
  const teamElements = await page.locator('.w-6.h-6.flex.justify-center.items-center, [class*="w-6"][class*="h-6"]').all();
  console.log(`Found ${teamElements.length} team elements with w-6 h-6 classes`);
  
  for (let i = 0; i < Math.min(teamElements.length, 20); i++) {
    const element = teamElements[i];
    try {
      // Check if element has a link
      const link = element.locator('a[href]').first();
      if (await link.count() > 0) {
        const href = await link.getAttribute('href');
        if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, 'https://www.teamtalk.com').toString();
          const elementText = await element.textContent() || 'unknown';
          
          try {
            const response = await request.get(fullUrl);
            const status = response.status();
            
            if (status >= 400) {
              allBrokenLinks.push({
                section: 'Teams Section',
                url: fullUrl,
                status: status,
                element: elementText.trim()
              });
              console.log(`❌ [${status}] ${fullUrl} - Element: "${elementText.trim()}"`);
            } else {
              console.log(`✅ [${status}] ${fullUrl} - Element: "${elementText.trim()}"`);
            }
          } catch (error) {
            allBrokenLinks.push({
              section: 'Teams Section',
              url: fullUrl,
              status: -1,
              element: elementText.trim()
            });
            console.log(`❌ [ERROR] ${fullUrl} - Element: "${elementText.trim()}" - ${error}`);
          }
        }
      }
    } catch (error) {
      console.log(`Error processing team element ${i}: ${error}`);
    }
  }
  
  return allBrokenLinks;
}

test.describe('TeamTalk ps-tag Validation Tests', () => {
  test('Validate ps-tag elements across homepage, transfers, contract news, premier league, and teams', async ({ page, request }) => {
    test.setTimeout(400_000); // 6.5 minutes timeout
    
    const allBrokenLinks: Array<{ section: string; url: string; status: number; element: string }> = [];
    
    // Step 1: Navigate to homepage and dismiss popups
    console.log('🏠 Navigating to TeamTalk homepage...');
    await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
    await acceptUniConsent(page);
    await dismissOverlays(page);
    
    // Validate we're on homepage
    await expect(page).toHaveURL(/teamtalk\.com/);
    console.log('✅ Successfully landed on homepage');
    
    // Test ps-tag elements on homepage
    const homepageBrokenLinks = await validatePsTags(page, request, 'Homepage');
    homepageBrokenLinks.forEach(link => {
      allBrokenLinks.push({ section: 'Homepage', ...link });
    });
    
    // Step 2: Navigate to Transfers News
    console.log('\n📰 Navigating to Transfers News...');
    try {
      // Try to find and click transfers news link
      const transfersLink = page.getByRole('link', { name: /transfer/i }).first();
      if (await transfersLink.count() > 0) {
        await transfersLink.click({ timeout: 10000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
        await acceptUniConsent(page);
        await dismissOverlays(page);
        console.log('✅ Successfully navigated to Transfers News');
      } else {
        // Fallback: direct navigation
        await page.goto('https://www.teamtalk.com/transfer-news', { waitUntil: 'domcontentloaded' });
        await acceptUniConsent(page);
        await dismissOverlays(page);
        console.log('✅ Navigated to Transfers News via direct URL');
      }
    } catch (error) {
      console.log('❌ Could not navigate to Transfers News, trying direct URL...');
      console.log('   📋 Steps to recreate:');
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log('      2. Try to navigate to the Transfers News section');
      console.log('      3. Expected: Transfers News should load successfully');
      console.log('      4. Actual: Navigation failed, trying direct URL');
      await page.goto('https://www.teamtalk.com/transfer-news', { waitUntil: 'domcontentloaded' });
      await acceptUniConsent(page);
      await dismissOverlays(page);
    }
    
    // Test ps-tag elements on transfers news page
    const transfersBrokenLinks = await validatePsTags(page, request, 'Transfers News');
    transfersBrokenLinks.forEach(link => {
      allBrokenLinks.push({ section: 'Transfers News', ...link });
    });
    
    // Step 3: Navigate to Contract News
    console.log('\n📋 Navigating to Contract News...');
    try {
      // Try to find and click contract news link
      const contractLink = page.getByRole('link', { name: /contract/i }).first();
      if (await contractLink.count() > 0) {
        await contractLink.click({ timeout: 10000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
        await acceptUniConsent(page);
        await dismissOverlays(page);
        console.log('✅ Successfully navigated to Contract News');
      } else {
        // Fallback: direct navigation
        await page.goto('https://www.teamtalk.com/contract-news', { waitUntil: 'domcontentloaded' });
        await acceptUniConsent(page);
        await dismissOverlays(page);
        console.log('✅ Navigated to Contract News via direct URL');
      }
    } catch (error) {
      console.log('❌ Could not navigate to Contract News, trying direct URL...');
      console.log('   📋 Steps to recreate:');
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log('      2. Try to navigate to the Contract News section');
      console.log('      3. Expected: Contract News should load successfully');
      console.log('      4. Actual: Navigation failed, trying direct URL');
      await page.goto('https://www.teamtalk.com/contract-news', { waitUntil: 'domcontentloaded' });
      await acceptUniConsent(page);
      await dismissOverlays(page);
    }
    
    // Test ps-tag elements on contract news page
    const contractBrokenLinks = await validatePsTags(page, request, 'Contract News');
    contractBrokenLinks.forEach(link => {
      allBrokenLinks.push({ section: 'Contract News', ...link });
    });
    
    // Step 4: Navigate to Premier League
    console.log('\n🏆 Navigating to Premier League...');
    try {
      // Try to find and click premier league link
      const premierLeagueLink = page.getByRole('link', { name: /premier.league/i }).first();
      if (await premierLeagueLink.count() > 0) {
        await premierLeagueLink.click({ timeout: 10000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
        await acceptUniConsent(page);
        await dismissOverlays(page);
        console.log('✅ Successfully navigated to Premier League');
      } else {
        // Fallback: direct navigation
        await page.goto('https://www.teamtalk.com/premier-league', { waitUntil: 'domcontentloaded' });
        await acceptUniConsent(page);
        await dismissOverlays(page);
        console.log('✅ Navigated to Premier League via direct URL');
      }
    } catch (error) {
      console.log('❌ Could not navigate to Premier League, trying direct URL...');
      console.log('   📋 Steps to recreate:');
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log('      2. Try to navigate to the Premier League section');
      console.log('      3. Expected: Premier League should load successfully');
      console.log('      4. Actual: Navigation failed, trying direct URL');
      await page.goto('https://www.teamtalk.com/premier-league', { waitUntil: 'domcontentloaded' });
      await acceptUniConsent(page);
      await dismissOverlays(page);
    }
    
    // Test ps-tag elements on premier league page
    const premierLeagueBrokenLinks = await validatePsTags(page, request, 'Premier League');
    premierLeagueBrokenLinks.forEach(link => {
      allBrokenLinks.push({ section: 'Premier League', ...link });
    });
    
    // Step 5: Navigate to Teams section
    console.log('\n⚽ Navigating to Teams section...');
    try {
      // Try to find and click teams link
      const teamsLink = page.getByRole('link', { name: /teams/i }).first();
      if (await teamsLink.count() > 0) {
        await teamsLink.click({ timeout: 10000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
        await acceptUniConsent(page);
        await dismissOverlays(page);
        console.log('✅ Successfully navigated to Teams section');
      } else {
        // Fallback: direct navigation
        await page.goto('https://www.teamtalk.com/team/', { waitUntil: 'domcontentloaded' });
        await acceptUniConsent(page);
        await dismissOverlays(page);
        console.log('✅ Navigated to Teams section via direct URL');
      }
    } catch (error) {
      console.log('❌ Could not navigate to Teams section, trying direct URL...');
      console.log('   📋 Steps to recreate:');
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log('      2. Try to navigate to the Teams section');
      console.log('      3. Expected: Teams section should load successfully');
      console.log('      4. Actual: Navigation failed, trying direct URL');
      await page.goto('https://www.teamtalk.com/team/', { waitUntil: 'domcontentloaded' });
      await acceptUniConsent(page);
      await dismissOverlays(page);
    }
    
    // Test ps-tag elements on teams page
    const teamsPsTagBrokenLinks = await validatePsTags(page, request, 'Teams Section (ps-tags)');
    teamsPsTagBrokenLinks.forEach(link => {
      allBrokenLinks.push({ section: 'Teams Section (ps-tags)', ...link });
    });
    
    // Test w-6 h-6 elements in teams section
    const teamsW6H6BrokenLinks = await validateTeamsSection(page, request);
    teamsW6H6BrokenLinks.forEach(link => {
      allBrokenLinks.push(link);
    });
    
    // Final Report
    console.log('\n📊 FINAL TEST REPORT');
    console.log('='.repeat(50));
    
    if (allBrokenLinks.length === 0) {
      console.log('✅ SUCCESS: No broken ps-tag links found across all sections!');
      console.log('All ps-tag elements are working correctly.');
    } else {
      console.log(`❌ FAILURE: Found ${allBrokenLinks.length} broken ps-tag links:`);
      console.log('');
      
      // Group by section
      const bySection = allBrokenLinks.reduce((acc, link) => {
        if (!acc[link.section]) acc[link.section] = [];
        acc[link.section].push(link);
        return acc;
      }, {} as Record<string, typeof allBrokenLinks>);
      
      Object.entries(bySection).forEach(([section, links]) => {
        console.log(`\n🔴 ${section} (${links.length} broken links):`);
        links.forEach(link => {
          console.log(`  ❌ [${link.status}] ${link.url}`);
          console.log(`     Element: "${link.element}"`);
        });
      });
      
      // Fail the test with detailed information
      const failureMessage = `Found ${allBrokenLinks.length} broken ps-tag links:\n` +
        allBrokenLinks.map(link => 
          `${link.section}: [${link.status}] ${link.url} (Element: "${link.element}")`
        ).join('\n');
      
      throw new Error(failureMessage);
    }
  });
});
