import { test, expect } from '@playwright/test';

// Configure test to run in headed mode during development
if (!process.env.CI) {
  test.use({
    launchOptions: {
      headless: false,
      slowMo: 100
    }
  });
}

test.describe('TeamTalk Website Navigation', () => {
  test('should navigate through key pages without errors', async ({ page }) => {
    const navigationSteps = [
      { name: 'Homepage', action: async () => await page.goto('https://www.teamtalk.com/') },
      { name: 'Accept Cookies', action: async () => await page.getByRole('button', { name: 'Accept & Continue' }).click() },
      { name: 'Transfer News', action: async () => await page.getByRole('link', { name: 'Transfer News' }).click() },
      { name: 'Page 2', action: async () => await page.getByRole('link', { name: '2', exact: true }).click() },
      { name: 'Paper Talk', action: async () => await page.getByRole('link', { name: 'Paper Talk' }).click() },
      { name: 'Paper Talk Page 2', action: async () => await page.locator('a').filter({ hasText: /^2$/ }).click() },
      { name: 'Premier League', action: async () => await page.getByRole('link', { name: 'Premier League', exact: true }).click() }
    ];

    // Team navigation helper
    const navigateTeam = async (teamName: string) => {
      await page.getByRole('button', { name: 'Teams' }).click();
      await page.locator(`#ps-league-panel-container`).getByRole('link', { name: teamName, exact: true }).click();
      
      // Navigate through team sections
      const sections = ['News', 'Fixtures', 'Results', 'Squad'];
      for (const section of sections) {
        try {
          await page.getByRole('link', { name: section, exact: true }).click();
          await page.waitForLoadState('networkidle');
          
          // Check for error pages
          const isErrorPage = await page.evaluate(() => {
            return document.body.textContent?.includes('404') || 
                   document.body.textContent?.includes('Error') ||
                   document.title.includes('404');
          });
          
          if (isErrorPage) {
            console.error(`❌ Error found on ${teamName} ${section} page`);
          } else {
            console.log(`✅ Successfully loaded ${teamName} ${section} page`);
          }
          
          // Small delay between navigations
          await page.waitForTimeout(1000);
          
        } catch (error) {
          console.error(`⚠️ Failed to navigate to ${teamName} ${section}:`, error);
        }
      }
      
      // Click on team stats if available
      try {
        await page.getByTitle(`${teamName} Stats`).first().click();
        console.log(`✅ Successfully loaded ${teamName} Stats`);
      } catch {
        console.warn(`ℹ️ Could not find ${teamName} Stats link`);
      }
    };

    // Execute navigation steps
    for (const step of navigationSteps) {
      try {
        await step.action();
        await page.waitForLoadState('networkidle');
        console.log(`✅ Success: ${step.name}`);
      } catch (error) {
        console.error(`❌ Failed at step "${step.name}":`, error);
      }
      await page.waitForTimeout(1000);
    }

    // Navigate through teams
    const teams = ['Arsenal', 'Chelsea', 'Leeds', 'Manchester United', 'Wolves', 'Aston Villa'];
    for (const team of teams) {
      try {
        await navigateTeam(team);
        // Return to Premier League between teams
        await page.getByRole('link', { name: 'Premier League', exact: true }).click();
      } catch (error) {
        console.error(`❌ Error processing team ${team}:`, error);
      }
    }
  });
});
