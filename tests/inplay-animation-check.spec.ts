import { test, expect } from '@playwright/test';

test.setTimeout(180000);

test('PlanetSportBet – Animation Check', async ({ page }) => {
  await page.goto('https://planetsportbet.com');

  // Dismiss cookie popup
  try {
    await page.getByRole('button', { name: /Allow all|Accept|Agree|Yes/i }).click({ timeout: 5000 });
  } catch {}

  // Dismiss "Sign Up" popup
  try {
    await page.locator('.css-7o8a95-SvgElement-CloseButton').click({ timeout: 5000 });
  } catch {}

  // Find all "In Play" links
  const inPlayLinks = await page.getByRole('link', { name: /In Play/i }).all();
  let failedEvents: string[] = [];

  for (let i = 0; i < inPlayLinks.length; i++) {
    // Re-query each time to avoid stale element handles
    const links = await page.getByRole('link', { name: /In Play/i }).all();
    const link = links[i];
    const title = await link.innerText();

    try {
      await link.click();
      await page.waitForTimeout(2000); // Wait for navigation/animation

      const animation = page.locator('animate-svg');
      const hasAnimation = await animation.count() > 0;

      if (hasAnimation) {
        console.log(`✅ PASS: ${title} has animate-svg`);
      } else {
        failedEvents.push(title);
        console.log(`❌ FAIL: ${title} does NOT have animate-svg`);
      }
    } catch (e) {
      failedEvents.push(title);
      console.log(`❌ FAIL: Could not check ${title}`);
    }

    // Optionally, go back if needed
    await page.goto('https://planetsportbet.com');
  }

  // Summary
  console.log('\n--- Events without animate-svg ---');
  failedEvents.forEach(ev => console.log(ev));
});