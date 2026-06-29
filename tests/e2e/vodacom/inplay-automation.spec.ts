import { test, expect } from "@playwright/test";
import { recordInplayAnimationMetrics, SITE_LABELS } from "../../lib/grafana-metrics";

// NOTE: This test is deprecated. Please use vodacom-comprehensive.spec.ts instead
// which tests Match Centre tabs, home page, and competition pages properly.

test.skip("Vodacom – In Play events animation check (All Events)", async ({
  page,
}) => {
  console.log(
    "🚀 Starting comprehensive Vodacom In Play animation detection test..."
  );

  // Navigate to Vodacom
  const baseUrl = "https://vodacomsoccer.com";
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  // Handle cookie consent - Vodacom has TWO cookie popups
  // First popup: "Accept all Cookies" button
  // Second popup: "Agree and proceed" button
  await page.waitForTimeout(3000); // Wait for page to load and cookie banners to appear

  try {
    // First cookie popup: "Accept all Cookies"
    try {
      const acceptAllButton = page.getByRole("button", {
        name: "Accept all Cookies",
      });
      if (await acceptAllButton.isVisible({ timeout: 5000 })) {
        await acceptAllButton.scrollIntoViewIfNeeded();
        await acceptAllButton.click();
        console.log('✅ First cookie popup handled: "Accept all Cookies"');
        await page.waitForTimeout(2000); // Wait for second popup to appear
      }
    } catch (error) {
      console.log("⚠️  First cookie popup not found or already handled");
    }

    // Second cookie popup: "Agree and proceed"
    try {
      const agreeButton = page.getByRole("button", {
        name: "Agree and proceed",
      });
      if (await agreeButton.isVisible({ timeout: 5000 })) {
        await agreeButton.scrollIntoViewIfNeeded();
        await agreeButton.click();
        console.log('✅ Second cookie popup handled: "Agree and proceed"');
        await page.waitForTimeout(2000); // Wait for popup to disappear
      }
    } catch (error) {
      console.log("⚠️  Second cookie popup not found or already handled");
    }

    // Fallback: Try other common cookie selectors if the above didn't work
    const fallbackSelectors = [
      "button#onetrust-accept-btn-handler",
      'button:has-text("Accept all")',
      'button:has-text("Accept")',
      'button:has-text("Agree")',
    ];

    for (const selector of fallbackSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 })) {
          await button.scrollIntoViewIfNeeded();
          await button.click();
          console.log(`✅ Cookie handled with fallback selector: ${selector}`);
          await page.waitForTimeout(1000);
        }
      } catch (error) {
        // Continue to next selector
      }
    }
  } catch (error) {
    console.error("❌ Error handling cookie consent:", error.message);
  }

  await page.waitForTimeout(2000);

  // Click on In Play link - try multiple selectors
  console.log("📍 Navigating to In Play section...");

  let inPlayClicked = false;
  const inPlaySelectors = [
    '[data-test="inplay-link"]',
    'a[href*="inplay"]',
    'a:has-text("In Play")',
    'a:has-text("in play")',
    'a:has-text("Live")',
    'nav a:has-text("In Play")',
  ];

  for (const selector of inPlaySelectors) {
    try {
      const link = page.locator(selector).first();
      if (await link.isVisible({ timeout: 3000 })) {
        await link.click();
        console.log(`✅ Clicked In Play link using selector: ${selector}`);
        inPlayClicked = true;
        await page.waitForTimeout(3000);
        break;
      }
    } catch (error) {
      console.log(`Selector ${selector} not found, trying next...`);
    }
  }

  if (!inPlayClicked) {
    // Try navigating directly to inplay URL
    console.log("⚠️  In Play link not found, trying direct navigation...");
    await page.goto(`${baseUrl}/inplay`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
  }

  console.log("✅ Successfully navigated to In Play section");

  // Find all event links (events typically contain "vs" or "v ")
  const eventLinks = page.getByRole("link").filter({ hasText: /vs|v\s/ });
  const eventCount = await eventLinks.count();

  console.log(`📊 Found ${eventCount} events in In Play section`);

  if (eventCount === 0) {
    console.log("❌ No events found in In Play section");
    return;
  }

  let passCount = 0;
  let failCount = 0;
  const failedEvents: Array<{
    title: string;
    reason: string;
    eventNumber: number;
    sport: string;
  }> = [];
  const passedEvents: Array<{
    title: string;
    widgetType: string;
    eventNumber: number;
  }> = [];

  // Test each event for animations
  for (let i = 0; i < eventCount; i++) {
    console.log(`\n🔍 Testing event ${i + 1}/${eventCount}...`);

    // Get event title
    const eventLink = eventLinks.nth(i);
    const eventTitle = (await eventLink.textContent()) || `Event ${i + 1}`;
    console.log(`📋 Event: ${eventTitle}`);

    // Click on the event
    try {
      await Promise.all([
        page.waitForURL(/\/event\//, { timeout: 10000 }),
        eventLink.click(),
      ]);

      await page.waitForTimeout(2000);

      // Check for Vodacom animation widget using improved detection logic
      let hasAnimation = false;
      let animationDetails = "";
      let widgetType = "";

      try {
        // Method 1: Check for animated_widget (PlanetSportBet style)
        const animatedWidget = page.locator(".animated_widget");
        const animatedWidgetVisible = await animatedWidget.isVisible({
          timeout: 3000,
        });

        if (animatedWidgetVisible) {
          hasAnimation = true;
          widgetType = "Animated Widget";
          animationDetails = "Animated widget element detected";
          console.log(`✅ Animation widget found for: ${eventTitle}`);
        } else {
          // Method 2: Check for sport-specific widget iframes
          const sportWidgetIframe = page.locator('[id*="sport-widget"] iframe');
          const sportWidgetVisible = await sportWidgetIframe.isVisible({
            timeout: 2000,
          });

          if (sportWidgetVisible) {
            const widgetId =
              (await sportWidgetIframe.getAttribute("id")) || "unknown";
            widgetType = widgetId.includes("tennis")
              ? "Tennis"
              : widgetId.includes("football")
              ? "Football"
              : widgetId.includes("cricket")
              ? "Cricket"
              : "Sport";
            hasAnimation = true;
            animationDetails = `${widgetType} sport widget iframe detected`;
            console.log(
              `✅ ${widgetType} animation widget found for: ${eventTitle}`
            );
          } else {
            // Method 3: Check for any widget iframe as fallback
            const anyWidgetIframe = page.locator('[id*="widget"] iframe');
            const anyWidgetVisible = await anyWidgetIframe.isVisible({
              timeout: 2000,
            });

            if (anyWidgetVisible) {
              hasAnimation = true;
              widgetType = "Generic";
              animationDetails = "Generic widget iframe detected";
              console.log(
                `✅ Generic animation widget found for: ${eventTitle}`
              );
            } else {
              animationDetails =
                "No animation widget found - event lacks live animation features";
              console.log(`❌ FAIL: No animation widget for: ${eventTitle}`);
            }
          }
        }
      } catch (error) {
        animationDetails = `Animation detection error: ${error.message}`;
        console.log(
          `❌ Animation check failed for ${eventTitle}: ${error.message}`
        );
      }

      if (hasAnimation) {
        passCount++;
        passedEvents.push({
          title: eventTitle,
          widgetType: widgetType,
          eventNumber: i + 1,
        });
        console.log(
          `✅ PASS: Animation detected for "${eventTitle}" (${widgetType} widget)`
        );
      } else {
        failCount++;
        failedEvents.push({
          title: eventTitle,
          reason: animationDetails,
          eventNumber: i + 1,
          sport: eventTitle.includes("vs")
            ? eventTitle.toLowerCase().includes("tennis")
              ? "Tennis"
              : eventTitle.toLowerCase().includes("football")
              ? "Football"
              : eventTitle.toLowerCase().includes("cricket")
              ? "Cricket"
              : "Unknown"
            : "Unknown",
        });
        console.log(
          `❌ FAIL: No animation for "${eventTitle}" - ${animationDetails}`
        );
      }
    } catch (error) {
      failCount++;
      failedEvents.push({
        title: eventTitle,
        reason: `Navigation or testing error: ${error.message}`,
        eventNumber: i + 1,
        sport: "Unknown",
      });
      console.log(`❌ FAIL: Error testing "${eventTitle}": ${error.message}`);
    }

    // Navigate back to In Play
    try {
      await page.locator('[data-test="inplay-link"]').click();
      await page.waitForTimeout(1500);
    } catch (error) {
      console.log(`⚠️  Navigation back to In Play failed: ${error.message}`);
      // Fallback: go back to main In Play page
      await page.goto(`${baseUrl}/inplay`);
      await page.waitForTimeout(2000);
    }
  }

  // Final comprehensive summary report
  console.log(`\n${"=".repeat(70)}`);
  console.log("🎯 VODACOM IN PLAY COMPREHENSIVE ANIMATION TEST SUMMARY");
  console.log(`${"=".repeat(70)}`);
  console.log(`📊 Total Events Tested: ${eventCount}`);
  console.log(`✅ Events with Animation: ${passCount}`);
  if (passedEvents.length > 0) {
    console.log(`\n✅ PASSED EVENTS (WITH ANIMATIONS):`);
    passedEvents.forEach((event, index) => {
      console.log(`${index + 1}. "${event.title}"`);
      console.log(`   └─ Widget Type: ${event.widgetType}`);
    });
  }

  // Final assessment based on success rate
  const successRate = eventCount > 0 ? (passCount / eventCount) * 100 : 0;
  console.log("\n🏆 === FINAL ASSESSMENT ===");
  if (successRate >= 80) {
    console.log("🌟 EXCELLENT: Vodacom has strong animation coverage");
  } else if (successRate >= 60) {
    console.log("👍 GOOD: Vodacom has decent animation coverage");
  } else if (successRate >= 40) {
    console.log("⚠️  MODERATE: Vodacom has limited animation coverage");
  } else {
    console.log("🚨 POOR: Vodacom has minimal animation coverage");
  }

  console.log(
    `🎖️  Vodacom Animation Coverage: ${passCount}/${eventCount} events (${successRate.toFixed(
      1
    )}%)`
  );

  recordInplayAnimationMetrics(
    test.info(),
    SITE_LABELS.vodacom,
    eventCount,
    passCount,
    failCount
  );
});
