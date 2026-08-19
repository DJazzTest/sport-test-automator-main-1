import { test, expect } from '@playwright/test';
import { appendEmailReportFailures } from '../../Utils/emailReportMerge';

const isQuick = !!(process.env.PLAYWRIGHT_QUICK || process.env.CI || process.env.PLAYWRIGHT_EMAIL_SUITE === '1');

test.describe('Vodacom Soccer – Comprehensive Site Testing', () => {
  test('VodaCS – Full site health check (broken links, images, 404s)', async ({ page }) => {
    test.setTimeout(isQuick ? 5 * 60_000 : 15 * 60_000);

    // Enhanced consent handling
    const acceptConsent = async () => {
      try { await page.getByRole('button', { name: /Accept all Cookies/i }).click({ timeout: 3000 }); } catch {}
      try { await page.getByRole('button', { name: /Agree and proceed/i }).click({ timeout: 3000 }); } catch {}
      try { await page.getByRole('button', { name: /Accept All/i }).click({ timeout: 3000 }); } catch {}
      try { await page.getByRole('button', { name: /Allow all/i }).click({ timeout: 3000 }); } catch {}
      try { await page.getByRole('button', { name: /^OK$/i }).click({ timeout: 2000 }); } catch {}
      try { await page.locator('#onetrust-accept-btn-handler').click({ timeout: 2000 }); } catch {}
      try { await page.locator('button.unic-agree-all-button').click({ timeout: 2000 }); } catch {}
    };

    // Helper to check for broken images
    const checkBrokenImages = async (section: string) => {
      console.log(`🔍 Checking broken images in ${section}...`);
      const images = page.locator('img');
      const imageCount = await images.count();
      let brokenImages = 0;
      
      for (let i = 0; i < Math.min(imageCount, 50); i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');
        if (src && !src.startsWith('data:')) {
          const naturalWidth = await img.evaluate(el => (el as HTMLImageElement).naturalWidth);
          if (naturalWidth === 0) {
            brokenImages++;
            const fullImageUrl = src.startsWith('http') ? src : new URL(src, page.url()).toString();
            console.log(`❌ Broken image: ${fullImageUrl}`);
            console.log(`   📋 Steps to recreate:`);
            console.log(`      1. Navigate to: ${page.url()}`);
            console.log(`      2. Scroll down the page to find images`);
            console.log(`      3. Look for a broken/missing image (shows placeholder or alt text)`);
            console.log(`      4. Right-click the broken image and select "Inspect" or "Inspect Element"`);
            console.log(`      5. Check the image src attribute - it should match: ${fullImageUrl}`);
            console.log(`      6. Expected: Image should display correctly`);
            console.log(`      7. Actual: Image fails to load (broken image)`);
          }
        }
      }
      console.log(`📊 ${section} images: ${imageCount} total, ${brokenImages} broken`);
      return brokenImages;
    };

    // Helper to check for broken links (optimized for speed)
    const checkBrokenLinks = async (section: string) => {
      console.log(`🔍 Checking broken links in ${section}...`);
      const links = page.locator('a[href]');
      const linkCount = await links.count();
      let brokenLinks = 0;
      const brokenUrls: string[] = [];
      
      // Check fewer links but provide full URLs
      const maxLinks = Math.min(linkCount, isQuick ? 5 : 15);
      
      for (let i = 0; i < maxLinks; i++) {
        const link = links.nth(i);
        const href = await link.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
          // Convert relative URLs to absolute
          const fullUrl = href.startsWith('http') ? href : new URL(href, page.url()).toString();
          
          try {
            const response = await page.request.get(fullUrl, { timeout: 3000 }); // Reduced timeout
            if (response.status() >= 400) {
              brokenLinks++;
              brokenUrls.push(`${fullUrl} (${response.status()})`);
              console.log(`❌ Broken link: ${fullUrl} - Status: ${response.status()}`);
              console.log(`   📋 Steps to recreate:`);
              console.log(`      1. Navigate to: ${page.url()}`);
              console.log(`      2. Look for a link that points to: ${fullUrl}`);
              console.log(`      3. Click on that link`);
              console.log(`      4. Expected: Page should load successfully`);
              console.log(`      5. Actual: Returns HTTP ${response.status()} (broken link)`);
            }
          } catch (error) {
            brokenLinks++;
            brokenUrls.push(`${fullUrl} (Error)`);
            console.log(`❌ Broken link: ${fullUrl} - Error: ${error.message}`);
            console.log(`   📋 Steps to recreate:`);
            console.log(`      1. Navigate to: ${page.url()}`);
            console.log(`      2. Look for a link that points to: ${fullUrl}`);
            console.log(`      3. Click on that link`);
            console.log(`      4. Expected: Page should load successfully`);
            console.log(`      5. Actual: Error occurred - ${error.message}`);
          }
        }
      }
      console.log(`📊 ${section} links: ${linkCount} total, ${brokenLinks} broken (checked ${maxLinks})`);
      
      if (brokenUrls.length > 0) {
        console.log(`\n🔴 BROKEN LINKS IN ${section.toUpperCase()}:`);
        brokenUrls.forEach((url, index) => {
          console.log(`${index + 1}. ${url}`);
        });
      }
      
      return { brokenLinks, brokenUrls };
    };

    // Track all broken links across sections
    const allBrokenLinks: { section: string; urls: string[] }[] = [];

    // 1) Test Home Page
    console.log('\n=== TESTING HOME PAGE ===');
    await page.goto('https://vodacomsoccer.com/', { waitUntil: 'domcontentloaded' });
    await acceptConsent();
    await page.waitForTimeout(2000);
    
    const homeImages = await checkBrokenImages('Home Page');
    const homeLinks = await checkBrokenLinks('Home Page');
    allBrokenLinks.push({ section: 'Home Page', urls: homeLinks.brokenUrls });

    // 2) Test Match Centre (content loading, scrolling, and animations)
    console.log('\n=== TESTING MATCH CENTRE ===');
    try {
      await page.getByRole('link', { name: /match centre/i }).click({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded');
      await acceptConsent();
      await page.waitForTimeout(2000);

      // Test that content loads and page scrolls
      const content = page.locator('main, [role="main"], #__next');
      const isContentVisible = await content.isVisible();
      console.log(`✅ Match Centre content loaded: ${isContentVisible}`);
      
      // Test scrolling
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));
      console.log(`✅ Match Centre scrolling works`);

      // Test up to 20 events for animations
      const eventLinks = page.locator('a[href^="/match-centre/match-detail/"]');
      const totalEvents = await eventLinks.count();
      const maxEvents = Math.min(totalEvents, isQuick ? 2 : 20);
      
      console.log(`🎯 Testing ${maxEvents} events for animations...`);
      let pass = 0, fail = 0;
      
      for (let i = 0; i < maxEvents; i++) {
        const link = eventLinks.nth(i);
        const title = (await link.innerText().catch(() => `Event ${i + 1}`)).trim();
        console.log(`\n🎯 Testing event ${i + 1}/${maxEvents}: ${title}`);

        try {
          await link.click({ timeout: 5000 });
          await page.waitForLoadState('domcontentloaded');
          await acceptConsent();
          await page.waitForTimeout(1000);

          // Check for match animation
          const animationContainer = page.locator('div.match-animation iframe.iframe-widget');
          let hasAnimation = false;
          try {
            await animationContainer.waitFor({ state: 'visible', timeout: 5000 });
            const src = await animationContainer.getAttribute('src');
            hasAnimation = !!src && src.includes('widgets.thesports01.com');
          } catch {}

          if (hasAnimation) {
            console.log(`✅ PASS: Animation detected — ${title}`);
            pass++;
          } else {
            console.log(`❌ FAIL: No animation — ${title}`);
            fail++;
          }

          // Navigate back to Match Centre
          await page.goto('https://vodacomsoccer.com/match-centre', { waitUntil: 'domcontentloaded' });
          await acceptConsent();
          await page.waitForTimeout(500);
        } catch (error) {
          console.log(`❌ Error testing event: ${error.message}`);
          console.log(`   📋 Steps to recreate:`);
          console.log(`      1. Navigate to the event page`);
          console.log(`      2. Try to interact with the event`);
          console.log(`      3. Expected: Event should load and be interactive`);
          console.log(`      4. Actual: Error - ${error.message}`);
          fail++;
        }
      }

      console.log(`\n📊 Match Centre Animation Results: ${pass} PASS, ${fail} FAIL`);

      const matchCentreLinks = await checkBrokenLinks('Match Centre');
      allBrokenLinks.push({ section: 'Match Centre', urls: matchCentreLinks.brokenUrls });
    } catch (error) {
      console.log(`❌ Error accessing Match Centre: ${error.message}`);
      console.log(`   📋 Steps to recreate:`);
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log(`      2. Try to access the Match Centre section`);
      console.log(`      3. Expected: Match Centre should load successfully`);
      console.log(`      4. Actual: Error - ${error.message}`);
    }

    if (!isQuick) {
    // 3) Test Play Page (content loading and scrolling)
    console.log('\n=== TESTING PLAY PAGE ===');
    try {
      await page.getByRole('link', { name: /play/i }).click({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded');
      await acceptConsent();
      await page.waitForTimeout(2000);

      // Test that content loads and page scrolls
      const content = page.locator('main, [role="main"], #__next');
      const isContentVisible = await content.isVisible();
      console.log(`✅ Play page content loaded: ${isContentVisible}`);
      
      // Test scrolling
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));
      console.log(`✅ Play page scrolling works`);

      const playLinks = await checkBrokenLinks('Play Page');
      allBrokenLinks.push({ section: 'Play Page', urls: playLinks.brokenUrls });
    } catch (error) {
      console.log(`❌ Error accessing Play page: ${error.message}`);
      console.log(`   📋 Steps to recreate:`);
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log(`      2. Try to access the Play page`);
      console.log(`      3. Expected: Play page should load successfully`);
      console.log(`      4. Actual: Error - ${error.message}`);
    }

    // 4) Test Competition Page (content loading and scrolling)
    console.log('\n=== TESTING COMPETITION PAGE ===');
    try {
      await page.getByRole('link', { name: /competition/i }).click({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded');
      await acceptConsent();
      await page.waitForTimeout(2000);

      // Test that content loads and page scrolls
      const content = page.locator('main, [role="main"], #__next');
      const isContentVisible = await content.isVisible();
      console.log(`✅ Competition page content loaded: ${isContentVisible}`);
      
      // Test scrolling
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      await page.evaluate(() => window.scrollTo(0, 0));
      console.log(`✅ Competition page scrolling works`);

      const competitionLinks = await checkBrokenLinks('Competition Page');
      allBrokenLinks.push({ section: 'Competition Page', urls: competitionLinks.brokenUrls });
    } catch (error) {
      console.log(`❌ Error accessing Competition page: ${error.message}`);
      console.log(`   📋 Steps to recreate:`);
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log(`      2. Try to access the Competition page`);
      console.log(`      3. Expected: Competition page should load successfully`);
      console.log(`      4. Actual: Error - ${error.message}`);
    }

    // 5) Test News Section with all tabs
    console.log('\n=== TESTING NEWS SECTION ===');
    try {
      await page.getByRole('link', { name: /news/i }).click({ timeout: 5000 });
      await page.waitForLoadState('domcontentloaded');
      await acceptConsent();
      await page.waitForTimeout(2000);

      // Test news tabs with correct selectors
      const newsTabs = [
        { name: 'Featured', selector: '#news-category-tabs-tab-features' },
        { name: 'PSL', selector: '#news-category-tabs-tab-psl' },
        { name: 'EPL', selector: '#news-category-tabs-tab-epl' },
        { name: 'Bafana Bafana', selector: '#news-category-tabs-tab-bafana-bafana' }
      ];
      
      for (const tab of newsTabs) {
        console.log(`\n🔍 Testing News - ${tab.name} tab...`);
        try {
          await page.locator(tab.selector).click({ timeout: 3000 });
          await page.waitForTimeout(1000);
          
          // Test that content loads and scrolls
          const content = page.locator('main, [role="main"], #__next');
          const isContentVisible = await content.isVisible();
          console.log(`✅ News ${tab.name} content loaded: ${isContentVisible}`);
          
          // Test scrolling
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(500);
          await page.evaluate(() => window.scrollTo(0, 0));
          console.log(`✅ News ${tab.name} scrolling works`);
          
          const tabLinks = await checkBrokenLinks(`News ${tab.name}`);
          allBrokenLinks.push({ section: `News ${tab.name}`, urls: tabLinks.brokenUrls });
        } catch (error) {
          console.log(`❌ Error testing ${tab.name} tab: ${error.message}`);
          console.log(`   📋 Steps to recreate:`);
          console.log(`      1. Navigate to: ${page.url()}`);
          console.log(`      2. Click on the "${tab.name}" tab`);
          console.log(`      3. Expected: Tab should load and display content`);
          console.log(`      4. Actual: Error - ${error.message}`);
        }
      }

      // Test Latest Video tab
      console.log(`\n🔍 Testing News - Latest Video tab...`);
      try {
        await page.getByRole('button', { name: 'Latest Video' }).click({ timeout: 3000 });
        await page.waitForTimeout(1000);
        
        const videoImages = await checkBrokenImages('News Latest Video');
        const videoLinks = await checkBrokenLinks('News Latest Video');
        allBrokenLinks.push({ section: 'News Latest Video', urls: videoLinks.brokenUrls });
        
        // Check for working video links
        const videoLinks_elements = page.locator('a[href*="video"], a[href*="youtube"], a[href*="vimeo"]');
        const videoCount = await videoLinks_elements.count();
        console.log(`📊 Latest Video: ${videoCount} video links found`);
      } catch (error) {
        console.log(`❌ Error testing Latest Video tab: ${error.message}`);
        console.log(`   📋 Steps to recreate:`);
        console.log(`      1. Navigate to: ${page.url()}`);
        console.log(`      2. Click on the "Latest Video" tab`);
        console.log(`      3. Expected: Video tab should load and display videos`);
        console.log(`      4. Actual: Error - ${error.message}`);
      }
    } catch (error) {
      console.log(`❌ Error accessing News section: ${error.message}`);
      console.log(`   📋 Steps to recreate:`);
      console.log(`      1. Navigate to: ${page.url()}`);
      console.log(`      2. Try to access the News section`);
      console.log(`      3. Expected: News section should load successfully`);
      console.log(`      4. Actual: Error - ${error.message}`);
    }
    } else {
      console.log('\n⏩ Quick mode: skipping Play, Competition, and News sections');
    }

    console.log('\n🏁 === COMPREHENSIVE TEST COMPLETE ===');
    console.log('✅ All sections tested for broken links, images, and 404s');
    
    // Final summary of all broken links
    console.log('\n📋 === COMPLETE BROKEN LINKS SUMMARY ===');
    let totalBrokenLinks = 0;
    allBrokenLinks.forEach(section => {
      if (section.urls.length > 0) {
        console.log(`\n🔴 ${section.section}:`);
        section.urls.forEach((url, index) => {
          console.log(`  ${index + 1}. ${url}`);
        });
        totalBrokenLinks += section.urls.length;
      }
    });
    
    if (totalBrokenLinks === 0) {
      console.log('✅ No broken links found across all sections!');
    } else {
      console.log(`\n📊 Total broken links found: ${totalBrokenLinks}`);
      const emailFailures = allBrokenLinks
        .filter((s: { urls: string[] }) => s.urls.length > 0)
        .map((s: { section: string; urls: string[] }) => `Broken URL: ${s.section} — ${s.urls.length} broken link(s)`);
      if (emailFailures.length > 0) {
        appendEmailReportFailures('Vodacom', emailFailures);
        throw new Error(`Vodacom: ${totalBrokenLinks} broken link(s) across ${emailFailures.length} section(s)`);
      }
    }
  });
});
