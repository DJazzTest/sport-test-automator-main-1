import { test, expect } from "@playwright/test";
import { recordInplayAnimationMetrics, SITE_LABELS } from "../../lib/grafana-metrics";

test("PriceDup – In Play events animation check (All Events)", async ({
  page,
}) => {
  console.log(
    "🚀 Starting comprehensive PriceDup In Play animation detection test..."
  );

  // Navigate to PriceDup
  const baseUrl = "https://pricedup.bet";
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });

  // Handle cookie consent with multiple selectors for better reliability
  try {
    const cookieSelectors = [
      // Try exact text match first
      'button:has-text("Allow all")',
      // Try the TeamTalk-style button if it exists
      'button[style*="background-color: rgb(46, 233, 169)"]',
      "button.bg-gray-300",
      // Other common patterns
      'button:has-text("Accept all")',
      'button:has-text("Accept")',
      '[id*="accept"]',
      '[class*="accept"][role="button"]',
      'button:has-text("I Accept")',
      'button:has-text("Agree")',
      'button:has-text("Got it")',
      ".cookie-banner button",
      "#cookie-banner button",
      '[data-testid="cookie-banner-accept"]',
    ];

    let cookieHandled = false;
    for (const selector of cookieSelectors) {
      try {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 2000 })) {
          await button.click();
          console.log(`✅ Cookie consent handled with selector: ${selector}`);
          cookieHandled = true;
          break;
        }
      } catch (error) {
        console.log(`Selector ${selector} not found, trying next...`);
      }
    }

    if (!cookieHandled) {
      console.log("ℹ️  No cookie consent popup found or could not be handled");
    }
  } catch (error) {
    console.error("❌ Error handling cookie consent:", error.message);
  }

  await page.waitForTimeout(2000);

  // Click on In Play link
  console.log("📍 Navigating to In Play section...");
  await page.locator('[data-test="inplay-link"]').click();
  await page.waitForTimeout(3000);

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

      // Check for PriceDup animation widget using improved detection logic
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
  console.log("🎯 PRICEDUP IN PLAY COMPREHENSIVE ANIMATION TEST SUMMARY");
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
    console.log("🌟 EXCELLENT: PriceDup has strong animation coverage");
  } else if (successRate >= 60) {
    console.log("👍 GOOD: PriceDup has decent animation coverage");
  } else if (successRate >= 40) {
    console.log("⚠️  MODERATE: PriceDup has limited animation coverage");
  } else {
    console.log("🚨 POOR: PriceDup has minimal animation coverage");
  }

  console.log(
    `🎖️  PriceDup Animation Coverage: ${passCount}/${eventCount} events (${successRate.toFixed(
      1
    )}%)`
  );

  recordInplayAnimationMetrics(
    test.info(),
    SITE_LABELS.pricedup,
    eventCount,
    passCount,
    failCount
  );
});
