import { test, expect, Page } from '@playwright/test';

// Utility function to dismiss popups
async function dismissPopups(page: Page) {
  const popupSelectors = [
    'button:has-text("Accept & Continue")',
    'button:has-text("Accept All")',
    'button:has-text("I Accept")',
    'button[title="Close"]',
    '.close',
    '.close-btn',
    '.modal-close',
    '.overlay-close',
    'button:visible',
    '.close:visible'
  ];

  for (const selector of popupSelectors) {
    try {
      const elements = await page.$$(selector);
      for (const element of elements) {
        try {
          await element.click({ timeout: 2000 });
          console.log(`Clicked popup with selector: ${selector}`);
          await page.waitForTimeout(500);
        } catch (e) { /* Ignore errors */ }
      }
    } catch (e) { /* Ignore errors */ }
  }
}

// Function to check for broken images
async function checkForBrokenImages(page: Page) {
  const images = await page.$$('img');
  const brokenImages = [];
  
  for (const img of images) {
    try {
      const isVisible = await img.isVisible();
      if (!isVisible) continue;
      
      const naturalWidth = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
      if (naturalWidth === 0) {
        const src = await img.getAttribute('src');
        brokenImages.push(src);
      }
    } catch (e) { /* Ignore errors */ }
  }
  
  if (brokenImages.length > 0) {
    throw new Error(`Found ${brokenImages.length} broken images`);
  }
}

test.describe('TeamTalk Team Pages Test', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    page = await context.newPage();
    await page.goto('https://www.teamtalk.com', { waitUntil: 'domcontentloaded' });
    await dismissPopups(page);
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should test team pages navigation and content', async () => {
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Find the Team Pages section by text content
    const teamPagesSection = await page.locator('h2', { hasText: 'Team Pages' }).first();
    await expect(teamPagesSection).toBeVisible();
    
    // Scroll to Team Pages section
    await teamPagesSection.scrollIntoViewIfNeeded();
    
    // Get all team links in the section
    const teamLinks = await page.locator('h2:has-text("Team Pages") + div a[href*="/team/"]').all();
    const teamsToTest = teamLinks.slice(0, 20); // Test first 20 teams (all teams)
    console.log(`Found ${teamsToTest.length} teams to test`);
    
    for (let i = 0; i < teamsToTest.length; i++) {
      // Re-query to avoid stale elements
      const currentLinks = await page.locator('h2:has-text("Team Pages") + div a[href*="/team/"]').all();
      if (i >= currentLinks.length) break;
      
      const teamLink = currentLinks[i];
      const teamName = await teamLink.textContent();
      console.log(`\n--- Testing team: ${teamName} ---`);
      
      // Navigate to team page
      await teamLink.click({ timeout: 10000 });
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);
      
      // Verify page loaded
      await expect(page.locator('h1')).toBeVisible();
      console.log(`✅ Successfully loaded ${teamName} page`);
      
      // Check for broken images
      try {
        await checkForBrokenImages(page);
        console.log(`✅ No broken images found on ${teamName} page`);
      } catch (error) {
        console.error(`❌ Error checking images on ${teamName} page:`, error.message);
      }
      
      // Navigate back to homepage
      const homeLink = page.locator('a:has-text("Home")').first();
      await homeLink.click();
      await page.waitForLoadState('networkidle');
      
      // Wait for Team Pages section again
      await page.waitForLoadState('networkidle');
      const teamPagesSectionAgain = await page.locator('h2', { hasText: 'Team Pages' }).first();
      await teamPagesSectionAgain.waitFor({ state: 'visible', timeout: 10000 });
    }
  });
});
