import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import { metric, recordGrafanaMetrics, SITE_LABELS } from "../../lib/grafana-metrics";

// Interfaces for test results
interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
  failures?: Array<{ url?: string; error: string }>;
}

interface PageTestResult {
  url: string;
  status: number;
  pageTitle: string;
  tests: {
    httpErrors: TestResult;
    staleContent: TestResult;
    brokenImages: TestResult;
    brokenLinks: TestResult;
    ads: TestResult;
  };
  error?: string;
}

// Test data
const PAGES = [
  { name: "Home", url: "https://www.teamtalk.com/" },
  { name: "Transfer News", url: "https://www.teamtalk.com/transfer-news" },
  { name: "Premier League", url: "https://www.teamtalk.com/english-premiership" },
];

// Helper function to handle cookie banner with robust checks
async function handleCookieBanner(page: Page): Promise<boolean> {
  const acceptSelectors = [
    'button:has-text("Accept All")',
    'button:has-text("Accept")',
    'button:has-text("Agree")',
    'button:has-text("Got it")',
    ".cookie-banner button",
    "#cookie-banner button",
    ".cookie-consent button",
    '[class*="cookie"] button',
    'button[onclick*="cookie"]',
    'button[onclick*="accept"]',
    "button:visible",
    'button[data-test*="cookie"]',
    'button[data-testid*="cookie"]',
  ];

  // First wait for any potential cookie banner to appear
  await page.waitForTimeout(2000);

  for (const selector of acceptSelectors) {
    try {
      const buttons = await page.$$(selector);
      for (const button of buttons) {
        if (await button.isVisible()) {
          const buttonText = (await button.textContent() || "").toLowerCase();
          if (
            buttonText.includes("accept") ||
            buttonText.includes("agree") ||
            buttonText.includes("got it") ||
            buttonText.includes("continue") ||
            selector.includes("cookie") ||
            selector.includes("accept")
          ) {
            console.log(`ℹ️  Found cookie banner with selector: ${selector}`);
            await button.click();
            await page.waitForTimeout(1000); // Wait for any animations

            // Verify banner is gone by checking if it's still visible
            try {
              await page.waitForTimeout(1000);
              const isStillVisible = await button.isVisible();
              if (!isStillVisible) {
                console.log("✅ Cookie banner dismissed");
                return true;
              }
              // If still visible, try one more time
              console.log(
                "⚠️  Cookie banner might still be visible after click, trying again..."
              );
              await button.click();
              await page.waitForTimeout(1000);
              const stillVisible = await button.isVisible();
              if (!stillVisible) {
                console.log("✅ Cookie banner dismissed on second attempt");
                return true;
              }
              console.log(
                "⚠️  Failed to dismiss cookie banner with second attempt"
              );
              return false;
            } catch (e) {
              console.log("⚠️  Error checking cookie banner visibility:", e);
              return false;
            }
          }
        }
      }
    } catch (error) {
      // Ignore and try next selector
    }
  }

  console.log("ℹ️  No cookie banner found or already handled");
  return false;
}

// Helper function to check for broken images (excluding club badges and small images)
async function checkBrokenImages(page: Page) {
  console.log("🔍 Checking for broken images...");

  const brokenImages = await page.evaluate(async () => {
    const images = Array.from(document.images);
    const broken: Array<{
      src: string;
      alt: string;
      parentHtml: string;
      width: number;
      height: number;
      className: string;
    }> = [];

    for (const img of images) {
      // Skip tracking pixels, small images, and club badges
      if (
        img.width <= 1 ||
        img.height <= 1 ||
        img.src.includes("badge") ||
        img.src.includes("logo") ||
        img.className.includes("badge") ||
        img.className.includes("logo") ||
        (img.alt &&
          (img.alt.toLowerCase().includes("logo") ||
            img.alt.toLowerCase().includes("badge")))
      ) {
        continue;
      }

      // Skip social media icons and other common non-content images
      if (
        img.src.includes("social") ||
        img.src.includes("icon") ||
        img.className.includes("icon") ||
        (img.parentElement &&
          (img.parentElement.className.includes("social") ||
            img.parentElement.className.includes("icon")))
      ) {
        continue;
      }

      // Check if image is broken
      if (!img.complete || img.naturalWidth === 0) {
        broken.push({
          src: img.src,
          alt: img.alt,
          parentHtml: img.parentElement
            ? img.parentElement.outerHTML
            : "No parent element",
          width: img.width,
          height: img.height,
          className: img.className,
        });
      }
    }

    return broken;
  });

  if (brokenImages.length > 0) {
    console.log(`⚠️  Found ${brokenImages.length} broken image(s):`);
    // Log the first 5 broken images to avoid cluttering the output
    brokenImages.slice(0, 5).forEach((img, index) => {
      console.log(`   ${index + 1}. Source: ${img.src}`);
      console.log(`      Alt text: ${img.alt || "None"}`);
      console.log(`      Dimensions: ${img.width}x${img.height}`);
      console.log(`      Class: ${img.className || "None"}`);
      console.log(
        `      Parent element: ${img.parentHtml.substring(0, 150)}...`
      );
    });

    if (brokenImages.length > 5) {
      console.log(`   ...and ${brokenImages.length - 5} more broken images`);
    }

    // Ensure test-results directory exists
    if (!fs.existsSync("test-results")) {
      fs.mkdirSync("test-results", { recursive: true });
    }

    // Save full details to a file for reference
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const reportPath = `test-results/teamtalk-broken-images-${timestamp}.json`;
    await fs.promises.writeFile(
      reportPath,
      JSON.stringify(brokenImages, null, 2)
    );
    console.log(`   ℹ️  Full broken images report saved to: ${reportPath}`);
  } else {
    console.log("✅ No broken images found");
  }

  return brokenImages.map((img) => ({
    url: img.src,
    error: "Image failed to load",
  }));
}

// Helper function to check for broken links
async function checkBrokenLinks(page: Page) {
  const broken: Array<{ url: string; error: string }> = [];
  const links = await page.$$("a[href]");

  for (const link of links.slice(0, 10)) {
    // Limit to first 10 links
    try {
      const href = await link.getAttribute("href");
      if (
        !href ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#") ||
        /^javascript:/i.test(href)
      )
        continue;

      // Skip known problematic links
      const excludedPatterns = [
        "unisignin.cmd.push",
        "facebook.com/teamtalk",
      ];

      if (excludedPatterns.some((pattern) => href.includes(pattern))) {
        console.log(`Skipping excluded link: ${href}`);
        continue;
      }

      const url = new URL(href, page.url()).toString();
      const response = await page.request.head(url).catch(() => null);

      if (!response || response.status() >= 400) {
        broken.push({
          url,
          error: response ? `HTTP ${response.status()}` : "Connection failed",
        });
      }
    } catch (error) {
      console.log(`Error checking link: ${error}`);
      continue;
    }
  }

  return broken;
}

// Helper function to check for ads
async function checkForAds(page: Page): Promise<boolean> {
  console.log("🔍 Checking for ads...");

  // Common ad selectors
  const adSelectors = [
    '[id*="ad-"]',
    '[class*="ad-"]',
    '[class*="banner"]',
    'iframe[src*="ads"]',
    "ins.adsbygoogle",
    "div.ad-container",
    "div.ad-wrapper",
    "div.ad-slot",
  ];

  let hasAds = false;

  for (let scroll = 0; scroll < 3 && !hasAds; scroll++) {
    if (scroll > 0) {
      await page.mouse.wheel(0, 800).catch(() => {});
      await page.waitForTimeout(500);
    }
    for (const selector of adSelectors) {
      const ads = await page.$$(selector);
      if (ads.length > 0) {
        hasAds = true;
        console.log(`✅ Found ${ads.length} ad(s) with selector: ${selector}`);
        break;
      }
    }
  }

  if (!hasAds) {
    const adFrame = await page
      .locator('iframe[src*="googlesyndication"], iframe[id*="google_ads"], iframe[src*="doubleclick"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (adFrame) {
      hasAds = true;
      console.log("✅ Found ad iframe (googlesyndication/doubleclick)");
    }
  }

  if (!hasAds) {
    console.log("⚠️  No ads found using standard selectors");
  }

  return hasAds;
}

// Helper function to check content freshness
async function checkContentFreshness(
  page: Page,
  maxHours: number = 24
): Promise<{ passed: boolean; staleCount: number; totalCount: number }> {
  console.log(`🔍 Checking content freshness (max ${maxHours} hours old)...`);

  const timeElements = await page.$$("time[datetime]");
  const now = new Date();
  let staleCount = 0;

  for (const timeEl of timeElements.slice(0, 5)) {
    // Check first 5 timestamps
    try {
      const dateTime = await timeEl.getAttribute("datetime");
      if (dateTime) {
        const hoursOld =
          (now.getTime() - new Date(dateTime).getTime()) / (1000 * 60 * 60);
        if (hoursOld > maxHours) staleCount++;
      }
    } catch (error) {
      // Continue checking other elements
    }
  }

  return {
    passed: staleCount === 0,
    staleCount,
    totalCount: timeElements.length,
  };
}

// Main test
test.describe('TeamTalk Website Tests', () => {
  PAGES.forEach(({ name, url }) => {
    test(`TeamTalk - Test ${name} page`, async ({ page }) => {
    test.setTimeout(120000); // 2 minutes per page

    const result: PageTestResult = {
      url,
      status: 0,
      pageTitle: "",
      tests: {
        httpErrors: { name: "HTTP Errors", passed: false, details: "" },
        staleContent: { name: "Stale Content", passed: false, details: "" },
        brokenImages: { name: "Broken Images", passed: false, details: "" },
        brokenLinks: { name: "Broken Links", passed: false, details: "" },
        ads: { name: "Ads Present", passed: false, details: "" },
      },
    };
    let brokenImagesCount = 0;
    let brokenLinksCount = 0;
    let staleArticlesCount = 0;

    try {
      // Navigate to page
      console.log(`\n🚀 Testing ${name} page: ${url}`);
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      if (!response) throw new Error("No response");

      result.status = response.status();
      result.pageTitle = await page.title();

      // Test 1: Check HTTP status
      result.tests.httpErrors = {
        name: "HTTP Errors",
        passed: result.status < 400,
        details: `Status: ${result.status}`,
      };

      if (result.status >= 400)
        throw new Error(`HTTP ${result.status}`);

      console.log(`✅ Page loaded successfully (${result.status})`);

      // Handle cookie banner
      await handleCookieBanner(page);

      // Scroll down to load lazy-loaded content
      console.log("🔄 Scrolling to load content...");
      await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight || totalHeight > 2000) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });

      await page.waitForTimeout(2000);

      // Test 2: Check for stale content
      const freshnessResult = await checkContentFreshness(page, 24);
      staleArticlesCount = freshnessResult.staleCount;
      result.tests.staleContent = {
        name: "Stale Content",
        passed: freshnessResult.passed,
        details: `${freshnessResult.staleCount} of ${freshnessResult.totalCount} articles >24h old`,
      };

      // Test 3: Check broken images
      const brokenImages = await checkBrokenImages(page);
      brokenImagesCount = brokenImages.length;
      result.tests.brokenImages = {
        name: "Broken Images",
        passed: brokenImages.length === 0,
        details: `${brokenImages.length} broken images found`,
        failures: brokenImages,
      };

      // Test 4: Check broken links
      const brokenLinks = await checkBrokenLinks(page);
      brokenLinksCount = brokenLinks.length;
      result.tests.brokenLinks = {
        name: "Broken Links",
        passed: brokenLinks.length === 0,
        details: `${brokenLinks.length} broken links found`,
        failures: brokenLinks,
      };

      // Test 5: Check for ads
      const hasAds = await checkForAds(page);
      result.tests.ads = {
        name: "Ads Present",
        passed: hasAds,
        details: hasAds ? "Ads detected" : "No ads found",
      };

      // Take screenshot (non-blocking — font loading can hang on heavy pages)
      const screenshotPath = `test-results/teamtalk-${name.toLowerCase().replace(/\s+/g, "-")}.png`;
      try {
        await page.screenshot({
          path: screenshotPath,
          timeout: 10000,
          animations: "disabled",
        });
        console.log(`📸 Screenshot saved: ${screenshotPath}`);
      } catch {
        console.log(`⚠️  Screenshot skipped for ${name} (timeout or render issue)`);
      }
    } catch (error) {
      result.error = error.message;
      console.error(`❌ Error testing ${name}:`, error);
    }

    // Log results
    console.log(`\n📊 ${name} Test Results`);
    console.log("=".repeat(40));
    console.log(`URL: ${result.url}`);
    console.log(`Status: ${result.status} ${result.pageTitle}`);

    Object.entries(result.tests).forEach(([key, test]) => {
      console.log(`\n${test.name}: ${test.passed ? "✅ PASS" : "❌ FAIL"}`);
      console.log(`  ${test.details}`);

      if (test.failures?.length) {
        console.log("  Issues:");
        test.failures.forEach((f, i) => {
          console.log(`  ${i + 1}. ${f.url || "Unknown"}: ${f.error}`);
        });
      }
    });

    if (result.error) {
      console.log(`\n❌ Error: ${result.error}`);
    }

    console.log("\n" + "=".repeat(40));

    const failedTests = Object.values(result.tests).filter((t) => !t.passed);
    // Page health: HTTP, images, and links must pass; ads/stale are advisory (still in metrics).
    const criticalChecks = new Set(["HTTP Errors", "Broken Images", "Broken Links"]);
    const criticalFailures = failedTests.filter((t) => criticalChecks.has(t.name));
    const pageSlug = name.toLowerCase().replace(/\s+/g, "-");

    recordGrafanaMetrics(test.info(), {
      site: SITE_LABELS.teamtalk,
      suite: "website",
      page: pageSlug,
      metrics: [
        metric("sport_e2e_http_status", result.status),
        metric(
          "sport_e2e_check_passed",
          result.tests.httpErrors.passed ? 1 : 0,
          "gauge",
          { check: "http_errors" }
        ),
        metric(
          "sport_e2e_check_passed",
          result.tests.staleContent.passed ? 1 : 0,
          "gauge",
          { check: "stale_content" }
        ),
        metric(
          "sport_e2e_check_passed",
          result.tests.brokenImages.passed ? 1 : 0,
          "gauge",
          { check: "broken_images" }
        ),
        metric(
          "sport_e2e_check_passed",
          result.tests.brokenLinks.passed ? 1 : 0,
          "gauge",
          { check: "broken_links" }
        ),
        metric(
          "sport_e2e_check_passed",
          result.tests.ads.passed ? 1 : 0,
          "gauge",
          { check: "ads_present" }
        ),
        metric("sport_e2e_broken_images_count", brokenImagesCount, "gauge"),
        metric("sport_e2e_broken_links_count", brokenLinksCount, "gauge"),
        metric("sport_e2e_stale_articles_count", staleArticlesCount, "gauge"),
        metric(
          "sport_e2e_page_health_score",
          failedTests.length === 0 ? 100 : Math.max(0, 100 - failedTests.length * 20),
          "gauge"
        ),
      ],
    });

    expect(
      criticalFailures,
      `${criticalFailures.length} critical check(s) failed`
    ).toHaveLength(0);
  });
  });
});

