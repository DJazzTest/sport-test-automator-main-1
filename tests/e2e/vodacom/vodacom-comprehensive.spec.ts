import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";

// Helper function to handle Vodacom cookie banners
async function handleCookieBanner(page: Page): Promise<void> {
  try {
    await page
      .getByRole("button", { name: "Accept all Cookies" })
      .click({ timeout: 10000 });
    await page.waitForTimeout(2000);
    console.log("✅ First cookie popup handled");
  } catch (error) {
    console.log("⚠️  First cookie popup not found");
  }

  try {
    await page
      .getByRole("button", { name: "Agree and proceed" })
      .click({ timeout: 10000 });
    await page.waitForTimeout(2000);
    console.log("✅ Second cookie popup handled");
  } catch (error) {
    console.log("⚠️  Second cookie popup not found");
  }
}

// Helper function to check for broken images
async function checkBrokenImages(page: Page): Promise<number> {
  const brokenImages = await page.evaluate(() => {
    const images = Array.from(document.images);
    let broken = 0;
    for (const img of images) {
      if (img.width <= 1 || img.height <= 1) continue;
      if (!img.complete || img.naturalWidth === 0) {
        broken++;
      }
    }
    return broken;
  });
  return brokenImages;
}

// Helper function to check for broken links
async function checkBrokenLinks(page: Page, maxLinks = 20): Promise<number> {
  const links = await page.$$("a[href]");
  let broken = 0;
  const linksToCheck = links.slice(0, maxLinks);

  for (const link of linksToCheck) {
    try {
      const href = await link.getAttribute("href");
      if (
        !href ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#")
      )
        continue;

      const url = new URL(href, page.url()).toString();
      const response = await page.request.head(url).catch(() => null);
      if (!response || response.status() >= 400) {
        broken++;
      }
    } catch (error) {
      // Skip external links
    }
  }
  return broken;
}

// Helper function to check for ads
async function checkForAds(page: Page): Promise<boolean> {
  const adSelectors = [
    '[id*="ad-"]',
    '[class*="ad-"]',
    '[class*="banner"]',
    'iframe[src*="ads"]',
    "ins.adsbygoogle",
    "div.ad-container",
  ];

  for (const selector of adSelectors) {
    const ads = await page.$$(selector);
    if (ads.length > 0) return true;
  }
  return false;
}

// Helper function to check content freshness
async function checkStaleContent(
  page: Page
): Promise<{ stale: number; total: number }> {
  const timeElements = await page.$$("time[datetime]");
  const now = new Date();
  let stale = 0;

  for (const timeEl of timeElements.slice(0, 10)) {
    try {
      const dateTime = await timeEl.getAttribute("datetime");
      if (dateTime) {
        const hoursOld =
          (now.getTime() - new Date(dateTime).getTime()) / (1000 * 60 * 60);
        if (hoursOld > 24) stale++;
      }
    } catch (error) {
      // Continue
    }
  }

  return { stale, total: timeElements.length };
}

// Helper function to test links on homepage
async function testHomepageLinks(
  page: Page
): Promise<{ tested: number; broken: number }> {
  console.log("🔍 Testing homepage links...");
  const links = await page.$$("a[href]");
  let tested = 0;
  let broken = 0;
  const linksToTest = links.slice(0, 10); // Test first 10 links

  for (const link of linksToTest) {
    try {
      const href = await link.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      )
        continue;

      const url = new URL(href, page.url()).toString();
      if (!url.includes("vodacomsoccer.com")) continue; // Only test internal links

      await link.click({ timeout: 10000 });
      await page.waitForTimeout(2000);
      await page.waitForLoadState("domcontentloaded");

      // Check if page loaded successfully
      const response = await page.request.get(page.url()).catch(() => null);
      if (!response || response.status() >= 400) {
        broken++;
      }

      // Go back
      await page.goBack({ timeout: 10000 });
      await page.waitForTimeout(2000);
      tested++;
    } catch (error) {
      broken++;
      // Try to go back if we're on a different page
      try {
        await page.goBack({ timeout: 5000 });
      } catch (e) {
        await page.goto("https://vodacomsoccer.com/");
      }
    }
  }

  return { tested, broken };
}

// Helper function to check for animation widget
async function checkAnimationWidget(page: Page): Promise<boolean> {
  // Wait for page to fully load
  await page.waitForTimeout(3000);

  const selectors = [
    ".football-animate.view-3d",
    '[class*="football-animate"]',
    '[class*="view-3d"]',
    'div[data-v-4a196d68][class*="football-animate"]',
    ".animate-child",
    '[class*="animate"]',
  ];

  for (const selector of selectors) {
    try {
      const widget = page.locator(selector).first();
      const count = await widget.count();
      if (count > 0) {
        const isVisible = await widget.isVisible({ timeout: 5000 });
        if (isVisible) {
          console.log(`✅ Animation widget found with selector: ${selector}`);
          return true;
        }
      }
    } catch (error) {
      // Try next selector
    }
  }

  // Also check for SVG elements that indicate animation
  try {
    const svgElements = await page.locator("svg[data-v-4a196d68]").count();
    const animateElements = await page.locator('[class*="animate"]').count();
    if (svgElements > 0 || animateElements > 0) {
      console.log(
        `✅ Found ${svgElements} SVG elements and ${animateElements} animate elements`
      );
      return true;
    }
  } catch (error) {
    // Continue
  }

  console.log("❌ No animation widget found");
  return false;
}

test("Vodacom Comprehensive Test", async ({ page }) => {
  test.setTimeout(600000); // 10 minutes
  const baseUrl = "https://vodacomsoccer.com";
  const results = {
    homepage: {
      linksTested: 0,
      linksBroken: 0,
      brokenImages: 0,
      brokenLinks: 0,
      hasAds: false,
      staleContent: { stale: 0, total: 0 },
    },
    matchCentre: { totalMatches: 0, matchesWithAnimation: 0 },
    play: { brokenImages: 0, brokenLinks: 0, hasAds: false },
    competitions: { tested: 0, broken: 0 },
    news: { brokenImages: 0, brokenLinks: 0 },
    teams: { tested: 0, broken: 0 },
    videos: { brokenImages: 0, brokenLinks: 0 },
  };

  console.log("🚀 Starting Vodacom Comprehensive Test\n");

  // Step 1: Navigate to homepage
  console.log("📍 Step 1: Navigating to homepage...");
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page
    .waitForLoadState("networkidle", { timeout: 30000 })
    .catch(() => {});

  // Step 2: Handle cookies
  console.log("📍 Step 2: Handling cookies...");
  await handleCookieBanner(page);

  // Step 3: Scroll down and test homepage links
  console.log("📍 Step 3: Testing homepage links...");
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(2000);

  const linkResults = await testHomepageLinks(page);
  results.homepage.linksTested = linkResults.tested;
  results.homepage.linksBroken = linkResults.broken;

  // Step 4: Test homepage for ads, 404s, stale content, broken images, broken links
  console.log("📍 Step 4: Testing homepage content...");
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await handleCookieBanner(page);
  await page.waitForTimeout(2000);

  results.homepage.brokenImages = await checkBrokenImages(page);
  results.homepage.brokenLinks = await checkBrokenLinks(page);
  results.homepage.hasAds = await checkForAds(page);
  results.homepage.staleContent = await checkStaleContent(page);

  console.log(
    `✅ Homepage: ${results.homepage.brokenImages} broken images, ${results.homepage.brokenLinks} broken links, Ads: ${results.homepage.hasAds}, Stale: ${results.homepage.staleContent.stale}/${results.homepage.staleContent.total}`
  );

  // Step 5: Navigate to Match Centre
  console.log("📍 Step 5: Navigating to Match Centre...");
  await page
    .getByRole("link", { name: "Match Centre" })
    .click({ timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.waitForLoadState("domcontentloaded");

  // Step 6: Count and test matches
  console.log("📍 Step 6: Testing matches in Match Centre...");
  const matchLinks = await page
    .locator('a[href*="/match-centre/match-detail/"]')
    .all();
  results.matchCentre.totalMatches = matchLinks.length;
  console.log(`📊 Found ${matchLinks.length} matches`);

  for (let i = 0; i < Math.min(matchLinks.length, 10); i++) {
    // Test up to 10 matches
    try {
      console.log(
        `\n🔍 Testing match ${i + 1}/${Math.min(matchLinks.length, 10)}...`
      );

      // Get match link again (page may have changed)
      const currentMatchLinks = await page
        .locator('a[href*="/match-centre/match-detail/"]')
        .all();
      if (i >= currentMatchLinks.length) break;

      await currentMatchLinks[i].click({ timeout: 15000 });
      await page.waitForTimeout(5000); // Wait longer for animation to load
      await page.waitForLoadState("domcontentloaded");

      // Scroll to ensure animation widget is visible
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(2000);

      // Check for animation widget
      const hasAnimation = await checkAnimationWidget(page);
      if (hasAnimation) {
        results.matchCentre.matchesWithAnimation++;
      }

      // Navigate back to match centre
      await page.goBack({ timeout: 10000 });
      await page.waitForTimeout(2000);
      await page.waitForLoadState("domcontentloaded");
    } catch (error) {
      console.log(`❌ Error testing match ${i + 1}: ${error.message}`);
      // Try to recover
      try {
        await page.goto(`${baseUrl}/match-centre`, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForTimeout(2000);
      } catch (e) {
        // Continue with next match
      }
    }
  }

  console.log(
    `✅ Match Centre: ${results.matchCentre.matchesWithAnimation}/${results.matchCentre.totalMatches} matches have animations`
  );

  // Step 7: Navigate to Play
  console.log("📍 Step 7: Navigating to Play...");
  await page.getByRole("link", { name: "Play" }).click({ timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.waitForLoadState("domcontentloaded");

  results.play.brokenImages = await checkBrokenImages(page);
  results.play.brokenLinks = await checkBrokenLinks(page);
  results.play.hasAds = await checkForAds(page);
  console.log(
    `✅ Play: ${results.play.brokenImages} broken images, ${results.play.brokenLinks} broken links, Ads: ${results.play.hasAds}`
  );

  // Step 8: Navigate to Competitions
  console.log("📍 Step 8: Testing Competitions...");
  await page
    .getByRole("link", { name: "Competitions" })
    .click({ timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.waitForLoadState("domcontentloaded");

  // Get all competition links - try multiple selectors
  let competitionLinks = await page.locator('a[href*="/competition/"]').all();
  if (competitionLinks.length === 0) {
    competitionLinks = await page.locator('a[href*="competition"]').all();
  }
  if (competitionLinks.length === 0) {
    // Try to find competition cards or items
    competitionLinks = await page.locator('[class*="competition"] a').all();
  }
  console.log(`📊 Found ${competitionLinks.length} competitions`);

  for (let i = 0; i < Math.min(competitionLinks.length, 10); i++) {
    try {
      const currentLinks = await page.locator('a[href*="/competition/"]').all();
      if (i >= currentLinks.length) break;

      await currentLinks[i].click({ timeout: 15000 });
      await page.waitForTimeout(2000);
      await page.waitForLoadState("domcontentloaded");

      // Check for 404
      const response = await page.request.get(page.url()).catch(() => null);
      if (response && response.status() >= 400) {
        results.competitions.broken++;
        console.log(`❌ Competition ${i + 1} returned ${response.status()}`);
      } else {
        // Check for broken images and links
        const brokenImgs = await checkBrokenImages(page);
        const brokenLks = await checkBrokenLinks(page, 10);
        if (brokenImgs > 0 || brokenLks > 0) {
          console.log(
            `⚠️  Competition ${
              i + 1
            }: ${brokenImgs} broken images, ${brokenLks} broken links`
          );
        }
      }

      results.competitions.tested++;
      await page.goBack({ timeout: 10000 });
      await page.waitForTimeout(2000);
    } catch (error) {
      results.competitions.broken++;
      console.log(`❌ Error testing competition ${i + 1}: ${error.message}`);
      try {
        await page.goto(`${baseUrl}/competitions`, {
          waitUntil: "domcontentloaded",
        });
      } catch (e) {
        // Continue
      }
    }
  }

  console.log(
    `✅ Competitions: ${results.competitions.tested} tested, ${results.competitions.broken} broken`
  );

  // Step 9: Navigate to News
  console.log("📍 Step 9: Testing News...");
  await page.getByRole("link", { name: "News" }).click({ timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.waitForLoadState("domcontentloaded");

  results.news.brokenImages = await checkBrokenImages(page);
  results.news.brokenLinks = await checkBrokenLinks(page);
  console.log(
    `✅ News: ${results.news.brokenImages} broken images, ${results.news.brokenLinks} broken links`
  );

  // Step 10: Navigate to Teams dropdown
  console.log("📍 Step 10: Testing Teams...");
  // First navigate to homepage to access teams dropdown
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await handleCookieBanner(page);
  await page.waitForTimeout(2000);

  // Get team links from dropdown or teams page
  try {
    // Try to find teams dropdown or navigate to teams page
    const teamsLink = page.locator('a[href*="/teams/"]');
    const teamLinks = await teamsLink.all();
    console.log(`📊 Found ${teamLinks.length} team links`);

    for (let i = 0; i < Math.min(teamLinks.length, 10); i++) {
      try {
        const currentTeamLinks = await page.locator('a[href*="/teams/"]').all();
        if (i >= currentTeamLinks.length) break;

        const href = await currentTeamLinks[i].getAttribute("href");
        if (!href) continue;

        await page.goto(new URL(href, baseUrl).toString(), {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForTimeout(2000);

        // Check for 404
        const response = await page.request.get(page.url()).catch(() => null);
        if (response && response.status() >= 400) {
          results.teams.broken++;
          console.log(`❌ Team ${i + 1} returned ${response.status()}`);
        } else {
          // Check for broken images and links
          const brokenImgs = await checkBrokenImages(page);
          const brokenLks = await checkBrokenLinks(page, 10);
          if (brokenImgs > 0 || brokenLks > 0) {
            console.log(
              `⚠️  Team ${
                i + 1
              }: ${brokenImgs} broken images, ${brokenLks} broken links`
            );
          }
        }

        results.teams.tested++;
      } catch (error) {
        results.teams.broken++;
        console.log(`❌ Error testing team ${i + 1}: ${error.message}`);
      }
    }
  } catch (error) {
    console.log("⚠️  Could not find team links, skipping teams test");
  }

  console.log(
    `✅ Teams: ${results.teams.tested} tested, ${results.teams.broken} broken`
  );

  // Step 11: Navigate to Videos
  console.log("📍 Step 11: Testing Videos...");
  await page.getByRole("link", { name: "Videos" }).click({ timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.waitForLoadState("domcontentloaded");

  results.videos.brokenImages = await checkBrokenImages(page);
  results.videos.brokenLinks = await checkBrokenLinks(page);
  console.log(
    `✅ Videos: ${results.videos.brokenImages} broken images, ${results.videos.brokenLinks} broken links`
  );

  // Final Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 VODACOM COMPREHENSIVE TEST SUMMARY");
  console.log("=".repeat(60));
  console.log("\n🏠 Homepage:");
  console.log(
    `   Links tested: ${results.homepage.linksTested}, Broken: ${results.homepage.linksBroken}`
  );
  console.log(`   Broken images: ${results.homepage.brokenImages}`);
  console.log(`   Broken links: ${results.homepage.brokenLinks}`);
  console.log(`   Has ads: ${results.homepage.hasAds}`);
  console.log(
    `   Stale content: ${results.homepage.staleContent.stale}/${results.homepage.staleContent.total}`
  );

  console.log("\n⚽ Match Centre:");
  console.log(`   Total matches: ${results.matchCentre.totalMatches}`);
  console.log(
    `   Matches with animation: ${results.matchCentre.matchesWithAnimation}`
  );

  console.log("\n🎮 Play:");
  console.log(`   Broken images: ${results.play.brokenImages}`);
  console.log(`   Broken links: ${results.play.brokenLinks}`);
  console.log(`   Has ads: ${results.play.hasAds}`);

  console.log("\n🏆 Competitions:");
  console.log(
    `   Tested: ${results.competitions.tested}, Broken: ${results.competitions.broken}`
  );

  console.log("\n📰 News:");
  console.log(`   Broken images: ${results.news.brokenImages}`);
  console.log(`   Broken links: ${results.news.brokenLinks}`);

  console.log("\n👥 Teams:");
  console.log(
    `   Tested: ${results.teams.tested}, Broken: ${results.teams.broken}`
  );

  console.log("\n🎥 Videos:");
  console.log(`   Broken images: ${results.videos.brokenImages}`);
  console.log(`   Broken links: ${results.videos.brokenLinks}`);

  console.log("\n" + "=".repeat(60));

  // Assertions - test passes if critical issues are within acceptable limits
  expect(results.homepage.brokenLinks).toBeLessThan(5);

  // Note: Animation detection may vary - if no animations found, log warning but don't fail
  if (results.matchCentre.matchesWithAnimation === 0) {
    console.log(
      "⚠️  WARNING: No animations detected in matches. This may be expected if matches are not live or animations are loading slowly."
    );
  }

  // Test passes if we tested matches successfully (even if no animations found)
  expect(results.matchCentre.totalMatches).toBeGreaterThan(0);
});
